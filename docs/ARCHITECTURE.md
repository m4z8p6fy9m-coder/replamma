# Architecture

```mermaid
flowchart LR
  A[Toolbar action] --> B[Side panel]
  B --> C[Chrome scripting API]
  C --> D[Isolated content script]
  D --> E[Current page DOM]
  B <--> F[Chrome local storage]
  B <--> G[JSON file]
```

`background.js` configures the toolbar action to open the side panel and restricts storage access to trusted extension contexts on installation. The service worker does not orchestrate long-running jobs.

`panel.js` owns the editor, workflow library and sequential run loop. Each run captures an immutable validated plan and the target tab ID. Changing the active tab does not retarget a run. A generation token cancels the panel loop; `CANCEL` also invalidates pending content-script lookups.

`content.js` is injected only after explicit user interaction grants temporary access. Injection is idempotent. It records trusted DOM events in the top frame, coalesces adjacent updates to the same input, and keeps a bounded in-memory recording. The panel polls every 500 ms and writes a draft locally. Capture expires after two seconds without this heartbeat, so a closed or suspended panel cannot record indefinitely. A session ID distinguishes a recording from a new page instance. Full navigation destroys in-memory capture; the last polled draft survives.

Selectors prefer unique `data-testid`, `id`, `name`, and `aria-label` attributes, then fall back to a structural `nth-of-type` path. Playback rejects multiple matches rather than guessing. Each non-wait step validates the current URL, resolves a target with a five-second deadline, blocks sensitive fields and hidden/disabled targets, then dispatches a click or native value setter with input/change events.

`core.js` contains the allowlisted workflow schema and URL checks, shared between the panel, injected script, and tests. Import normalization strips unknown fields. There is no executable expression or scripting action in the format.

## Constraints and tradeoffs

- The side panel must remain open during a run. No service-worker keepalive tricks are used.
- Recording polls are not an event journal. The final 500 ms can be lost if the page navigates.
- Structural selectors are intentionally inspectable but can break after layout changes.
- Synthetic events are rejected by some sites; trusted-event emulation is not attempted.
- Approval covers clicks only. Input changes may trigger site behavior immediately.
- Multi-page orchestration needs a persistent state machine and a clear permission model before implementation.

## Replamma 0.2

The Workflows view uses a searchable button list. Advanced target details remain collapsed until needed. `ui.js` renders a small, fixed SVG icon vocabulary; no remote icon library is loaded.

Input variables use the existing version-1 value strings. The panel extracts bounded placeholder names, requires a fresh nonempty value, resolves one literal substitution pass, and validates the resulting immutable run plan again. It never writes the resolved plan to workflow or history storage.

Visual target selection injects a temporary closed-shadow-root overlay. It listens for trusted input, blocks the selected click, excludes sensitive fields, and returns only a selector and label. Escape, Stop and a 30-second deadline remove its listeners and overlay. The panel uses the same bound tab ID throughout selection. A page change aborts target lookup before action execution.

Activity stores at most 50 metadata-only outcomes. Stored items include workflow name, start time, result, total/completed counts and elapsed time; resolved inputs, URLs and errors are excluded. The queue serializes activity writes after completed, failed and cancelled runs.
