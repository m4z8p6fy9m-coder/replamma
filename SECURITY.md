# Security policy

Replay 0.1.x is an early release. Security fixes target the latest published source version; older versions are not maintained.

## Reporting

Use the repository's **Security → Report a vulnerability** option if private reporting is enabled. If it is unavailable, open a minimal issue asking for a private reporting channel, without exploit details, recordings, credentials, or personal information. Do not disclose an exploitable issue in a public pull request before coordination.

Include the version, browser version, affected component, impact, and a minimal reproduction on synthetic data. There is no paid bounty or guaranteed response SLA.

## Threat model

Replay trusts the user-approved page and the Chrome extension runtime. Page scripts can observe and react to replayed inputs. They may change the DOM between inspection and action. A selector's matching element may change over time. Approving a click approves the action against the current page; it cannot guarantee the site's downstream behavior.

Defenses include temporary site access, isolated-world scripts, extension sender checks, same-page checks before playback, unique-target requirements, bounded imports and waits, sensitive-field heuristics, and click-by-click approval. These are safeguards, not a sandbox for malicious sites or imported workflows. Do not use Replay for password entry, payment authorization, or unattended high-impact actions.

Local workflow data is not encrypted by Replay. Uninstalling the extension removes its local storage under normal browser behavior. Exported JSON files remain wherever you save them.
