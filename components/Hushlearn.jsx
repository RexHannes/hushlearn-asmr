"use client";

import {
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  FileText,
  Gauge,
  Headphones,
  Info,
  Library,
  Mic,
  MoonStar,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
  Waves,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildIndex,
  chunkKnowledge,
  composeGroundedAnswer,
  retrieve,
} from "../lib/knowledge";
import { mountMira3D } from "../lib/mira-3d";
import { SAMPLES } from "../lib/samples";

const ENERGY = {
  drained: {
    label: "Drained",
    hint: "Short phrases · longer pauses",
    rate: 0.72,
  },
  steady: {
    label: "Steady",
    hint: "Balanced pace",
    rate: 0.84,
  },
  focused: {
    label: "Focused",
    hint: "More detail · normal pace",
    rate: 0.96,
  },
};

const LANGUAGES = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "zh-HK", label: "廣東話（香港）" },
  { value: "zh-TW", label: "國語（繁體）" },
];

const FILE_TYPES = [".txt", ".md", ".csv", ".json", ".html"];

function sourceLabel(id) {
  return `S${Number(id.replace("source-", ""))}`;
}

function excerpt(value, length = 250) {
  if (value.length <= length) return value;
  return `${value.slice(0, length).trim()}…`;
}

function Confidence({ level }) {
  const labels = {
    high: "Strong match",
    medium: "Useful match",
    low: "Not found",
  };
  return (
    <span className={`confidence confidence-${level}`}>
      <span />
      {labels[level]}
    </span>
  );
}

function VoiceBars({ active }) {
  return (
    <span className={`voice-bars ${active ? "active" : ""}`} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((bar) => (
        <i key={bar} />
      ))}
    </span>
  );
}

export default function Hushlearn() {
  const [knowledge, setKnowledge] = useState(SAMPLES[0]);
  const [messages, setMessages] = useState([
    {
      role: "host",
      text: "Good evening. I’m Mira. Bring me something you want to understand, and we’ll take it one quiet idea at a time.",
      confidence: "high",
      citations: [],
    },
  ]);
  const [sourceMatches, setSourceMatches] = useState([]);
  const [draft, setDraft] = useState("");
  const [interim, setInterim] = useState("");
  const [drawer, setDrawer] = useState(null);
  const [energy, setEnergy] = useState("steady");
  const [locale, setLocale] = useState("en-US");
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [brownOn, setBrownOn] = useState(false);
  const [brownVolume, setBrownVolume] = useState(0.08);
  const [quietMode, setQuietMode] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");
  const [kbName, setKbName] = useState(knowledge.name);
  const [kbDraft, setKbDraft] = useState(knowledge.text);
  const [voices, setVoices] = useState([]);

  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const messageEndRef = useRef(null);
  const miraAvatarRef = useRef(null);
  const mira3dRef = useRef(null);

  useEffect(() => {
    const controller = mountMira3D(miraAvatarRef.current, {
      avatarUrl: "/assets/mira-3d.glb",
      onStatus: setStatus,
      onSpeakingChange: (active) => setSpeaking(active),
      onError: (message) =>
        setError(
          `Mira’s 3D/neural mode could not start (${message}). The static portrait and browser voice still work.`,
        ),
    });
    mira3dRef.current = controller;
    return () => {
      if (mira3dRef.current === controller) mira3dRef.current = null;
      void controller.destroy();
    };
  }, []);

  const knowledgeIndex = useMemo(
    () => buildIndex(knowledge.text),
    [knowledge.text],
  );
  const latestHost =
    [...messages].reverse().find((message) => message.role === "host") ||
    messages[0];

  useEffect(() => {
    try {
      const saved = localStorage.getItem("hushlearn-settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.energy && ENERGY[parsed.energy]) setEnergy(parsed.energy);
        if (parsed.locale) setLocale(parsed.locale);
        if (typeof parsed.quietMode === "boolean") setQuietMode(parsed.quietMode);
      }
    } catch {
      // Corrupt local preferences should never block the lesson.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "hushlearn-settings",
      JSON.stringify({ energy, locale, quietMode }),
    );
  }, [energy, locale, quietMode]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return undefined;
    const refreshVoices = () => setVoices(window.speechSynthesis.getVoices());
    refreshVoices();
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", refreshVoices);
  }, []);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [messages]);

  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.abort?.();
      if (audioRef.current) {
        audioRef.current.source.stop();
        audioRef.current.context.close();
      }
    },
    [],
  );

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.gain.gain.setTargetAtTime(
        brownOn ? brownVolume : 0,
        audioRef.current.context.currentTime,
        0.08,
      );
    }
  }, [brownOn, brownVolume]);

  const stopVoice = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    mira3dRef.current?.stop?.();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text) => {
      if (quietMode) return;
      stopVoice();

      if (locale.toLowerCase().startsWith("en") && mira3dRef.current) {
        try {
          await mira3dRef.current.speak(text, {
            locale,
            rate: ENERGY[energy].rate,
          });
          return;
        } catch (voiceError) {
          console.warn(
            "Local neural voice unavailable; using browser voice.",
            voiceError,
          );
          setStatus("Using browser voice fallback");
        }
      }

      if (!("speechSynthesis" in window)) {
        setStatus("Voice unavailable");
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      const matchingVoices = voices.filter((voice) =>
        voice.lang.toLocaleLowerCase().startsWith(locale.slice(0, 2).toLocaleLowerCase()),
      );
      const preferred =
        matchingVoices.find((voice) =>
          /samantha|serena|ting|sin-ji|meijia|female/i.test(voice.name),
        ) || matchingVoices[0];
      if (preferred) utterance.voice = preferred;
      utterance.lang = locale;
      utterance.rate = ENERGY[energy].rate;
      utterance.pitch = locale.startsWith("zh") ? 0.94 : 0.9;
      utterance.volume = 0.86;
      utterance.onstart = () => {
        setSpeaking(true);
        setStatus("Speaking softly · browser voice");
      };
      utterance.onend = () => {
        setSpeaking(false);
        setStatus("Ready");
      };
      utterance.onerror = () => {
        setSpeaking(false);
        setStatus("Voice unavailable");
      };
      window.speechSynthesis.speak(utterance);
    },
    [energy, locale, quietMode, stopVoice, voices],
  );

  const ask = useCallback(
    (question) => {
      const cleanQuestion = question.trim();
      if (!cleanQuestion) return;
      void mira3dRef.current?.resume?.();
      stopVoice();
      setError("");
      setDraft("");
      setInterim("");
      setStatus("Reading your knowledge");

      const matches = retrieve(cleanQuestion, knowledgeIndex, 3);
      const answer = composeGroundedAnswer(cleanQuestion, matches, locale);
      setSourceMatches(matches);
      setMessages((current) => [
        ...current,
        { role: "user", text: cleanQuestion },
        {
          role: "host",
          text: answer.text,
          confidence: answer.confidence,
          citations: answer.citations,
        },
      ]);
      setStatus("Answer ready");
      window.setTimeout(() => speak(answer.text), 120);
    },
    [knowledgeIndex, locale, speak, stopVoice],
  );

  const startListening = () => {
    setError("");
    void mira3dRef.current?.resume?.();
    if (listening) {
      recognitionRef.current?.stop?.();
      setListening(false);
      setStatus("Ready");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(
        "Live microphone questions are not supported in this browser. Chrome or Edge works best; typing always works.",
      );
      return;
    }

    stopVoice();
    const recognition = new SpeechRecognition();
    recognition.lang = locale;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    let finalTranscript = "";

    recognition.onstart = () => {
      setListening(true);
      mira3dRef.current?.setListening?.(true);
      setStatus("Listening");
    };
    recognition.onresult = (event) => {
      let live = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript;
        if (event.results[index].isFinal) finalTranscript += transcript;
        else live += transcript;
      }
      setInterim(live || finalTranscript);
    };
    recognition.onerror = (event) => {
      const message =
        event.error === "not-allowed"
          ? "Microphone permission was denied. You can enable it in the browser address bar, or type instead."
          : `I couldn’t hear that clearly (${event.error}). Please try again or type your question.`;
      setError(message);
      setListening(false);
      mira3dRef.current?.setListening?.(false);
      setStatus("Ready");
    };
    recognition.onend = () => {
      setListening(false);
      mira3dRef.current?.setListening?.(false);
      setStatus("Ready");
      if (finalTranscript.trim()) ask(finalTranscript);
    };
    recognition.start();
  };

  const ensureBrownNoise = async () => {
    if (audioRef.current) {
      if (audioRef.current.context.state === "suspended") {
        await audioRef.current.context.resume();
      }
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      setError("Ambient audio is not available in this browser.");
      return;
    }
    const context = new AudioContext();
    const seconds = 3;
    const buffer = context.createBuffer(
      1,
      context.sampleRate * seconds,
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
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 950;
    source.buffer = buffer;
    source.loop = true;
    source.connect(filter).connect(gain).connect(context.destination);
    gain.gain.value = 0;
    source.start();
    audioRef.current = { context, source, gain };
  };

  const toggleBrownNoise = async () => {
    await ensureBrownNoise();
    setBrownOn((current) => !current);
  };

  const openKnowledge = () => {
    setKbName(knowledge.name);
    setKbDraft(knowledge.text);
    setDrawer("knowledge");
  };

  const saveKnowledge = () => {
    const text = kbDraft.trim();
    if (text.length < 80) {
      setError("Please add at least a short paragraph so Mira has something reliable to teach.");
      return;
    }
    const name = kbName.trim() || "My knowledge";
    setKnowledge({ id: "custom", name, description: "Your private knowledge", text });
    setMessages([
      {
        role: "host",
        text: `I’ve read “${name}.” Ask me a question, or let me choose one clear idea to begin.`,
        confidence: "high",
        citations: [],
      },
    ]);
    setSourceMatches([]);
    setDrawer(null);
    setError("");
    setStatus("Knowledge ready");
  };

  const chooseSample = (sample) => {
    setKbName(sample.name);
    setKbDraft(sample.text);
  };

  const handleFiles = async (event) => {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    const unsupported = files.find(
      (file) => !FILE_TYPES.some((type) => file.name.toLocaleLowerCase().endsWith(type)),
    );
    if (unsupported) {
      setError(
        `“${unsupported.name}” is not supported in this free browser build. Use TXT, Markdown, CSV, JSON, or HTML.`,
      );
      return;
    }
    const tooLarge = files.find((file) => file.size > 5 * 1024 * 1024);
    if (tooLarge) {
      setError(`“${tooLarge.name}” is over the 5 MB local limit.`);
      return;
    }
    const sections = await Promise.all(
      files.map(async (file) => {
        const content = await file.text();
        if (file.name.toLocaleLowerCase().endsWith(".html")) {
          const parsed = new DOMParser().parseFromString(content, "text/html");
          return `SOURCE: ${file.name}\n\n${parsed.body?.textContent || ""}`;
        }
        return `SOURCE: ${file.name}\n\n${content}`;
      }),
    );
    setKbName(files.length === 1 ? files[0].name : `${files.length} uploaded sources`);
    setKbDraft(sections.join("\n\n---\n\n"));
    setError("");
    event.target.value = "";
  };

  const beginIdea = () => {
    void mira3dRef.current?.resume?.();
    const firstChunk = chunkKnowledge(knowledge.text)[0]?.content;
    if (!firstChunk) return;
    const intro = locale.startsWith("zh")
      ? `我們先安靜地掌握一個重點。${firstChunk}`
      : `Let’s begin with one quiet idea. ${firstChunk}`;
    setMessages((current) => [
      ...current,
      {
        role: "host",
        text: intro,
        confidence: "high",
        citations: ["source-1"],
      },
    ]);
    setSourceMatches([
      {
        id: "source-1",
        content: firstChunk,
        score: 100,
        matchedTerms: [],
      },
    ]);
    speak(intro);
  };

  return (
    <main
      className={`app-shell ${speaking ? "is-speaking" : ""} ${listening ? "is-listening" : ""}`}
    >
      <div className="host-scene" aria-hidden="true">
        <picture className="portrait-fallback">
          <source
            media="(max-width: 720px)"
            srcSet="/assets/mira-study-small.webp"
          />
          <img src="/assets/mira-study.webp" alt="" />
        </picture>
        <div className="mira-3d" ref={miraAvatarRef} />
        <div className="avatar-loader">Loading open-source 3D Mira…</div>
        <div className="host-light" />
      </div>
      <div className="scene-shade" />
      <div className="grain" />

      <header className="topbar">
        <button className="brand" onClick={() => setDrawer("about")}>
          <span className="brand-mark">
            <MoonStar size={18} strokeWidth={1.6} />
          </span>
          <span>
            <strong>Hushlearn</strong>
            <small>quiet knowledge, spoken gently</small>
          </span>
        </button>

        <div className="top-actions">
          <span className="privacy-pill">
            <ShieldCheck size={14} />
            Files stay in this tab
          </span>
          <button className="icon-button" onClick={openKnowledge} aria-label="Open knowledge studio">
            <Library size={19} />
          </button>
          <button
            className="icon-button"
            onClick={() => setDrawer("settings")}
            aria-label="Open settings"
          >
            <Settings2 size={19} />
          </button>
        </div>
      </header>

      <section className="lesson-stage">
        <div className="lesson-column">
          <div className="eyebrow">
            <span className="live-dot" />
            PRIVATE STUDY ROOM
          </div>
          <h1>
            Good evening.
            <span>What should we learn quietly?</span>
          </h1>

          <button className="knowledge-card" onClick={openKnowledge}>
            <span className="knowledge-icon">
              <BookOpen size={21} />
            </span>
            <span>
              <small>SELECTED KNOWLEDGE</small>
              <strong>{knowledge.name}</strong>
              <em>{knowledgeIndex.size} grounded passages</em>
            </span>
            <ChevronRight size={18} />
          </button>

          <div className="answer-card" aria-live="polite">
            <div className="answer-topline">
              <span className="mira-avatar">M</span>
              <span>
                <strong>Mira</strong>
                <small>
                  {speaking ? "speaking softly" : listening ? "listening" : status}
                </small>
              </span>
              <VoiceBars active={speaking} />
            </div>
            <p>{latestHost.text}</p>
            <div className="answer-meta">
              <Confidence level={latestHost.confidence || "high"} />
              {!!latestHost.citations?.length && (
                <button onClick={() => setDrawer("sources")}>
                  {latestHost.citations.map(sourceLabel).join(" · ")} sources
                </button>
              )}
            </div>
          </div>

          <div className="starter-row">
            <button onClick={beginIdea}>
              <Sparkles size={15} />
              Teach me one idea
            </button>
            <button onClick={() => ask("How does sleep help memory?")}>
              <Brain size={15} />
              Try a question
            </button>
          </div>
        </div>

        <div className="host-label">
          <span className="live-dot" />
          <span>
            <strong>Mira</strong>
            <small>real-time 3D · neural viseme lip sync</small>
          </span>
        </div>
      </section>

      <aside className="energy-rail" aria-label="Energy mode">
        <small>YOUR ENERGY</small>
        {Object.entries(ENERGY).map(([key, item]) => (
          <button
            key={key}
            className={energy === key ? "active" : ""}
            onClick={() => setEnergy(key)}
            title={item.hint}
          >
            <span />
            {item.label}
          </button>
        ))}
      </aside>

      <section className="conversation-dock">
        {error && (
          <div className="error-toast" role="alert">
            <Info size={16} />
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="Dismiss message">
              <X size={15} />
            </button>
          </div>
        )}
        {interim && <div className="interim-text">“{interim}”</div>}
        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            ask(draft);
          }}
        >
          <button
            type="button"
            className={`ambient-button ${brownOn ? "active" : ""}`}
            onClick={toggleBrownNoise}
            aria-label={brownOn ? "Turn off brown noise" : "Turn on brown noise"}
            title="Brown noise"
          >
            <Waves size={19} />
          </button>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={listening ? "I’m listening…" : "Ask from your knowledge…"}
            aria-label="Ask Mira a question"
          />
          <button
            type="button"
            className={`mic-button ${listening ? "listening" : ""}`}
            onClick={startListening}
            aria-label={listening ? "Stop listening" : "Ask with microphone"}
          >
            <Mic size={20} />
            <span className="mic-ripple" />
          </button>
          <button
            type="submit"
            className="send-button"
            disabled={!draft.trim()}
            aria-label="Send question"
          >
            <Send size={18} />
          </button>
        </form>
        <div className="dock-caption">
          <span>
            <ShieldCheck size={12} />
            Knowledge files are processed locally
          </span>
          <span>English neural voice runs locally after its first download</span>
        </div>
      </section>

      {drawer && (
        <>
          <button
            className="drawer-backdrop"
            onClick={() => setDrawer(null)}
            aria-label="Close panel"
          />
          <aside className="drawer" role="dialog" aria-modal="true">
            <div className="drawer-header">
              <span>
                {drawer === "knowledge" && <Library size={20} />}
                {drawer === "sources" && <FileText size={20} />}
                {drawer === "settings" && <Settings2 size={20} />}
                {drawer === "about" && <MoonStar size={20} />}
                <strong>
                  {drawer === "knowledge" && "Knowledge studio"}
                  {drawer === "sources" && "Grounding sources"}
                  {drawer === "settings" && "Room settings"}
                  {drawer === "about" && "About Hushlearn"}
                </strong>
              </span>
              <button onClick={() => setDrawer(null)} aria-label="Close panel">
                <X size={19} />
              </button>
            </div>

            {drawer === "knowledge" && (
              <div className="drawer-content knowledge-studio">
                <div className="privacy-note">
                  <ShieldCheck size={18} />
                  <span>
                    <strong>Private by default</strong>
                    Your text is indexed in this browser tab and is not uploaded by
                    Hushlearn.
                  </span>
                </div>
                <label>
                  Knowledge name
                  <input
                    value={kbName}
                    onChange={(event) => setKbName(event.target.value)}
                    placeholder="e.g. Civil procedure notes"
                  />
                </label>
                <div className="sample-label">START WITH A SAMPLE</div>
                <div className="sample-grid">
                  {SAMPLES.map((sample) => (
                    <button
                      key={sample.id}
                      className={kbName === sample.name ? "selected" : ""}
                      onClick={() => chooseSample(sample)}
                    >
                      <span>
                        {sample.id === "sleep" && <MoonStar size={18} />}
                        {sample.id === "contracts" && <BookOpen size={18} />}
                        {sample.id === "focus" && <Gauge size={18} />}
                      </span>
                      <strong>{sample.name}</strong>
                      <small>{sample.description}</small>
                      {kbName === sample.name && <Check className="sample-check" size={15} />}
                    </button>
                  ))}
                </div>
                <div className="upload-row">
                  <button onClick={() => fileInputRef.current?.click()}>
                    <Upload size={17} />
                    Upload local files
                  </button>
                  <span>TXT, MD, CSV, JSON, HTML · 5 MB each</span>
                  <input
                    ref={fileInputRef}
                    hidden
                    multiple
                    type="file"
                    accept={FILE_TYPES.join(",")}
                    onChange={handleFiles}
                  />
                </div>
                <label className="knowledge-textarea">
                  Paste or edit knowledge
                  <textarea
                    value={kbDraft}
                    onChange={(event) => setKbDraft(event.target.value)}
                    placeholder="Paste the source material Mira should use…"
                  />
                  <span>
                    {kbDraft.length.toLocaleString()} characters ·{" "}
                    {chunkKnowledge(kbDraft).length} passages
                  </span>
                </label>
                <button className="primary-action" onClick={saveKnowledge}>
                  <Sparkles size={17} />
                  Let Mira study this
                </button>
              </div>
            )}

            {drawer === "sources" && (
              <div className="drawer-content source-list">
                <p className="drawer-intro">
                  These are the passages used for the latest response. Hushlearn
                  does not invent a response when no passage matches.
                </p>
                {sourceMatches.length ? (
                  sourceMatches.map((source) => (
                    <article key={source.id}>
                      <div>
                        <span>{sourceLabel(source.id)}</span>
                        <Confidence level={source.score > 18 ? "high" : "medium"} />
                      </div>
                      <p>{excerpt(source.content, 560)}</p>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">
                    <FileText size={28} />
                    <strong>No sources used yet</strong>
                    <p>Ask a question to see the passages behind Mira’s answer.</p>
                  </div>
                )}
              </div>
            )}

            {drawer === "settings" && (
              <div className="drawer-content settings-list">
                <section>
                  <div className="setting-heading">
                    <Gauge size={18} />
                    <span>
                      <strong>Energy mode</strong>
                      <small>Changes the pace of spoken answers</small>
                    </span>
                  </div>
                  <div className="segmented">
                    {Object.entries(ENERGY).map(([key, item]) => (
                      <button
                        key={key}
                        className={energy === key ? "active" : ""}
                        onClick={() => setEnergy(key)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </section>
                <section>
                  <div className="setting-heading">
                    <Headphones size={18} />
                    <span>
                      <strong>Speaking language</strong>
                      <small>Local neural English; browser fallback for Chinese</small>
                    </span>
                  </div>
                  <select value={locale} onChange={(event) => setLocale(event.target.value)}>
                    {LANGUAGES.map((language) => (
                      <option key={language.value} value={language.value}>
                        {language.label}
                      </option>
                    ))}
                  </select>
                </section>
                <section>
                  <div className="setting-heading">
                    {brownOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
                    <span>
                      <strong>Brown-noise room tone</strong>
                      <small>Generated locally with Web Audio</small>
                    </span>
                    <button
                      className={`switch ${brownOn ? "active" : ""}`}
                      onClick={toggleBrownNoise}
                      aria-label="Toggle brown noise"
                    >
                      <span />
                    </button>
                  </div>
                  <input
                    className="volume-slider"
                    type="range"
                    min="0.015"
                    max="0.16"
                    step="0.005"
                    value={brownVolume}
                    onChange={(event) => setBrownVolume(Number(event.target.value))}
                    aria-label="Brown noise volume"
                  />
                </section>
                <section>
                  <div className="setting-heading">
                    {quietMode ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    <span>
                      <strong>Text-only quiet mode</strong>
                      <small>Stops Mira from speaking automatically</small>
                    </span>
                    <button
                      className={`switch ${quietMode ? "active" : ""}`}
                      onClick={() => {
                        setQuietMode((current) => !current);
                        stopVoice();
                      }}
                      aria-label="Toggle text-only quiet mode"
                    >
                      <span />
                    </button>
                  </div>
                </section>
              </div>
            )}

            {drawer === "about" && (
              <div className="drawer-content about-panel">
                <span className="about-mark">
                  <MoonStar size={30} />
                </span>
                <h2>Learning at the speed of a tired mind.</h2>
                <p>
                  Hushlearn is a browser-first prototype: a calm digital educator
                  grounded in material you select. The free build uses local
                  retrieval, a real-time Three.js avatar, and phoneme-timed
                  in-browser neural speech.
                </p>
                <div className="capability-list">
                  <span>
                    <Check size={16} /> Typed and microphone questions
                  </span>
                  <span>
                    <Check size={16} /> Source-grounded responses
                  </span>
                  <span>
                    <Check size={16} /> Interruptible spoken answers
                  </span>
                  <span>
                    <Check size={16} /> No API key required
                  </span>
                </div>
                <div className="reality-note">
                  <Info size={18} />
                  <p>
                    English answers use actual 3D facial blendshapes driven by
                    phoneme/viseme timestamps. The first answer downloads the
                    neural voice model; Chinese currently uses the browser voice
                    fallback. Mira remains visibly AI-generated.
                  </p>
                </div>
              </div>
            )}
          </aside>
        </>
      )}

      <div className="sr-only" ref={messageEndRef} />
    </main>
  );
}
