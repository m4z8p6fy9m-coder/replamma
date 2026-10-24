# Privacy policy

Effective date: 2026-10-24. Applies to the Replay 0.1 source extension.

Replay has no developer-operated backend, telemetry, analytics, advertising, account system, or remote AI service. The extension does not transmit recorded content to its developers.

When you start recording, Replay reads supported interactions in the selected page: element selectors, labels, text input values, select values, and the starting page URL. Recognizable sensitive fields and elements marked with `data-replay-private` are excluded by a heuristic. This does not reliably identify every type of personal information.

Recordings are held in page memory. The open panel periodically stores the current draft in `chrome.storage.local`. Saved workflows stay in the current browser profile's local extension storage. Replay does not encrypt this data. Browser profile access, browser backups, and your operating system's protections determine who else can read it.

You may delete individual saved workflows in the panel. Recording drafts are distinct from saved workflows; uninstall the extension or clear its extension storage to remove all locally held Replay data. Exported files must be deleted separately.

During replay, the website receives the same values you enter into its fields and may send data through its own services. Those websites' privacy policies apply to that behavior. Replay's local-only design does not prevent the website from communicating over the network.

Export shares only when you choose where to save or upload the JSON file. Review the file before distributing it. GitHub issue submissions and contributions are governed by GitHub's policies.

Questions can be raised in the project repository without including recordings or personal information.
