# GPU upgrade path

The free Hushlearn demo is intentionally browser-first. It uses a lightweight
canvas living-portrait renderer for breathing, listening, and speaking motion.
This document defines a replaceable backend for neural portrait animation
and a fully local or GPU-hosted voice pipeline without coupling the interface to
one vendor.

## Target pipeline

```text
microphone
   ↓
Silero VAD
   ↓
whisper.cpp
   ↓
retrieval + llama.cpp
   ↓
Qwen3-TTS
   ↓
LivePortrait / MuseTalk / LiveTalking
   ↓
WebRTC audio + video
```

Recommended upstream projects:

- [Silero VAD](https://github.com/snakers4/silero-vad) for speech boundaries
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp) for local transcription
- [llama.cpp](https://github.com/ggml-org/llama.cpp) for a local grounded model
- [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS) for expressive multilingual speech
- [LivePortrait](https://github.com/KlingAIResearch/LivePortrait) for portrait motion and retargeting
- [MuseTalk](https://github.com/TMElyralab/MuseTalk) for neural lip synchronization
- [LiveTalking](https://github.com/lipku/LiveTalking) for interactive streaming

Check each project's current model and code licenses before redistribution. Code
licenses and model-weight licenses are not always the same.

## Adapter contract

The first backend should expose only three application-facing operations:

```text
POST /v1/sessions
WS   /v1/sessions/{id}/events
POST /v1/sessions/{id}/knowledge
```

The WebSocket event stream should accept:

```json
{ "type": "audio.append", "pcm16": "base64…" }
{ "type": "response.cancel" }
{ "type": "question.text", "text": "…" }
```

And emit:

```json
{ "type": "speech.started" }
{ "type": "transcript.final", "text": "…" }
{ "type": "answer.delta", "text": "…", "sourceIds": ["S2"] }
{ "type": "audio.delta", "pcm16": "base64…" }
{ "type": "video.track", "webrtc": true }
{ "type": "response.done" }
```

Keeping this contract narrow lets the frontend run against:

- a Mac-local backend;
- a student desktop with an NVIDIA GPU;
- a temporary GPU job;
- or a dedicated production GPU later.

## Local-first milestone

Start with audio only:

1. Run Silero VAD and whisper.cpp locally.
2. Retrieve relevant passages before invoking llama.cpp.
3. Require source identifiers in the model's structured output.
4. Generate Qwen3-TTS audio in short streaming segments.
5. Measure interruption latency and time-to-first-audio.

Add the avatar only after the audio loop feels responsive. Video generation can
hide neither long transcription waits nor an ungrounded answer.

## Neural-avatar milestone

The generated Mira portrait is suitable as a visual prototype, but a production
avatar model needs a separate consented training/animation asset set. Do not use
the screenshot reference or any real person's likeness as training input.

For MuseTalk or LiveTalking:

- generate a dedicated neutral source video or permitted portrait sequence;
- retain a visible disclosure that Mira is AI-generated;
- implement immediate `response.cancel` on voice activity;
- cap session length and GPU concurrency;
- record latency, dropped frames, and queue time;
- never clone a person's voice without explicit permission.

## Knowledge safety

A production LLM should receive only the top retrieved passages and must return
source identifiers. Reject or repair any answer whose citations do not exist in
the retrieval result. For legal, medical, or financial material, label the
experience educational and require the user to review the source text directly.

## Free versus paid

Static hosting can remain free. Continuous neural speech and lip-synchronized
video consume GPU time and cannot be promised as permanently free. Use
scale-to-zero jobs for experiments and move to a dedicated GPU only after
measuring whether the avatar materially improves learning outcomes.
