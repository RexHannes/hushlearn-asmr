# Mira — production avatar pipeline

This document defines the rights-safe path from the current open-source 3D base
to a high-fidelity fictional Hong Kong adult educator. The visual brief may use
broad styling cues from an editorial photograph—long dark hair, fine round
metal glasses, natural makeup, calm expression, and a contemporary Hong Kong
interior—but must not reproduce the photographed person's identity.

## Current checkpoint

The browser runtime now defaults to the CC0 `mpfb.glb` example published by the
TalkingHead project and keeps the former Ready Player Me model only as a network
or compatibility fallback. The renderer uses:

- a warm key, soft neutral fill, and cool rim light;
- a restrained head-motion profile and higher-quality desktop pixel ratio;
- close portrait camera framing;
- asymmetric eyelid and mouth baselines to avoid a perfectly mirrored face;
- automatic checks for Oculus visemes and essential ARKit facial targets;
- a visible fictional-AI disclosure;
- a `?avatar=legacy` recovery route and a same-origin custom-GLB route.

This is a meaningful improvement over a stylized game avatar. It is not yet a
film-quality digital human: geometry, skin microdetail, eyes, hair, and wardrobe
must be authored specifically for Mira.

## Character specification

Mira is a fictional Hong Kong woman, age 25. She must not be generated from a
single identifiable person's photograph.

Target design:

- adult East Asian facial proportions without matching a real individual;
- natural asymmetry in brows, eyelids, nasolabial folds, lips, and jaw;
- dark brown irises with separate cornea, sclera, tear-line, and occlusion mesh;
- shoulder-length or long black hair built from layered hair cards or curves;
- thin round metal glasses with separate clear-lens material;
- restrained natural makeup and visible but subtle skin texture;
- smart-casual Hong Kong educator wardrobe, avoiding school-uniform styling;
- neutral, attentive default expression rather than a fixed smile.

## Authoring stack

1. **Base human:** MPFB / MakeHuman CC0 assets in Blender.
2. **Sculpt:** Blender multiresolution or a compatible sculpting package.
3. **Texture:** Substance 3D Painter, Blender, or another licensed PBR workflow.
4. **Face rig:** ARKit 52 blendshapes plus Oculus 15 visemes.
5. **Body rig:** Mixamo-compatible hierarchy rooted at `Armature`.
6. **Hair:** Blender hair curves converted to optimized cards, with optional
   TalkingHead dynamic bones for a small number of guide chains.
7. **Export:** glTF 2.0 binary (`.glb`) with physically based materials.
8. **Optimization:** glTF-Transform meshopt compression and WebP/AVIF textures.
9. **Runtime:** TalkingHead + HeadTTS, or the GPU video path described below.

The open-source ARKitBlendshapeHelper add-on can automate creation of named
ARKit shape keys from an existing facial rig. It does not replace manual
anatomical review: every expression must be checked for eyelid penetration,
lip sealing, teeth exposure, cheek volume, and left/right asymmetry.

## Geometry and texture budget

Desktop target:

- 80,000–140,000 rendered triangles for head, hair, glasses, and upper torso;
- 4K source skin texture, delivered as 2K for the browser;
- separate base-colour, normal, roughness, and ambient-occlusion maps;
- 2K eye and hair atlases where visually justified;
- no more than 8–10 draw calls in the portrait view;
- compressed GLB target below 18 MB, hard ceiling 25 MB.

Mobile target:

- 45,000–75,000 rendered triangles;
- 1K–2K texture set;
- compressed GLB target below 10 MB;
- 30 FPS floor on a representative mid-range device.

## Skin and eye requirements

Browser PBR cannot reproduce an offline path tracer, but the following prevent
the most common synthetic look:

- skin roughness variation at pore, T-zone, lip, and eyelid scales;
- tangent-space normal detail that remains subtle at conversational distance;
- no metallic skin values;
- separate wetness/tear-line geometry;
- corneal bulge and controlled specular highlights;
- soft eye occlusion instead of painted black eyelids;
- real mouth cavity, gums, tongue, and individually shaded teeth;
- no baked frontal light in the albedo map.

## Facial-animation acceptance gates

A release candidate must pass all of the following:

1. All 52 ARKit names exist or have a documented equivalent.
2. All 15 Oculus visemes exist and produce distinct silhouettes.
3. `viseme_PP` fully closes both lips without clipping.
4. `viseme_FF` exposes the upper teeth against the lower lip.
5. `viseme_TH` can show a restrained tongue tip.
6. Blink targets close the eyelids over the eyeball without flattening the eye.
7. Eye-look targets do not expose gaps at the eyelids.
8. Jaw opening preserves cheek volume and does not stretch the neck texture.
9. Speech at 0.7×, 0.9×, and 1.1× rates remains stable.
10. Idle motion avoids repetitive nodding, fixed eye contact, and perfect
    bilateral symmetry.

## Browser delivery

Before deployment:

```bash
gltf-transform optimize mira-source.glb mira-optimized.glb \
  --compress meshopt \
  --texture-compress webp
```

Then run a structural audit that checks:

- GLB parses without warnings;
- no external texture URLs;
- required bones and blendshape names are present;
- texture dimensions are powers of two where appropriate;
- no hidden high-poly meshes remain;
- no personal metadata, source-photo filenames, or embedded author paths;
- model and every accessory have recorded licenses.

Place the final model at `public/assets/mira-photoreal.glb`, then test it by
opening the site with:

```text
?avatar=/assets/mira-photoreal.glb
```

Only after the audit should the custom file replace the CC0 default URL.

## Film-quality alternative

For a result closer to live-action video than browser 3D, keep the same frontend
contract but render Mira on a GPU service:

```text
Qwen3-TTS audio
  → LivePortrait or MuseTalk facial animation
  → LiveTalking/WebRTC stream
```

That route can produce more convincing skin, hair, and micro-expression than a
small WebGL GLB, but it is a neural video avatar rather than a freely rotatable
3D human. It also introduces GPU cost, queueing, latency, and stricter consent
and asset-governance requirements.

## Prohibited inputs and claims

- Do not texture, train, or reconstruct Mira from the supplied editorial image.
- Do not claim that Mira is the person shown in any reference photograph.
- Do not clone a real person's voice without explicit permission.
- Do not describe the current open-source base as a unique Hong Kong likeness.
- Do not ship marketplace assets to a public client unless their license permits
  redistribution in downloadable form.
