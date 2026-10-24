# Replamma design notes

Replamma uses a compact, light interface for day-to-day work. The side panel is a tool, so it opens with saved workflows and direct controls rather than a marketing headline. System fonts, consistent spacing, restrained teal accents and standard focus states keep the interface familiar.

## References

The product clarity of [Adblock Plus](https://adblockplus.org/) and [Malwarebytes Browser Guard](https://www.malwarebytes.com/browserguard) informed the hierarchy and use of plain labels. Their artwork, layouts, marks and product claims were not copied. Automation use cases were checked against [Automa's project documentation](https://github.com/AutomaApp/automa): repetitive form work and reusable workflows are relevant to this product. This is category evidence, not a claim that these are the most-requested features in a measured survey.

The Replamma mark is an original SVG llama with upright ears, a simple profile and a teal scarf. Its source is `extension/icons/mark.svg`. Toolbar PNGs are rendered from that source with `npm run icons`. It is not the Ollama mark and does not imply an affiliation.

## Interaction rules

- Saved workflows appear in a searchable button list with keyboard focus and selected state.
- Technical selectors are collapsed until requested. Targets can also be chosen on the page.
- Steps use ordinary names and small line icons. Symbol-only controls have accessible labels.
- Workflows, Activity and Settings use a consistent navigation bar.
- Status messages describe the current action; there are no invented usage counts or saved-time claims.
- Interface text is not selectable through ordinary dragging and copying; editable fields retain normal selection. These are interaction choices, not DRM, secrecy, or proof that content was not AI-assisted.
- Source visibility is controlled by the repository's actual access setting, never by CSS.
