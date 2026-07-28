import {
  buildIndex,
  chunkKnowledge,
  composeGroundedAnswer,
  retrieve,
} from "./lib/knowledge.js";
import { mountLivingPortrait } from "./lib/living-portrait.js";
import { SAMPLES } from "./lib/samples.js";

const ENERGY = {
  drained: { rate: 0.72 },
  steady: { rate: 0.84 },
  focused: { rate: 0.96 },
};
const FILE_TYPES = [".txt", ".md", ".csv", ".json", ".html"];
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  knowledge: SAMPLES[0],
  index: buildIndex(SAMPLES[0].text),
  sourceMatches: [],
  energy: "steady",
  locale: "en-US",
  quiet: false,
  speaking: false,
  listening: false,
  brownOn: false,
  brownVolume: 0.08,
  recognition: null,
  audio: null,
  voices: [],
};

const panels = {
  knowledge: $("#knowledgePanel"),
  sources: $("#sourcesPanel"),
  settings: $("#settingsPanel"),
  about: $("#aboutPanel"),
};
const drawerMeta = {
  knowledge: ["▤", "Knowledge studio"],
  sources: ["⌑", "Grounding sources"],
  settings: ["☷", "Room settings"],
  about: ["☾", "About Hushlearn"],
};

function showError(message) {
  $("#errorMessage").textContent = message;
  $("#errorToast").hidden = false;
}

function clearError() {
  $("#errorToast").hidden = true;
}

function setStatus(message) {
  $("#roomStatus").textContent = message;
}

function setConfidence(level = "high") {
  const confidence = $("#confidence");
  confidence.className = `confidence confidence-${level}`;
  confidence.querySelector("b").textContent =
    level === "high"
      ? "Strong match"
      : level === "medium"
        ? "Useful match"
        : "Not found";
}

function renderKnowledge() {
  $("#knowledgeTitle").textContent = state.knowledge.name;
  $("#knowledgeCount").textContent =
    `${state.index.size} grounded ${state.index.size === 1 ? "passage" : "passages"}`;
}

function setHostAnswer(text, confidence = "high", citations = []) {
  $("#hostAnswer").textContent = text;
  setConfidence(confidence);
  const sourcesButton = $("#sourcesButton");
  sourcesButton.hidden = citations.length === 0;
  sourcesButton.textContent = citations.length
    ? `${citations.map((id) => `S${id.replace("source-", "")}`).join(" · ")} sources`
    : "View sources";
}

function refreshVoices() {
  state.voices = window.speechSynthesis?.getVoices?.() || [];
}

function stopVoice() {
  window.speechSynthesis?.cancel();
  state.speaking = false;
  $("#appShell").classList.remove("is-speaking");
  $("#voiceBars").classList.remove("active");
}

function speak(text) {
  if (state.quiet || !("speechSynthesis" in window)) return;
  stopVoice();
  const utterance = new SpeechSynthesisUtterance(text);
  const matches = state.voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith(state.locale.slice(0, 2).toLowerCase()),
  );
  utterance.voice =
    matches.find((voice) =>
      /samantha|serena|ting|sin-ji|meijia|female/i.test(voice.name),
    ) ||
    matches[0] ||
    null;
  utterance.lang = state.locale;
  utterance.rate = ENERGY[state.energy].rate;
  utterance.pitch = state.locale.startsWith("zh") ? 0.94 : 0.9;
  utterance.volume = 0.86;
  utterance.onstart = () => {
    state.speaking = true;
    $("#appShell").classList.add("is-speaking");
    $("#voiceBars").classList.add("active");
    setStatus("speaking softly");
  };
  utterance.onend = () => {
    state.speaking = false;
    $("#appShell").classList.remove("is-speaking");
    $("#voiceBars").classList.remove("active");
    setStatus("Ready");
  };
  utterance.onerror = () => {
    state.speaking = false;
    $("#appShell").classList.remove("is-speaking");
    $("#voiceBars").classList.remove("active");
    setStatus("Voice unavailable");
  };
  window.speechSynthesis.speak(utterance);
}

function ask(question) {
  const cleanQuestion = question.trim();
  if (!cleanQuestion) return;
  stopVoice();
  clearError();
  $("#questionInput").value = "";
  $("#sendButton").disabled = true;
  $("#interimText").hidden = true;
  setStatus("Reading your knowledge");
  const matches = retrieve(cleanQuestion, state.index, 3);
  const answer = composeGroundedAnswer(cleanQuestion, matches, state.locale);
  state.sourceMatches = matches;
  setHostAnswer(answer.text, answer.confidence, answer.citations);
  setStatus("Answer ready");
  window.setTimeout(() => speak(answer.text), 120);
}

function setEnergy(mode) {
  if (!ENERGY[mode]) return;
  state.energy = mode;
  $$("[data-energy]").forEach((button) =>
    button.classList.toggle("active", button.dataset.energy === mode),
  );
  savePreferences();
}

function savePreferences() {
  localStorage.setItem(
    "hushlearn-settings",
    JSON.stringify({
      energy: state.energy,
      locale: state.locale,
      quiet: state.quiet,
    }),
  );
}

function loadPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem("hushlearn-settings") || "{}");
    if (ENERGY[saved.energy]) setEnergy(saved.energy);
    if (saved.locale) {
      state.locale = saved.locale;
      $("#languageSelect").value = saved.locale;
    }
    if (typeof saved.quiet === "boolean") {
      state.quiet = saved.quiet;
      $("#quietSwitch").classList.toggle("active", state.quiet);
    }
  } catch {
    // Ignore malformed local settings.
  }
}

function openDrawer(name) {
  const [icon, title] = drawerMeta[name];
  $("#drawerIcon").textContent = icon;
  $("#drawerTitle").textContent = title;
  Object.values(panels).forEach((panel) => {
    panel.hidden = true;
  });
  panels[name].hidden = false;
  $("#drawer").hidden = false;
  $("#drawerBackdrop").hidden = false;

  if (name === "knowledge") {
    $("#kbName").value = state.knowledge.name;
    $("#kbText").value = state.knowledge.text;
    renderKnowledgeStats();
    renderSamples();
  }
  if (name === "sources") renderSources();
}

function closeDrawer() {
  $("#drawer").hidden = true;
  $("#drawerBackdrop").hidden = true;
}

function renderKnowledgeStats() {
  const text = $("#kbText").value;
  $("#kbStats").textContent =
    `${text.length.toLocaleString()} characters · ${chunkKnowledge(text).length} passages`;
}

function renderSamples() {
  const grid = $("#sampleGrid");
  grid.replaceChildren();
  for (const sample of SAMPLES) {
    const button = document.createElement("button");
    button.type = "button";
    button.classList.toggle("selected", $("#kbName").value === sample.name);
    const mark = document.createElement("span");
    mark.textContent =
      sample.id === "sleep" ? "☾" : sample.id === "contracts" ? "⌑" : "◴";
    const title = document.createElement("strong");
    title.textContent = sample.name;
    const description = document.createElement("small");
    description.textContent = sample.description;
    button.append(mark, title, description);
    if ($("#kbName").value === sample.name) {
      const check = document.createElement("span");
      check.className = "sample-check";
      check.textContent = "✓";
      button.append(check);
    }
    button.addEventListener("click", () => {
      $("#kbName").value = sample.name;
      $("#kbText").value = sample.text;
      renderKnowledgeStats();
      renderSamples();
    });
    grid.append(button);
  }
}

function saveKnowledge() {
  const text = $("#kbText").value.trim();
  if (text.length < 80) {
    showError(
      "Please add at least a short paragraph so Mira has something reliable to teach.",
    );
    return;
  }
  const name = $("#kbName").value.trim() || "My knowledge";
  state.knowledge = { id: "custom", name, text };
  state.index = buildIndex(text);
  state.sourceMatches = [];
  renderKnowledge();
  setHostAnswer(
    `I’ve read “${name}.” Ask me a question, or let me choose one clear idea to begin.`,
    "high",
    [],
  );
  closeDrawer();
  clearError();
  setStatus("Knowledge ready");
}

function renderSources() {
  const list = $("#sourceList");
  list.replaceChildren();
  if (!state.sourceMatches.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const icon = document.createElement("span");
    icon.textContent = "⌑";
    const title = document.createElement("strong");
    title.textContent = "No sources used yet";
    const body = document.createElement("p");
    body.textContent = "Ask a question to see the passages behind Mira’s answer.";
    empty.append(icon, title, body);
    list.append(empty);
    return;
  }

  for (const source of state.sourceMatches) {
    const article = document.createElement("article");
    const top = document.createElement("div");
    const badge = document.createElement("span");
    badge.textContent = `S${source.id.replace("source-", "")}`;
    const confidence = document.createElement("span");
    confidence.className = `confidence ${source.score > 18 ? "confidence-high" : "confidence-medium"}`;
    const dot = document.createElement("span");
    const label = document.createTextNode(
      source.score > 18 ? "Strong match" : "Useful match",
    );
    confidence.append(dot, label);
    top.append(badge, confidence);
    const paragraph = document.createElement("p");
    paragraph.textContent =
      source.content.length > 560
        ? `${source.content.slice(0, 560).trim()}…`
        : source.content;
    article.append(top, paragraph);
    list.append(article);
  }
}

async function handleFiles(files) {
  const items = [...files];
  if (!items.length) return;
  const unsupported = items.find(
    (file) =>
      !FILE_TYPES.some((type) => file.name.toLowerCase().endsWith(type)),
  );
  if (unsupported) {
    showError(
      `“${unsupported.name}” is not supported in this free browser build. Use TXT, Markdown, CSV, JSON, or HTML.`,
    );
    return;
  }
  const tooLarge = items.find((file) => file.size > 5 * 1024 * 1024);
  if (tooLarge) {
    showError(`“${tooLarge.name}” is over the 5 MB local limit.`);
    return;
  }
  const sections = await Promise.all(
    items.map(async (file) => {
      const content = await file.text();
      if (file.name.toLowerCase().endsWith(".html")) {
        const parsed = new DOMParser().parseFromString(content, "text/html");
        return `SOURCE: ${file.name}\n\n${parsed.body?.textContent || ""}`;
      }
      return `SOURCE: ${file.name}\n\n${content}`;
    }),
  );
  $("#kbName").value =
    items.length === 1 ? items[0].name : `${items.length} uploaded sources`;
  $("#kbText").value = sections.join("\n\n---\n\n");
  renderKnowledgeStats();
  renderSamples();
  clearError();
}

async function ensureBrownNoise() {
  if (state.audio) {
    if (state.audio.context.state === "suspended") {
      await state.audio.context.resume();
    }
    return true;
  }
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    showError("Ambient audio is not available in this browser.");
    return false;
  }
  const context = new AudioContext();
  const buffer = context.createBuffer(
    1,
    context.sampleRate * 3,
    context.sampleRate,
  );
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[index] = last * 3.5;
  }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  filter.type = "lowpass";
  filter.frequency.value = 950;
  source.buffer = buffer;
  source.loop = true;
  source.connect(filter).connect(gain).connect(context.destination);
  gain.gain.value = 0;
  source.start();
  state.audio = { context, source, gain };
  return true;
}

async function toggleBrownNoise() {
  if (!(await ensureBrownNoise())) return;
  state.brownOn = !state.brownOn;
  state.audio.gain.gain.setTargetAtTime(
    state.brownOn ? state.brownVolume : 0,
    state.audio.context.currentTime,
    0.08,
  );
  $("#ambientButton").classList.toggle("active", state.brownOn);
  $("#noiseSwitch").classList.toggle("active", state.brownOn);
  $("#ambientButton").setAttribute(
    "aria-label",
    state.brownOn ? "Turn off brown noise" : "Turn on brown noise",
  );
}

function startListening() {
  clearError();
  if (state.listening) {
    state.recognition?.stop?.();
    return;
  }
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showError(
      "Live microphone questions are not supported in this browser. Chrome or Edge works best; typing always works.",
    );
    return;
  }
  stopVoice();
  const recognition = new SpeechRecognition();
  recognition.lang = state.locale;
  recognition.continuous = false;
  recognition.interimResults = true;
  state.recognition = recognition;
  let finalTranscript = "";

  recognition.onstart = () => {
    state.listening = true;
    $("#appShell").classList.add("is-listening");
    $("#micButton").classList.add("listening");
    $("#questionInput").placeholder = "I’m listening…";
    setStatus("Listening");
  };
  recognition.onresult = (event) => {
    let live = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0].transcript;
      if (event.results[index].isFinal) finalTranscript += transcript;
      else live += transcript;
    }
    $("#interimText").textContent = `“${live || finalTranscript}”`;
    $("#interimText").hidden = false;
  };
  recognition.onerror = (event) => {
    $("#appShell").classList.remove("is-listening");
    showError(
      event.error === "not-allowed"
        ? "Microphone permission was denied. Enable it in the address bar, or type instead."
        : `I couldn’t hear that clearly (${event.error}). Please try again or type your question.`,
    );
  };
  recognition.onend = () => {
    state.listening = false;
    $("#appShell").classList.remove("is-listening");
    $("#micButton").classList.remove("listening");
    $("#questionInput").placeholder = "Ask from your knowledge…";
    setStatus("Ready");
    if (finalTranscript.trim()) ask(finalTranscript);
  };
  recognition.start();
}

mountLivingPortrait(
  $("#miraPortrait"),
  "./public/assets/mira-study.webp",
);

function beginIdea() {
  const firstChunk = chunkKnowledge(state.knowledge.text)[0]?.content;
  if (!firstChunk) return;
  const intro = state.locale.startsWith("zh")
    ? `我們先安靜地掌握一個重點。${firstChunk}`
    : `Let’s begin with one quiet idea. ${firstChunk}`;
  state.sourceMatches = [
    { id: "source-1", content: firstChunk, score: 100, matchedTerms: [] },
  ];
  setHostAnswer(intro, "high", ["source-1"]);
  speak(intro);
}

$("#aboutButton").addEventListener("click", () => openDrawer("about"));
$("#knowledgeButton").addEventListener("click", () => openDrawer("knowledge"));
$("#selectedKnowledgeButton").addEventListener("click", () =>
  openDrawer("knowledge"),
);
$("#settingsButton").addEventListener("click", () => openDrawer("settings"));
$("#sourcesButton").addEventListener("click", () => openDrawer("sources"));
$("#closeDrawer").addEventListener("click", closeDrawer);
$("#drawerBackdrop").addEventListener("click", closeDrawer);
$("#dismissError").addEventListener("click", clearError);
$("#teachButton").addEventListener("click", beginIdea);
$("#tryButton").addEventListener("click", () =>
  ask("How does sleep help memory?"),
);
$("#composer").addEventListener("submit", (event) => {
  event.preventDefault();
  ask($("#questionInput").value);
});
$("#questionInput").addEventListener("input", (event) => {
  $("#sendButton").disabled = !event.target.value.trim();
});
$("#micButton").addEventListener("click", startListening);
$("#ambientButton").addEventListener("click", toggleBrownNoise);
$("#noiseSwitch").addEventListener("click", toggleBrownNoise);
$("#quietSwitch").addEventListener("click", () => {
  state.quiet = !state.quiet;
  $("#quietSwitch").classList.toggle("active", state.quiet);
  stopVoice();
  savePreferences();
});
$("#volumeSlider").addEventListener("input", (event) => {
  state.brownVolume = Number(event.target.value);
  if (state.audio && state.brownOn) {
    state.audio.gain.gain.setTargetAtTime(
      state.brownVolume,
      state.audio.context.currentTime,
      0.08,
    );
  }
});
$("#languageSelect").addEventListener("change", (event) => {
  state.locale = event.target.value;
  savePreferences();
});
$$("[data-energy]").forEach((button) =>
  button.addEventListener("click", () => setEnergy(button.dataset.energy)),
);
$("#uploadButton").addEventListener("click", () => $("#fileInput").click());
$("#fileInput").addEventListener("change", (event) => {
  handleFiles(event.target.files);
  event.target.value = "";
});
$("#kbText").addEventListener("input", renderKnowledgeStats);
$("#kbName").addEventListener("input", renderSamples);
$("#saveKnowledge").addEventListener("click", saveKnowledge);

if ("speechSynthesis" in window) {
  refreshVoices();
  window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
}
loadPreferences();
renderKnowledge();
renderSamples();

window.addEventListener("beforeunload", () => {
  stopVoice();
  state.recognition?.abort?.();
  if (state.audio) {
    state.audio.source.stop();
    state.audio.context.close();
  }
});
