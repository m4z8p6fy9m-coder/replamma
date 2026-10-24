# Workflow format, version 1

A workflow contains `schemaVersion: 1`, a trimmed name of 1–100 characters, a credential-free HTTP(S) starting URL, and up to 250 steps. Unknown fields are discarded. JSON files must be smaller than 2 MB to import through the UI.

| Type     | Required fields     | Behavior                                                               |
| -------- | ------------------- | ---------------------------------------------------------------------- |
| `click`  | `selector`          | Wait for one visible, enabled target; request approval before dispatch |
| `input`  | `selector`, `value` | Set a native input/textarea value; dispatch input and change           |
| `select` | `selector`, `value` | Select an existing native option by value                              |
| `wait`   | `ms`                | Wait an integer number of milliseconds from 0 to 30000                 |

Selectors must be nonempty strings no longer than 2000 characters. Values must be strings no longer than 10000 characters. An optional label is normalized to at most 200 characters and used for display only. Labels are never used to resolve an element. Invalid CSS selectors produce a playback error. Password, private, file, and hidden inputs cannot be filled through playback.

## Example

```json
{
  "schemaVersion": 1,
  "name": "Create weekly report",
  "url": "http://127.0.0.1:4173/",
  "steps": [
    {
      "type": "input",
      "selector": "#report-name",
      "label": "Report name",
      "value": "Weekly overview"
    },
    {
      "type": "select",
      "selector": "#format",
      "label": "Format",
      "value": "json"
    },
    { "type": "click", "selector": "#create", "label": "Create report" }
  ]
}
```

Use stable attributes wherever possible. A selector that matches several elements is an error, even if one element is hidden. Fix the selector instead of relying on DOM order. Workflow export is plain JSON; it is not encrypted and should never be treated as a secret container.

## Input variables

Input and select values can contain placeholders such as `{{report}}`. Names begin with an ASCII letter and contain up to 40 letters, digits or underscores. A workflow may request at most 20 distinct variables. Before a run, the panel asks for a nonempty value for every variable. Replacements are literal and happen once; a supplied value cannot introduce a second round of placeholder expansion. The expanded plan is validated against the same value-length limits.

Variables cannot change the URL, selector, action type or label. Resolved values are never written back into the saved workflow or activity log. Old version-1 workflow JSON remains compatible.
