# Deployment

## Current public build

The root of this repository is a dependency-free static site. GitHub Pages can
serve it directly from the `main` branch:

<https://rexhannes.github.io/hushlearn-asmr/>

No environment variables or secrets are required.

## Local preview

```bash
python3 -m http.server 4173
```

Open <http://localhost:4173/>.

Do not double-click `index.html`: browsers commonly block ES module imports from
`file://` URLs. A local HTTP server avoids that restriction.

## Cache policy

The demo does not use a service worker, so a refresh always checks the host for
the latest files. Host portraits are compressed WebP assets and can be cached by
the CDN.

## Optional API/GPU deployment

Keep the static frontend public and place the future speech/avatar backend behind
a separate HTTPS endpoint. Configure that endpoint with:

- strict allowed origins;
- WebSocket and WebRTC rate limits;
- short-lived session tokens;
- no permanent raw-audio storage by default;
- explicit upload size and MIME limits;
- health and readiness checks;
- hard GPU concurrency and spending caps.

See [GPU_UPGRADE.md](./GPU_UPGRADE.md) for the adapter contract.

## Rollback

GitHub Pages deploys the selected repository branch. To roll back, revert the
relevant commit on `main` and push. Do not publish model weights or secrets in
this repository.
