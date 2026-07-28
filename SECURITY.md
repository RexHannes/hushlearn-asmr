# Privacy and security

## Present browser build

- Selected files are read with the browser File API.
- Extracted text and the retrieval index live only in memory.
- Hushlearn does not send knowledge text to an application server.
- The demo contains no analytics, advertising, authentication, or cookies.
- Settings such as energy mode are stored in `localStorage`.
- Starting a microphone question cancels the current spoken answer.

Browser speech recognition is an important exception: depending on the browser
and operating system, audio may be processed by the browser vendor. The
interface discloses this next to the microphone controls.

## Supported uploads

The free build accepts text-like files only:

- TXT
- Markdown
- CSV
- JSON
- HTML (text content is extracted)

Files are limited to 5 MB each. Uploaded HTML is parsed as a document and only
its text content is indexed; it is never injected into the page.

## Reporting

Please use a private GitHub security advisory for vulnerabilities. Do not put
private source material, credentials, or voice samples in a public issue.

## Future backend requirements

Before enabling a remote LLM or neural avatar:

- add authentication and per-user rate limits;
- encrypt transport with HTTPS/WSS;
- isolate knowledge collections by user and session;
- validate source IDs returned by the model;
- obtain explicit consent for any voice or likeness;
- provide deletion controls and a written retention policy;
- store secrets only in the hosting platform's secret manager.
