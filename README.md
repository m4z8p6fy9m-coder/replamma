<div align="center">

# ↻ Replay

### Do it once. Make it a workflow.

Record browser actions, edit the steps, and replay them with a human in control.

**Local storage · No account · No runtime dependencies · Manifest V3**

[Get started](#get-started) · [Try the playground](#try-the-playground) · [How it works](docs/ARCHITECTURE.md) · [Contribute](CONTRIBUTING.md) · [Roadmap](docs/ROADMAP.md)

![Replay workflow studio](docs/studio.png)

</div>

## A small tool for the work you repeat

Entering report filters. Filling the same internal form. Repeating a sequence of clicks. Replay turns those interactions into an inspectable workflow you can keep in your browser or export as JSON.

**v0.1.0 is an early release for single-page workflows.** It is a deterministic recorder, not an AI agent. Browser automation depends on the page: test a workflow on harmless data before using it for real work.

## What works today

| Feature     | Behavior                                                                   |
| ----------- | -------------------------------------------------------------------------- |
| Record      | Clicks on actionable elements, text inputs, textareas, native selects      |
| Edit        | Change selectors and values, reorder or remove steps, insert bounded waits |
| Replay      | Wait up to five seconds for a unique target, then perform the action       |
| Approval    | Every replayed click pauses for explicit approval in the panel             |
| Stop        | Cancel playback, including a pending target lookup or wait                 |
| Library     | Save, reopen and delete workflows in the current browser profile           |
| Portability | Import validated JSON; export readable, versioned JSON                     |
| Privacy     | No telemetry, account, remote service, or persistent site access           |

## Get started

Requires desktop **Chrome 116+**. Chromium-based browsers with the same extension APIs may work but are not the compatibility target for this release. No Node.js or build step is needed to use Replay.

1. Clone this repository, or download and extract its source ZIP.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the repository's **`extension/`** folder.
4. Pin Replay using Chrome's Extensions menu.
5. Open a normal HTTP(S) website and click Replay's toolbar icon. This grants temporary access to that tab and opens the workflow studio.
6. Name your workflow, click **Record page**, and perform a few actions on the website.
7. Keep the side panel open. Click **Stop**, inspect the steps, and **Save workflow**.
8. Reset the page to its initial state, click Replay's icon again if needed, and choose **Run**. Approve each click as it comes up.

Replay never automatically opens the starting URL. Navigate there yourself. A workflow is pinned to its starting origin, path, and query string. Fragment changes are allowed during replay.

## Try the playground

With Node.js 22 or later:

```sh
npm run demo
```

Open **http://127.0.0.1:4173**, click Replay's toolbar icon, and record entering a report name, selecting JSON, and clicking **Create report**. Stop and save. Reload the playground, then run the workflow. The final result should show the same report name and format. The playground does not send form data anywhere.

## Privacy and permissions

Replay requests `activeTab`, `scripting`, `storage`, and `sidePanel`. It does not request `<all_urls>`, browsing history, cookies, or persistent host permissions. See [Chrome's activeTab documentation](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab).

- Recording runs in Chrome's isolated content-script world on the selected page.
- Saved workflows and the latest recording draft use `chrome.storage.local`, not cloud sync. This storage is **not encrypted by Replay**.
- Password fields, recognizable sensitive field names, and elements inside `[data-replay-private]` are skipped during capture and blocked during playback.
- This heuristic is not a personal-data detector. Ordinary fields, element labels, selectors, and URLs can still contain personal information. Review every workflow before saving or exporting it.
- Typing into a page can trigger that site's own network requests, even before a click. Click approval is not a network sandbox.
- JSON imports cannot introduce executable code. Imported selectors and values can still cause consequential actions when run. Inspect them first.

Read the [privacy policy](docs/PRIVACY.md) and [security policy](SECURITY.md) for details.

## Current boundaries

This release supports the **top-level DOM on one page**. Recording ends or is interrupted when the page navigates or reloads. The last polled recording draft is preserved; actions in the final polling interval may be lost. Recording stops capturing if the URL changes, including its fragment. Replay checks origin, path and query before each action.

Not supported yet: cross-page workflows, tabs/popups, iframes, shadow DOM, contenteditable editors, file uploads, keyboard shortcuts, drag-and-drop, multi-select lists, canvas controls, extraction, loops, scheduling, variable substitution, AI editing, and cloud execution. A site that requires trusted events may reject synthetic playback. Downloads depend on the site's existing click behavior; Replay does not manage download files.

Closing the panel interrupts playback. Recording requires a heartbeat from the open panel and expires after two seconds without one; browser suspension or background throttling can also end capture. Reopen Replay to recover the last valid recording draft. Editor changes are saved by **Save workflow**; the recording draft is periodically persisted while recording.

## Development

The extension itself uses plain JavaScript, HTML, and CSS. Development dependencies are only for testing.

```sh
npm ci
npm run check
npm test
npx playwright install chromium
npm run test:e2e
npm run package
```

`package` copies the installable extension into `dist/replay/`. Reload the extension in `chrome://extensions` after code changes, then reload the target page to remove older injected scripts.

The browser integration test loads the extension into an isolated Chromium profile, records trusted interactions on the local playground, verifies sensitive-field exclusion, replays the workflow, and checks click approval, cancellation, persistence, and JSON export. A temporary copy of the manifest grants access to loopback pages because the test cannot invoke Chrome's toolbar action. The shipped manifest has no host permissions; manual verification of the toolbar/side-panel permission flow remains necessary. The test also produces the screenshot used above.

## Workflow format

```json
{
  "schemaVersion": 1,
  "name": "Fill report name",
  "url": "http://127.0.0.1:4173/",
  "steps": [
    {
      "type": "input",
      "selector": "[id=report-name]",
      "label": "Report name",
      "value": "Weekly overview"
    },
    { "type": "wait", "ms": 500 }
  ]
}
```

See [the format reference](docs/WORKFLOWS.md) for validation rules and examples.

## Contributing and license

Small, testable contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), follow the [Code of Conduct](CODE_OF_CONDUCT.md), and check the [roadmap](docs/ROADMAP.md). Security reports should follow [SECURITY.md](SECURITY.md).

Released under the [MIT License](LICENSE). No claims of affiliation with Google or other browser vendors.
