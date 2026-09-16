# Multi-Word Highlighter

A Chrome extension (Manifest V3) that highlights one or more words/phrases
anywhere on any web page — without breaking the page's layout, links,
scripts, or editors (e.g. it's safe to use on the WordPress admin editor).

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Manifest](https://img.shields.io/badge/manifest-v3-green.svg)

## Features

- **Flexible input** — paste your search terms in almost any format and it
  just works:
  - Comma separated: `invoice, pending, urgent`
  - Pipe separated: `China | EU | Taiwan`
  - Middle-dot separated: `Freight · Customs · Warehousing`
  - Quoted phrases: `"Freight Forwarding" "Customs Compliance"`
  - One term per line (e.g. pasted bullet points / paragraphs) — internal
    commas inside a sentence are **not** treated as extra separators
  - Markdown-style bullet markers (`*`, `-`, `1.`) are stripped automatically
- **Cross-tag matching** — a phrase like `Situation: Greenlight needed...`
  still matches even if `Situation:` is wrapped in `<strong>` and the rest
  of the sentence is a sibling text node. Most naive highlighters miss this.
- **Fuzzy punctuation tolerance** — matches even when the page uses a
  different dash (`‑` non-breaking hyphen vs `-`) or a different quote style
  (curly `’` vs straight `'`) than what you typed, and tolerates a stray
  leading/trailing quote character that doesn't actually exist on the page
  (a common copy-paste artifact from pull-quotes).
- **Only touches visible text** — never rewrites `<script>`, `<style>`,
  `<iframe>`, form fields, or `contenteditable` regions, so it's safe to use
  on admin/editor pages without breaking anything.
- **Dynamic content aware** — a `MutationObserver` keeps watching after the
  first highlight, so content that loads in later (AJAX, SPA navigation,
  lazy-loaded sections) gets highlighted automatically too, as long as it's
  actually visible on screen.
- **Contrast-safe highlight color** — the highlight background/text pair is
  chosen via a computed luminance check, so it stays readable regardless of
  whether the underlying page is light or dark themed.
- **Per-term match feedback** — after highlighting, the popup shows each
  search term as a chip: green with a count if it was found, red if it
  wasn't found anywhere on the page.
- **Keyboard shortcut** — `Ctrl+Shift+F` (`Cmd+Shift+F` on Mac) opens the
  popup instantly.

## Installation (unpacked, for personal/dev use)

Chrome blocks installing `.crx` files by drag-and-drop for security reasons
(this applies to any personally-built extension, not just this one), so
**"Load unpacked" is the correct and only practical way to install this**:

1. Download/clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select this project's folder.
5. Pin the extension from the puzzle-piece icon in the toolbar.

To update after pulling new changes, click the **Reload** (🔄) icon on the
extension's card at `chrome://extensions`.

## Usage

1. Click the extension icon (or press `Ctrl+Shift+F`).
2. Type or paste the word(s)/phrase(s) you want to find.
3. Click **Highlight**. Each term appears below as a chip showing how many
   times it was found (green) or that it wasn't found at all (red).
4. Click **Clear** to remove all highlights.

## Project structure

```
.
├── manifest.json     # Manifest V3 config: permissions, content script, popup, keyboard shortcut
├── content.js        # All highlighting logic — runs on every page
├── popup.html         # Toolbar popup UI
├── popup.js           # Popup logic — talks to content.js via chrome.runtime messaging
├── icon.svg           # Source icon (vector)
└── icons/             # Generated PNG icons (16/32/48/128px) used by manifest.json
```

## How it works (architecture)

- **Tokenizer** (`content.js`) parses whatever you paste into a clean list
  of search terms, auto-detecting the delimiter style (comma vs pipe vs
  middle-dot vs quoted phrases vs one-per-line).
- **Cross-tag matching engine** finds the smallest DOM containers that have
  no nested block-level children (a `<li>`, a `<p>`, etc.), flattens just
  their text across inline tags (`<strong>`, `<em>`, `<a>`...), searches
  that flattened text, then wraps only the matched portions back into their
  original text nodes — even if a single match spans multiple tags.
- **Fuzzy regex builder** escapes each term for safe regex use, then
  broadens whitespace/quote/dash characters into tolerant character
  classes, and makes a stray leading/trailing quote character optional.
- **MutationObserver** watches for new content after the first highlight
  and re-runs the same matching logic only on newly added nodes (never on
  its own inserted `<span>` elements, so there's no infinite loop).
- **Popup ↔ content script messaging** — the popup never manipulates the
  page directly; it sends a message (`MWH_HIGHLIGHT` / `MWH_CLEAR`) to the
  persistent content script, which does the actual DOM work and reports
  back match counts.

## Packaging a `.crx` (optional)

Chrome will not let you install a `.crx` by double-clicking or drag-and-drop
outside the Web Store — this is a Chrome security policy, not specific to
this extension. "Load unpacked" (above) is the practical way to run this.
If you still want a signed `.crx` (e.g. for an enterprise policy-managed
install), you'll need your own private key:

```bash
pip install crx3 --break-system-packages
python3 -c "
from crx3 import creator
creator.create_private_key_file('multi-word-highlighter.pem')
creator.create_crx_file('.', 'multi-word-highlighter.pem', 'multi-word-highlighter.crx')
"
```

**Never commit the generated `.pem` file to git** (see below) — it's already
in `.gitignore`.

## Should the `.pem` file go in git?

**No — never.** The `.pem` is the private key that gives an extension its
permanent identity (its Extension ID). Anyone who has it can sign and
distribute updates that Chrome would trust as coming from you. Treat it
like a password:

- Keep it outside the repo, in a personal password manager or secure vault.
- It's already excluded via `.gitignore` in this project.
- If you ever suspect it has leaked, you must re-sign with a new key —
  which also means a new Extension ID (existing installs won't auto-update
  from the old one).

## Permissions used

| Permission | Why |
|---|---|
| `storage` | Remembers your last-used search terms between popup opens |
| `activeTab` / `scripting` | Fallback: injects `content.js` into a tab that was already open before install/reload |
| `host_permissions: <all_urls>` + `content_scripts` | Lets the highlighter run on any site you visit |

## Contributing

Issues and PRs welcome. Please describe the page/content shape that's
misbehaving (a snippet of the HTML structure is more useful than a
screenshot alone) so matching edge cases can be reproduced and tested.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT](./LICENSE)
