const HEAD_TTS_BASE =
  "https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3.0";
const TALKING_HEAD_MODULE =
  "https://cdn.jsdelivr.net/npm/@met4citizen/talkinghead@1.7.0/+esm";
const LIPSYNC_EN_MODULE =
  "https://cdn.jsdelivr.net/npm/@met4citizen/talkinghead@1.7.0/modules/lipsync-en.mjs";
const HEAD_TTS_MODULE =
  "https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3.0/+esm";

function progressLabel(prefix, event) {
  if (event?.lengthComputable && event.total > 0) {
    return `${prefix} ${Math.round((event.loaded / event.total) * 100)}%`;
  }
  return `${prefix}…`;
}

function errorMessage(error) {
  if (typeof error === "string") return error;
  return error?.message || error?.data?.error || "Unknown avatar error";
}

/**
 * Mount Mira's open-source 3D runtime.
 *
 * TalkingHead supplies the Three.js avatar rig, blinking, gaze, head movement,
 * and viseme animation. HeadTTS supplies an in-browser Kokoro voice together
 * with phoneme/viseme timestamps. The neural voice model is loaded lazily on
 * the first English answer so the interface and avatar appear quickly.
 */
export function mountMira3D(node, options = {}) {
  const notifyStatus = options.onStatus || (() => {});
  const notifyReady = options.onReady || (() => {});
  const notifySpeaking = options.onSpeakingChange || (() => {});
  const notifyError = options.onError || (() => {});

  let head = null;
  let tts = null;
  let ttsPromise = null;
  let destroyed = false;
  let speaking = false;
  let speechToken = 0;
  let visemePeak = 0;
  let visemeMonitor = null;

  const setSpeaking = (active) => {
    if (speaking === active) return;
    speaking = active;
    notifySpeaking(active);
  };

  const fail = (error) => {
    const message = errorMessage(error);
    console.error("Mira 3D:", error);
    notifyError(message);
    return error;
  };

  const sampleVisemes = () => {
    const visemeInfluences = [];
    for (const mesh of head?.morphs || []) {
      for (const [name, index] of Object.entries(
        mesh.morphTargetDictionary || {},
      )) {
        if (name.startsWith("viseme_")) {
          visemeInfluences.push(
            Math.abs(mesh.morphTargetInfluences?.[index] || 0),
          );
        }
      }
    }
    const visemeStrength = Math.max(0, ...visemeInfluences);
    visemePeak = Math.max(visemePeak, visemeStrength);
    node.dataset.visemeStrength = visemeStrength.toFixed(3);
    node.dataset.visemePeak = visemePeak.toFixed(3);
  };

  const startVisemeMonitor = () => {
    if (visemeMonitor) return;
    visemeMonitor = window.setInterval(sampleVisemes, 16);
  };

  const stopVisemeMonitor = () => {
    if (!visemeMonitor) return;
    window.clearInterval(visemeMonitor);
    visemeMonitor = null;
    sampleVisemes();
  };

  const ready = (async () => {
    if (!node) throw new Error("Mira's 3D stage was not found.");

    notifyStatus("Loading open-source 3D Mira…");
    const [{ TalkingHead }, { LipsyncEn }] = await Promise.all([
      import(/* @vite-ignore */ TALKING_HEAD_MODULE),
      import(/* @vite-ignore */ LIPSYNC_EN_MODULE),
    ]);
    if (destroyed) return null;

    head = new TalkingHead(node, {
      cameraView: "head",
      cameraDistance: 0.02,
      modelFPS: 30,
      modelPixelRatio: 1,
      lightAmbientIntensity: 1.2,
      lightDirectIntensity: 1.4,
      lightSpotIntensity: 0.4,
      avatarIdleEyeContact: 0.58,
      avatarIdleHeadMove: 0.25,
      avatarSpeakingEyeContact: 0.78,
      avatarSpeakingHeadMove: 0.34,
      // HeadTTS supplies timestamped visemes directly, so TalkingHead does not
      // need to fetch its optional word-to-viseme language plug-ins.
      lipsyncModules: [],
    });
    head.lipsync.en = new LipsyncEn();

    await head.showAvatar(
      {
        url: options.avatarUrl,
        body: "F",
        avatarMood: "neutral",
        lipsyncLang: "en",
        avatarIdleEyeContact: 0.62,
        avatarIdleHeadMove: 0.25,
        avatarSpeakingEyeContact: 0.8,
        avatarSpeakingHeadMove: 0.34,
      },
      (event) => notifyStatus(progressLabel("Loading 3D Mira", event)),
    );

    if (destroyed) return null;
    head.setView("head", { cameraDistance: 0.02, cameraY: 0.02 });
    node.classList.add("ready");
    notifyStatus("3D ready · neural voice loads on first answer");
    notifyReady(head);
    return head;
  })().catch((error) => {
    fail(error);
    return null;
  });

  const ensureTts = async () => {
    await ready;
    if (!head) throw new Error("The 3D avatar is unavailable.");
    if (tts) return tts;
    if (ttsPromise) return ttsPromise;

    ttsPromise = (async () => {
      notifyStatus("Loading local neural voice (first time only)…");
      const { HeadTTS } = await import(/* @vite-ignore */ HEAD_TTS_MODULE);
      if (destroyed) throw new Error("Avatar was closed.");

      const engine = new HeadTTS({
        endpoints: navigator.gpu ? ["webgpu", "wasm"] : ["wasm"],
        audioCtx: head.audioCtx,
        languages: ["en-us"],
        voices: ["af_bella"],
        dtypeWebgpu: "q8",
        dtypeWasm: "q4",
        workerModule: `${HEAD_TTS_BASE}/modules/worker-tts.mjs`,
        dictionaryURL: `${HEAD_TTS_BASE}/dictionaries/`,
      });

      engine.onmessage = (message) => {
        if (destroyed) return;
        if (message.type === "audio") {
          setSpeaking(true);
          notifyStatus("Speaking softly · phoneme lip sync");
          head.speakAudio(message.data, { lipsyncLang: "en" });
          startVisemeMonitor();
        } else if (
          message.type === "error" &&
          !String(message.data?.error || "").includes("Cancelled")
        ) {
          fail(message.data?.error || message);
        }
      };
      engine.onerror = (error) => fail(error);

      await engine.connect(
        null,
        (event) =>
          notifyStatus(progressLabel("Loading local neural voice", event)),
      );
      await engine.setup({
        voice: "af_bella",
        language: "en-us",
        speed: 0.9,
        audioEncoding: "wav",
      });

      if (destroyed) throw new Error("Avatar was closed.");
      tts = engine;
      notifyStatus("3D + neural lip sync ready");
      return engine;
    })().catch((error) => {
      ttsPromise = null;
      fail(error);
      throw error;
    });

    return ttsPromise;
  };

  const waitForSpeechEnd = async (token) => {
    let wasActive = false;
    let idleTicks = 0;

    await new Promise((resolve) => {
      const timer = window.setInterval(() => {
        if (destroyed || token !== speechToken) {
          window.clearInterval(timer);
          resolve();
          return;
        }

        const active =
          Boolean(head?.isSpeaking) ||
          Boolean(head?.isAudioPlaying) ||
          Boolean(head?.speechQueue?.length);
        sampleVisemes();

        if (active) {
          wasActive = true;
          idleTicks = 0;
          return;
        }

        if (wasActive) idleTicks += 1;
        if (wasActive && idleTicks >= 5) {
          window.clearInterval(timer);
          stopVisemeMonitor();
          resolve();
        }
      }, 100);
    });
  };

  const controller = {
    ready,

    async resume() {
      if (head?.audioCtx?.state === "suspended") {
        await head.audioCtx.resume();
      }
    },

    async speak(text, settings = {}) {
      if (!text?.trim()) return;
      if (
        settings.locale &&
        !settings.locale.toLowerCase().startsWith("en")
      ) {
        const unsupported = new Error(
          "The local neural lip-sync voice currently supports English only.",
        );
        unsupported.code = "unsupported-language";
        throw unsupported;
      }

      const token = ++speechToken;
      controller.stop(false);
      speechToken = token;
      await controller.resume();
      const engine = await ensureTts();
      if (destroyed || token !== speechToken) return;

      visemePeak = 0;
      node.dataset.visemeStrength = "0.000";
      node.dataset.visemePeak = "0.000";
      await controller.resume();
      await engine.setup({
        voice: "af_bella",
        language: "en-us",
        speed: Math.min(1.2, Math.max(0.55, settings.rate || 0.9)),
        audioEncoding: "wav",
      });
      notifyStatus("Preparing neural voice + visemes…");
      await engine.synthesize({ input: text });
      await waitForSpeechEnd(token);

      if (!destroyed && token === speechToken) {
        setSpeaking(false);
        notifyStatus("Ready");
      }
    },

    stop(incrementToken = true) {
      if (incrementToken) speechToken += 1;
      try {
        tts?.clear();
      } catch {
        // The engine may still be loading.
      }
      head?.stopSpeaking?.();
      stopVisemeMonitor();
      setSpeaking(false);
    },

    setListening(active) {
      if (!head) return;
      if (active) {
        head.setMood("neutral");
        head.makeEyeContact(2400);
        head.lookAtCamera(600);
      } else {
        head.lookAhead(700);
      }
    },

    async destroy() {
      destroyed = true;
      speechToken += 1;
      stopVisemeMonitor();
      setSpeaking(false);
      try {
        tts?.clear();
        tts?.ww?.terminate?.();
        tts?.ws?.close?.();
      } catch {
        // Best-effort cleanup during page navigation.
      }
      const audioContext = head?.audioCtx;
      head?.dispose?.();
      if (audioContext && audioContext.state !== "closed") {
        await audioContext.close().catch(() => {});
      }
      node?.classList.remove("ready");
    },
  };

  return controller;
}
