const HEAD_TTS_BASE =
  "https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3.0";
const TALKING_HEAD_MODULE =
  "https://cdn.jsdelivr.net/npm/@met4citizen/talkinghead@1.7.0/+esm";
const LIPSYNC_EN_MODULE =
  "https://cdn.jsdelivr.net/npm/@met4citizen/talkinghead@1.7.0/modules/lipsync-en.mjs";
const HEAD_TTS_MODULE =
  "https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3.0/+esm";

// Rights-safe open-source base: created with MPFB/MakeHuman and published CC0
// by the TalkingHead project. It is intentionally pinned to an upstream commit.
// This is a realistic technical base, not the likeness of the reference person.
export const OPEN_SOURCE_MIRA_URL =
  "https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@eed58d198076a7e1e825f804802921c4d3804d46/avatars/mpfb.glb";

const REQUIRED_VISEMES = [
  "viseme_sil",
  "viseme_PP",
  "viseme_FF",
  "viseme_TH",
  "viseme_DD",
  "viseme_kk",
  "viseme_CH",
  "viseme_SS",
  "viseme_nn",
  "viseme_RR",
  "viseme_aa",
  "viseme_E",
  "viseme_I",
  "viseme_O",
  "viseme_U",
];

const REQUIRED_FACE_SHAPES = [
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "eyeLookUpLeft",
  "eyeLookUpRight",
  "jawOpen",
  "mouthClose",
  "mouthFunnel",
  "mouthPucker",
  "mouthSmileLeft",
  "mouthSmileRight",
  "browInnerUp",
  "cheekSquintLeft",
  "cheekSquintRight",
];

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

function renderProfile() {
  const mobile = window.matchMedia?.("(max-width: 820px)")?.matches;
  const reducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;
  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.2 : 1.65);

  return {
    modelFPS: reducedMotion ? 24 : mobile ? 30 : 42,
    modelPixelRatio: dpr,
    modelMovementFactor: reducedMotion ? 0.16 : 0.34,
    cameraDistance: mobile ? 0.055 : 0.035,
    cameraY: mobile ? 0.025 : 0.018,
    cameraRotateX: -0.012,
  };
}

function requestedAvatarUrl(legacyUrl) {
  const requested = new URLSearchParams(window.location.search).get("avatar");
  if (!requested || requested === "open-source") return OPEN_SOURCE_MIRA_URL;
  if (requested === "legacy") return legacyUrl;

  // Custom models are allowed only from the current origin. This prevents a
  // shared URL from silently contacting an arbitrary third-party host.
  try {
    const url = new URL(requested, window.location.href);
    if (url.origin === window.location.origin && /\.glb$/i.test(url.pathname)) {
      return url.href;
    }
  } catch {
    // Invalid query values simply fall back to the open-source model.
  }
  return OPEN_SOURCE_MIRA_URL;
}

function inspectRig(head) {
  const names = new Set();
  for (const mesh of head?.morphs || []) {
    for (const name of Object.keys(mesh.morphTargetDictionary || {})) {
      names.add(name);
    }
  }

  const missingVisemes = REQUIRED_VISEMES.filter((name) => !names.has(name));
  const missingFaceShapes = REQUIRED_FACE_SHAPES.filter(
    (name) => !names.has(name),
  );
  return {
    morphTargetCount: names.size,
    visemeReady: missingVisemes.length === 0,
    faceReady: missingFaceShapes.length === 0,
    missingVisemes,
    missingFaceShapes,
  };
}

async function loadAvatar(head, node, options, notifyStatus) {
  const legacyUrl = options.avatarUrl;
  const preferredUrl =
    options.preferOpenSourcePhotoreal === false
      ? legacyUrl
      : requestedAvatarUrl(legacyUrl);
  const candidates = [
    {
      url: preferredUrl,
      mode:
        preferredUrl === OPEN_SOURCE_MIRA_URL
          ? "open-source-realistic"
          : preferredUrl === legacyUrl
            ? "legacy"
            : "custom",
      label:
        preferredUrl === OPEN_SOURCE_MIRA_URL
          ? "Loading realistic open-source Mira"
          : "Loading 3D Mira",
    },
  ];

  if (legacyUrl && preferredUrl !== legacyUrl) {
    candidates.push({
      url: legacyUrl,
      mode: "legacy-fallback",
      label: "Loading lightweight fallback Mira",
    });
  }

  let lastError = null;
  for (const candidate of candidates) {
    try {
      notifyStatus(`${candidate.label}…`);
      await head.showAvatar(
        {
          url: candidate.url,
          body: "F",
          avatarMood: "neutral",
          lipsyncLang: "en",
          avatarIdleEyeContact: 0.66,
          avatarIdleHeadMove: 0.17,
          avatarListeningEyeContact: 0.86,
          avatarSpeakingEyeContact: 0.82,
          avatarSpeakingHeadMove: 0.23,
          baseline: {
            headRotateX: -0.025,
            eyeBlinkLeft: 0.045,
            eyeBlinkRight: 0.055,
            mouthSmileLeft: 0.012,
            mouthSmileRight: 0.009,
          },
        },
        (event) => notifyStatus(progressLabel(candidate.label, event)),
      );
      node.dataset.avatarMode = candidate.mode;
      node.dataset.avatarUrl = candidate.url;
      return candidate;
    } catch (error) {
      lastError = error;
      console.warn(`Mira avatar candidate failed (${candidate.mode}).`, error);
    }
  }
  throw lastError || new Error("No compatible Mira avatar could be loaded.");
}

/**
 * Mount Mira's open-source 3D runtime.
 *
 * TalkingHead supplies the Three.js avatar rig, blinking, gaze, head movement,
 * and viseme animation. HeadTTS supplies an in-browser Kokoro voice together
 * with phoneme/viseme timestamps. The neural voice is loaded lazily on the
 * first English answer so the interface and avatar appear quickly.
 *
 * The default visual base is an MPFB/MakeHuman CC0 model from the TalkingHead
 * repository. It is a fictional adult character and does not reproduce the
 * identity of any reference photograph.
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
  let loadedAvatar = null;

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

    notifyStatus("Preparing cinematic 3D Mira…");
    const [{ TalkingHead }, { LipsyncEn }] = await Promise.all([
      import(/* @vite-ignore */ TALKING_HEAD_MODULE),
      import(/* @vite-ignore */ LIPSYNC_EN_MODULE),
    ]);
    if (destroyed) return null;

    const profile = renderProfile();
    head = new TalkingHead(node, {
      cameraView: "head",
      cameraDistance: profile.cameraDistance,
      cameraY: profile.cameraY,
      cameraRotateX: profile.cameraRotateX,
      cameraRotateEnable: false,
      cameraPanEnable: false,
      cameraZoomEnable: false,
      modelFPS: profile.modelFPS,
      modelPixelRatio: profile.modelPixelRatio,
      modelMovementFactor: profile.modelMovementFactor,
      // A warm key, neutral fill, and cool rim light retain skin texture and
      // facial volume. The previous near-flat intensities made the mesh appear
      // waxy and game-like.
      lightAmbientColor: 0xfff3e8,
      lightAmbientIntensity: 2.35,
      lightDirectColor: 0xffd8bf,
      lightDirectIntensity: 28,
      lightDirectPhi: 0.78,
      lightDirectTheta: 1.15,
      lightSpotColor: 0xa8c7dd,
      lightSpotIntensity: 6.5,
      lightSpotPhi: 0.44,
      lightSpotTheta: 4.78,
      lightSpotDispersion: 0.72,
      avatarIdleEyeContact: 0.66,
      avatarIdleHeadMove: 0.17,
      avatarSpeakingEyeContact: 0.82,
      avatarSpeakingHeadMove: 0.23,
      lipsyncModules: [],
    });
    head.lipsync.en = new LipsyncEn();

    loadedAvatar = await loadAvatar(head, node, options, notifyStatus);
    if (destroyed) return null;

    head.setView("head", {
      cameraDistance: profile.cameraDistance,
      cameraY: profile.cameraY,
      cameraRotateX: profile.cameraRotateX,
      cameraRotateY: -0.018,
    });
    head.setLighting?.({
      lightAmbientColor: 0xfff3e8,
      lightAmbientIntensity: 2.35,
      lightDirectColor: 0xffd8bf,
      lightDirectIntensity: 28,
      lightDirectPhi: 0.78,
      lightDirectTheta: 1.15,
      lightSpotColor: 0xa8c7dd,
      lightSpotIntensity: 6.5,
      lightSpotPhi: 0.44,
      lightSpotTheta: 4.78,
      lightSpotDispersion: 0.72,
    });

    const rig = inspectRig(head);
    node.dataset.rigFaceReady = String(rig.faceReady);
    node.dataset.rigVisemeReady = String(rig.visemeReady);
    node.dataset.morphTargets = String(rig.morphTargetCount);
    node.classList.add("ready");

    const qualityLabel =
      loadedAvatar.mode === "open-source-realistic"
        ? "Open-source realistic 3D ready"
        : loadedAvatar.mode === "custom"
          ? "Custom 3D avatar ready"
          : "3D fallback ready";
    const rigLabel = rig.visemeReady ? "full viseme rig" : "compatible lip sync";
    notifyStatus(`${qualityLabel} · ${rigLabel}`);
    notifyReady(head, { avatar: loadedAvatar, rig });
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
        head.makeEyeContact(2600);
        head.lookAtCamera(720);
      } else {
        head.lookAhead(820);
      }
    },

    getDiagnostics() {
      return {
        avatar: loadedAvatar,
        rig: inspectRig(head),
        speaking,
        visemePeak,
      };
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
