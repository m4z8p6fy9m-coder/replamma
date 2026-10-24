# Contributing to Replamma

Thanks for helping make repetitive browser work easier.

## Local setup

Use Node.js 22+, run `npm ci`, and load `extension/` as an unpacked Chrome extension. Run `npm run demo` for an entirely local test page. Reload the extension and the target page after editing injected scripts.

Before opening a pull request:

```sh
npm run check
npm test
npx playwright install chromium
npm run test:e2e
```

## Scope and review

- Open an issue before major architecture, permission, storage, or schema changes.
- Keep a PR focused. Explain the observed problem, the change in behavior, and how you checked it.
- Include regression coverage for playback, recording, validation, and privacy changes.
- Use plain JavaScript and browser APIs. Runtime dependencies require a concrete justification.
- Use `textContent` for untrusted content. Do not add eval, remote scripts, or broad host permissions.
- Never attach real recordings containing credentials or personal data. Use the playground.
- Document unsupported behavior honestly; roadmap items are not shipped features.

Maintainers may request changes or decline contributions that expand scope without adequate tests. There is no guaranteed response time. Contributions are licensed under the project's MIT license.
