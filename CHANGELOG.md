# Changelog

## 0.2.0 — 2026-10-24

- Renamed the product to Replamma with an original llama mark and matching toolbar icons.
- Replaced the promotional dark interface with a compact light layout, plain labels, searchable workflow list and dedicated Activity/Settings views.
- Added visual target selection with page highlighting, Escape cancellation and click interception.
- Added per-run input variables without persisting resolved values.
- Added a bounded local activity log, workflow duplication and workflow search.
- Disabled ordinary selection/copying of interface labels while retaining standard editing behavior in input fields. This is not a technical guarantee against extracting installed source code.
- Preserved existing local workflows and version-1 JSON compatibility.
- Expanded integration coverage for the new features and privacy behavior.

## 0.1.0 — 2026-10-24

Initial early release.

- Manifest V3 Chrome extension with a persistent side-panel editor.
- Single-page capture for actionable clicks, text fields and native selects.
- Local workflow library, recording draft recovery, validated JSON import/export.
- Editable selectors and values, step reordering, removal and wait insertion.
- Sequential playback with unique-target waits, cancellation, page checks and approval before every click.
- Sensitive/private field exclusion and documented privacy boundaries.
- Local playground, unit tests, browser integration test, and GitHub Actions checks.
