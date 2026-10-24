# Privacy policy

Effective date: 2026-10-24. Applies to the Replamma 0.2 source extension.

Replamma has no developer-operated backend, telemetry, analytics, advertising, account system, or remote AI service. The extension does not transmit recorded content to its developers.

When you start recording, Replamma reads supported interactions in the selected page: element selectors, labels, text input values, select values, and the starting page URL. Recognizable sensitive fields and elements marked with `data-replay-private` are excluded by a heuristic. This does not reliably identify every type of personal information.

Recordings are held in page memory. The open panel periodically stores the current draft in `chrome.storage.local`. Saved workflows stay in the current browser profile's local extension storage. Replamma does not encrypt this data. Browser profile access, browser backups, and your operating system's protections determine who else can read it.

You may delete individual saved workflows in the panel. Recording drafts are distinct from saved workflows; uninstall the extension or clear its extension storage to remove all locally held Replamma data. Exported files must be deleted separately.

During replay, the website receives the same values you enter into its fields and may send data through its own services. Those websites' privacy policies apply to that behavior. Replamma's local-only design does not prevent the website from communicating over the network.

Export shares only when you choose where to save or upload the JSON file. Review the file before distributing it. GitHub issue submissions and contributions are governed by GitHub's policies.

Questions can be raised in the project repository without including recordings or personal information.

## Version 0.2 additions

Input variables are supplied in the panel immediately before a run. Their resolved values are not written to workflow storage, exports, or activity records. The original template, such as `{{report}}`, is saved with the workflow. Run-input fields are cleared when playback ends. Concrete values recorded directly in a workflow remain part of that workflow as before.

The Activity view keeps the latest 50 runs locally: workflow name, start time, result, step counts and duration. It does not store page URLs, selectors, error messages, or resolved input values. Use **Activity → Clear history** to remove it.

Choosing a target reads that element's selector and label, and draws a temporary highlight in the page. It does not capture screenshots. The picker times out after 30 seconds, supports Escape, blocks recognizable sensitive fields, and intercepts the chosen click rather than performing the page action.
