import test from "node:test";
import assert from "node:assert/strict";
import {
  buildIndex,
  chunkKnowledge,
  composeGroundedAnswer,
  retrieve,
  tokenize,
} from "./knowledge.js";

const sample = `
Sleep supports memory consolidation. During sleep, recently encoded memories are
reactivated and integrated with existing knowledge.

Retrieval practice strengthens learning more reliably than passive rereading.
Spacing study sessions over time also improves long-term retention.
`;

test("chunks clean knowledge into stable sources", () => {
  const chunks = chunkKnowledge(sample);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].id, "source-1");
});

test("retrieval ranks the relevant source first", () => {
  const results = retrieve("How does sleep help memory?", buildIndex(sample));
  assert.equal(results[0].id, "source-1");
  assert.ok(results[0].score > 0);
});

test("CJK text creates searchable characters and bigrams", () => {
  const terms = tokenize("睡眠有助記憶");
  assert.ok(terms.includes("睡眠"));
  assert.ok(terms.includes("記憶"));
});

test("answers remain grounded and cite source ids", () => {
  const index = buildIndex(sample);
  const answer = composeGroundedAnswer(
    "What strengthens learning?",
    retrieve("What strengthens learning?", index),
  );
  assert.match(answer.text, /Retrieval practice/);
  assert.deepEqual(answer.citations, ["source-2"]);
});
