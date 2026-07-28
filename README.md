# Hushlearn

Hushlearn is a calm, 3D-avatar-led learning room grounded in material the
learner selects. The hosted demo is browser-first: it works without an API key,
keeps uploaded text in the current tab, and can be served as a static site.

**Live demo:** <https://rexhannes.github.io/hushlearn-asmr/>

## What works now

- Real-time 3D adult educator with blinking, gaze, and natural idle/head motion
- Phoneme-timed facial blendshape lip sync for English answers
- Local Kokoro neural speech through HeadTTS after a one-time model download
- Typed questions and microphone questions in supported browsers
- Local ingestion of TXT, Markdown, CSV, JSON, and HTML files
- English and CJK-aware passage retrieval
- Answers assembled from matching source passages, with visible citations
- Browser-voice fallback for Cantonese, Mandarin, or unsupported neural speech
- Interruption: starting the microphone cancels the current spoken answer
- Drained, steady, and focused speaking modes
- Locally generated brown-noise ambience
- Responsive desktop and mobile layouts
- No API key, account, analytics, or server-side file upload

## Important reality check

The free public build uses
[TalkingHead](https://github.com/met4citizen/TalkingHead) for the rigged Three.js
avatar and [HeadTTS](https://github.com/met4citizen/HeadTTS) for in-browser
English neural speech with phoneme/viseme timestamps. The face is genuinely
animated through 3D morph targets; the page is not moved or shaken.

This is still a stylized 3D avatar, not photorealistic generated video, and the
lightweight grounded answer composer is not a local large language model. A
photorealistic talking-video or full local speech-to-speech pipeline requires
the optional GPU services described in [GPU_UPGRADE.md](./GPU_UPGRADE.md).

Hushlearn is an educational host, not a simulated romantic partner. The visual
identity is fictional and the interface is designed for professional learning.

## Run locally

The static build uses pinned browser modules from jsDelivr:

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173/>.

The repository also includes a vinext-compatible App Router source tree for the
managed Sites deployment and future server/GPU adapter:

```bash
npm install
npm run dev
```

`npm run build` produces the Cloudflare Worker-compatible vinext bundle.
`npm run build:static` packages the public demo into `dist/`.

## How grounding works

1. Text is cleaned and split into bounded passages.
2. English words and CJK characters/bigrams are indexed locally.
3. Query terms are scored with term frequency and inverse document frequency.
4. The best matching sentences are returned with their passage identifiers.
5. If nothing matches, Mira says so instead of inventing an answer.

This lightweight retriever is transparent and private, but it is not a
replacement for a production embedding model or a source-grounded LLM.

## Browser support

Typed questions, local retrieval, 3D rendering, and brown noise work in current
evergreen browsers with WebGL. The English neural voice prefers WebGPU and falls
back to WASM; its first use downloads model files and can take tens of seconds.
Browser speech recognition is most reliable in Chrome and Edge and may use the
browser vendor's speech service. Chinese output currently uses an installed
browser voice.

## Repository map

- `index.html` / `static-app.js` — static public demo
- `app/` / `components/` — experimental Next.js interface
- `lib/knowledge.js` — local chunking, CJK-aware retrieval, grounded response
- `lib/mira-3d.js` — TalkingHead + HeadTTS lifecycle and interruption adapter
- `lib/knowledge.test.mjs` — retrieval tests
- `public/assets/` — original generated host portraits
- `GPU_UPGRADE.md` — local speech-to-speech and neural-avatar plan
- `DEPLOYMENT.md` — hosting and operational notes
- `SECURITY.md` — privacy and security boundaries

## Validation

```bash
node --test
node --check static-app.js
```

The rebuild was checked at 1440×1000 and 390×844. The tested flows include
question answering, source inspection, sample selection, responsive layout, and
console-error monitoring.

## License

Code is MIT licensed. The fallback portrait is separately licensed under CC BY
4.0; see [ASSET_LICENSE.md](./ASSET_LICENSE.md). The Ready Player Me 3D example
avatar is CC BY-NC 4.0 and therefore non-commercial only. See
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
