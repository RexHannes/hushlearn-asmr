const WORDS = /[\p{L}\p{N}]+/gu;
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

export function cleanText(value = "") {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function tokenize(value = "") {
  const words = value.toLocaleLowerCase().match(WORDS) || [];
  const terms = [];

  for (const word of words) {
    terms.push(word);
    if (CJK.test(word)) {
      const chars = [...word];
      for (const char of chars) terms.push(char);
      for (let index = 0; index < chars.length - 1; index += 1) {
        terms.push(chars[index] + chars[index + 1]);
      }
    }
  }

  return terms.filter((term) => term.length > 1 || CJK.test(term));
}

function splitLongParagraph(paragraph, maxLength) {
  if (paragraph.length <= maxLength) return [paragraph];

  const sentences =
    paragraph.match(/[^.!?。！？\n]+[.!?。！？]?/gu)?.map((item) => item.trim()) ||
    [paragraph];
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > maxLength) {
      chunks.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function chunkKnowledge(value, maxLength = 760) {
  const text = cleanText(value);
  if (!text) return [];

  const paragraphs = text
    .split(/\n{2,}/)
    .flatMap((paragraph) => splitLongParagraph(paragraph.trim(), maxLength))
    .filter(Boolean);

  return paragraphs.map((content, index) => ({
    id: `source-${index + 1}`,
    content,
    terms: tokenize(content),
  }));
}

export function buildIndex(value) {
  const chunks = chunkKnowledge(value);
  const documentFrequency = new Map();

  for (const chunk of chunks) {
    for (const term of new Set(chunk.terms)) {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    }
  }

  return {
    chunks,
    documentFrequency,
    size: chunks.length,
  };
}

export function retrieve(query, index, limit = 3) {
  const queryTerms = [...new Set(tokenize(query))];
  if (!queryTerms.length || !index?.chunks?.length) return [];

  return index.chunks
    .map((chunk) => {
      const frequency = new Map();
      for (const term of chunk.terms) {
        frequency.set(term, (frequency.get(term) || 0) + 1);
      }

      let score = 0;
      const matchedTerms = [];
      for (const term of queryTerms) {
        const count = frequency.get(term) || 0;
        if (!count) continue;
        const idf = Math.log((index.size + 1) / ((index.documentFrequency.get(term) || 0) + 1)) + 1;
        score += (1 + Math.log(count)) * idf * Math.min(term.length, 6);
        matchedTerms.push(term);
      }

      const normalizedQuery = cleanText(query).toLocaleLowerCase();
      if (normalizedQuery.length > 3 && chunk.content.toLocaleLowerCase().includes(normalizedQuery)) {
        score += 16;
      }

      return { ...chunk, score, matchedTerms };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function selectSentences(results, maxSentences = 3) {
  const candidates = results.flatMap((result) =>
    (result.content.match(/[^.!?。！？\n]+[.!?。！？]?/gu) || [result.content]).map(
      (sentence) => ({
        sentence: sentence.trim(),
        sourceId: result.id,
        score:
          result.score +
          result.matchedTerms.filter((term) =>
            sentence.toLocaleLowerCase().includes(term),
          ).length *
            3,
      }),
    ),
  );

  return candidates
    .filter((item) => item.sentence.length > 28)
    .sort((left, right) => right.score - left.score)
    .slice(0, maxSentences);
}

export function composeGroundedAnswer(query, results, locale = "en-US") {
  const chinese = locale.startsWith("zh");
  if (!results.length) {
    return {
      text: chinese
        ? "我在目前的知識庫裡找不到足夠資料來回答這個問題。你可以換一種問法，或在知識庫加入相關內容。"
        : "I can’t find enough support for that in the current knowledge base. Try another wording, or add material that covers it.",
      citations: [],
      confidence: "low",
    };
  }

  const selected = selectSentences(results);
  const evidence = selected.map((item) => item.sentence).join(" ");
  const lead = chinese
    ? `根據你選擇的知識庫，關於「${query.trim()}」：`
    : `Based on your selected knowledge, here’s the clearest answer:`;

  return {
    text: `${lead} ${evidence}`,
    citations: [...new Set(selected.map((item) => item.sourceId))],
    confidence: results[0].score > 18 ? "high" : "medium",
  };
}
