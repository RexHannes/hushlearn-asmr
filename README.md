# Hushlearn

Hushlearn is a calm, avatar-led learning room grounded in material the learner
selects. The hosted demo is deliberately browser-first: it works without an API
key, keeps uploaded text in the current tab, and can be served as a static site.

**Live demo:** <https://rexhannes.github.io/hushlearn-asmr/>

## What works now

- Original, photorealistic adult educator with subtle speaking/idle animation
- Typed questions and microphone questions in supported browsers
- Local ingestion of TXT, Markdown, CSV, JSON, and HTML files
- English and CJK-aware passage retrieval
- Answers assembled from matching source passages, with visible citations
- Browser text-to-speech with English, Cantonese, and Mandarin voice selection
- Interruption: starting the microphone cancels the current spoken answer
- Drained, steady, and focused speaking modes
- Locally generated brown-noise ambience
- Responsive desktop and mobile layouts
- No API key, account, analytics, or server-side file upload

## Important reality check

The free public build animates a still original portrait and uses the browser's
speech services. It does **not** pretend to be frame-by-frame neural lip sync or
a fully local large language model. A true talking-video pipeline requires the
optional GPU services described in [GPU_UPGRADE.md](./GPU_UPGRADE.md).

Hushlearn is an educational host, not a simulated romantic partner. The visual
identity is fictional and the interface is designed for professional learning.

## Run locally

The static build has no dependencies:

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173/>.

The repository also includes an experimental Next.js source tree for the future
server/GPU adapter:

```bash
npm install
npm run dev
```

`npm run build` packages the dependency-free public demo into `dist/` for static
cloud hosting. Use `npm run build:next` to compile the experimental Next.js app.

## How grounding works

1. Text is cleaned and split into bounded passages.
2. English words and CJK characters/bigrams are indexed locally.
3. Query terms are scored with term frequency and inverse document frequency.
4. The best matching sentences are returned with their passage identifiers.
5. If nothing matches, Mira says so instead of inventing an answer.

This lightweight retriever is transparent and private, but it is not a
replacement for a production embedding model or a source-grounded LLM.

## Browser support

Typed questions, local retrieval, and brown noise work in current evergreen
browsers. Browser speech recognition is most reliable in Chrome and Edge and may
use the browser vendor's speech service. Available text-to-speech voices depend
on the operating system and browser.

## Repository map

- `index.html` / `static-app.js` — dependency-free public demo
- `app/` / `components/` — experimental Next.js interface
- `lib/knowledge.js` — local chunking, CJK-aware retrieval, grounded response
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

Code is MIT licensed. The original Mira portrait is separately licensed under
CC BY 4.0; see [ASSET_LICENSE.md](./ASSET_LICENSE.md).
