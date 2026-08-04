# Third-party notices

Hushlearn's 3D demo uses the following open-source software and avatar assets.
Mira is a fictional adult AI educator and is not intended to reproduce the
identity of any real person.

## TalkingHead

- Project: [met4citizen/TalkingHead](https://github.com/met4citizen/TalkingHead)
- Copyright © 2023–2026 Mika Suominen
- License: [MIT](https://github.com/met4citizen/TalkingHead/blob/main/LICENSE)
- Use: Three.js avatar loading, rendering, blinking, gaze, head motion, facial
  blendshapes, and timed viseme animation

## HeadTTS

- Project: [met4citizen/HeadTTS](https://github.com/met4citizen/HeadTTS)
- Copyright © 2025 Mika Suominen
- License: [MIT](https://github.com/met4citizen/HeadTTS/blob/main/LICENSE)
- Use: local browser inference and phoneme/viseme timestamps for English speech

HeadTTS loads the timestamped Kokoro ONNX model and its selected voice through
the Hugging Face infrastructure configured by the upstream project. Model and
voice files retain their upstream licenses.

## Three.js

- Project: [mrdoob/three.js](https://github.com/mrdoob/three.js)
- Copyright © 2010–2026 Three.js authors
- License: [MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE)
- Use: WebGL 3D rendering

## Default MPFB / MakeHuman avatar

- Upstream file: `avatars/mpfb.glb`
- Source distribution:
  [TalkingHead example avatars](https://github.com/met4citizen/TalkingHead/tree/main/avatars)
- Generation stack: MPFB / MakeHuman assets and Blender
- License: CC0, as stated in the TalkingHead project notices
- Delivery: loaded from a commit-pinned jsDelivr URL
- Changes in Hushlearn: camera, lighting, rendering quality, idle behaviour,
  rig validation, and presentation only; no claim is made that the model is the
  likeness of the editorial-photo subject or any other real person

## Legacy Ready Player Me fallback

- File in this repository: `public/assets/mira-3d.glb`
- Original example filename: `brunette.glb`
- Creator service: Ready Player Me
- Source distribution:
  [TalkingHead example avatars](https://github.com/met4citizen/TalkingHead/tree/main/avatars)
- License:
  [Creative Commons Attribution-NonCommercial 4.0 International](https://creativecommons.org/licenses/by-nc/4.0/)
- Changes: renamed for Hushlearn; no mesh, texture, or rig modifications

The legacy fallback is permitted only for non-commercial use. It must not become
the production default in a commercial deployment. The CC0 MPFB base avoids
that particular restriction, but every future clothing, hair, texture, glasses,
and environment asset still requires its own provenance and license review.
