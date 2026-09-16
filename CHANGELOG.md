# Changelog

All notable changes to this project are documented here.

## [1.3.1]
### Fixed
- A stray leading/trailing quote character in a search term (common when
  copy-pasting a pull-quote that shows its quote marks via a decorative
  icon rather than real text) no longer blocks a match. That character is
  now treated as optional instead of required.

## [1.3.0]
### Changed
- Highlight color switched from yellow to green (`#4ade80`).
- Highlight text color is now computed via a luminance-based contrast
  check instead of `color: inherit`, so highlighted text stays readable
  regardless of the underlying page's light/dark theme.
### Added
- Per-term match feedback in the popup: each search term shows as a chip,
  green with a count if found, red if not found anywhere on the page.

## [1.2.0]
### Fixed
- **Major:** phrases that span an inline tag boundary (e.g. `Situation:`
  wrapped in `<strong>` followed by the rest of the sentence as a sibling
  text node) previously could never match, since matching only looked
  inside one DOM text node at a time. Rewrote the matching engine to find
  the smallest block-level containers, flatten their text across inline
  tags, match against that, then wrap only the matched portions back into
  their original text nodes.
### Added
- Fuzzy tolerance for punctuation drift: different dash/hyphen characters
  and smart vs straight quotes are now treated as equivalent.

## [1.1.1]
### Fixed
- Comma-splitting now only applies when the entire pasted input is a
  single line. Multi-line pastes (e.g. one bullet point per line) no
  longer get fragmented by commas that occur naturally inside a sentence.
- Common bullet markers (`*`, `-`, `•`, `1.`) are stripped from the start
  of each line automatically.

## [1.1.0]
### Added
- Smart tokenizer supporting comma, pipe (`|`), middle-dot (`·`),
  semicolon, and quoted-phrase input formats, plus one-term-per-line.
- `MutationObserver`-based dynamic content support: text added to the page
  later (AJAX/SPA/lazy-load) is highlighted automatically if visible.
- Visibility check so `display: none` / `visibility: hidden` content is
  never highlighted.
- Keyboard shortcut `Ctrl+Shift+F` (`Cmd+Shift+F` on Mac) to open the popup.

## [1.0.0]
### Added
- Initial Chrome extension version (Manifest V3), converted from a
  bookmarklet. Popup UI with a textarea, Highlight/Clear buttons.
- Safe text-node-only highlighting: skips `<script>`, `<style>`,
  `<iframe>`, form fields, and `contenteditable` regions so the page's
  layout, links, and editors are never affected.
