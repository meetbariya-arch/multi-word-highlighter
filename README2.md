# Multi-Word Highlighter

A Chrome extension (Manifest V3) that finds and highlights one or more
words/phrases anywhere on any web page — safely, without breaking the
page's layout, links, scripts, or editors (it's even safe to use on the
WordPress admin editor).

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Manifest](https://img.shields.io/badge/manifest-v3-green.svg)

---

## What does this extension do?

You give it a list of words or phrases, it searches the **currently open
web page** for every one of them, and highlights each match in green — no
matter how deep it's buried in the page's HTML, and even if new content
loads in later (like an infinite-scroll feed or a single-page app).

It's built for real-world messy content: pasted paragraphs, bullet lists,
comma-separated tags, quoted phrases, pipe-separated categories — you don't
need to reformat anything before pasting it in.

---

## Installation

Chrome doesn't allow installing extensions from a `.crx` file by
double-click or drag-and-drop (a Chrome security policy that applies to
any personally-built extension). **"Load unpacked" is the correct way:**

1. Download this repository (**Code → Download ZIP**, then extract it) or
   `git clone` it.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the extracted `multi-word-highlighter`
   folder.
5. Click the puzzle-piece icon in Chrome's toolbar and pin **Multi-Word
   Highlighter** so it's always visible.

To update later after pulling new changes, go to `chrome://extensions` and
click the **Reload** (🔄) icon on the extension's card.

---

## How to use it

1. Open any web page.
2. Click the extension's icon in the toolbar (or press **`Ctrl+Shift+F`** /
   **`Cmd+Shift+F`** on Mac).
3. Type or paste the word(s)/phrase(s) you want to find, in the text box.
4. Click **Highlight**.
5. Each term you searched for shows up as a small chip below the button:
   - 🟢 **Green chip** with a number = found that many times on the page.
   - 🔴 **Red chip** = not found anywhere on the page (useful for spotting
     a typo, or confirming a phrase genuinely isn't on the page).
6. Click **Clear** any time to remove all highlights and start over.

You don't need to pick a format for your input — just paste it the way you
already have it. The extension figures out how to split it into separate
search terms. See the scenarios below.

---

## Scenarios & examples

### 1. A simple comma-separated list of words
**Input:**
```
invoice, pending, urgent
```
**Result:** 3 separate search terms — `invoice`, `pending`, `urgent` — each
highlighted wherever they appear on the page.

---

### 2. Full sentences, comma-separated
**Input:**
```
I am Meet from JJP, I am Alex Hill from USA
```
**Result:** Treated as **2 separate terms** (split at the comma), not 6
individual words — because the comma here is being used as a list
separator between two complete phrases.

---

### 3. Pasting a bulleted list or multiple paragraphs (one item per line)
**Input** (pasted with each bullet on its own line):
```
Situation: Greenlight needed to cost-effectively manage peaks in traffic caused by video streaming to make sure their customers have excellent QoE.
Solution: Using the Netskrt Last-Mile CDN, Greenlight can quickly implement CDN capabilities at the outskirts of their network, bringing video content closer to viewers.
Outcome: Greenlight can ensure high-quality video delivery for exceptional customer QoE without incurring expensive backhaul charges, while optimizing network bandwidth.
```
**Result:** **3 separate terms** — one per line — even though each
sentence has commas *inside* it. When your input has multiple lines, the
line break is treated as the real separator, so commas inside a sentence
are left alone instead of being wrongly split.

Markdown-style bullet markers (`*`, `-`, `1.`) at the start of a line are
stripped automatically, so pasting straight from a bulleted list or a
numbered list also works without any cleanup.

---

### 4. Quoted phrases (with or without commas between them)
**Input:**
```
"Customs Clearance and Compliance", "Freight Forwarding", "Supply Chain Solutions"
```
or even without commas:
```
"Customs Clearance and Compliance" "Freight Forwarding" "Supply Chain Solutions"
```
**Result:** Both are read as **3 terms**. Quotes mark exactly where one
phrase ends and the next begins, regardless of whether there's a comma
between them.

---

### 5. Pipe-separated or middle-dot-separated tags
**Input:**
```
China | Customs Compliance | EU | Freight Forwarding | Taiwan | USA | Warehousing
```
or
```
Customs Clearance and Compliance · Semiconductor · Supply Chain
```
**Result:** Each is correctly split into its own list of terms (7 and 3
respectively) using `|` or `·` as the separator.

---

### 6. A phrase that's split across bold/link text in the page's HTML
This is the trickiest case, and this extension handles it where many
highlighters fail. Imagine the actual page HTML looks like this:
```html
<li><strong>Situation:</strong> Greenlight needed to cost-effectively manage peaks...</li>
```
Here, `"Situation:"` is inside a `<strong>` tag, and the rest of the
sentence is a separate, sibling piece of text. If you search for the
**whole sentence** — `Situation: Greenlight needed to cost-effectively
manage peaks...` — it still matches correctly, because the extension reads
across bold/italic/link tags within the same paragraph or list item before
searching, instead of checking one small piece of text at a time.

---

### 7. Content that loads in later (infinite scroll, single-page apps)
If you click **Highlight** and then the page loads more content afterward
— e.g. you scroll down a feed, or a single-page app navigates to a new
section without a full page reload — the extension keeps watching in the
background and automatically highlights any of your terms that show up in
that new content too, as long as it's actually visible on screen. You
don't need to click Highlight again.

---

### 8. Hidden content is correctly ignored
If a search term only exists inside something hidden on the page (for
example CSS `display: none`, or the `alt` text of an image, which isn't
real visible text), the extension correctly reports **0 matches** for it
instead of pretending to highlight something the user can't actually see.
That red "not found" chip is telling you the truth about what's on screen.

---

### 9. Slightly different punctuation between what you typed and the page
**Input:**
```
Cost-effectively managed
```
**Page's actual text (uses a different hyphen character):**
```
Cost‑effectively managed
```
**Result:** Still matches. The extension tolerates common copy-paste
punctuation drift — different hyphen/dash characters, curly `’` vs
straight `'` quotes, and a stray leading/trailing quote mark that doesn't
actually exist in the page's text (common with pull-quote boxes that show
their quote marks as a decorative icon rather than real text).

---

## Project structure

```
.
├── manifest.json     # Manifest V3 config: permissions, content script, popup, keyboard shortcut
├── content.js        # All highlighting logic — runs on every page
├── popup.html        # Toolbar popup UI
├── popup.js          # Popup logic — talks to content.js via chrome.runtime messaging
├── icon.svg          # Source icon (vector)
└── icons/            # Generated PNG icons (16/32/48/128px) used by manifest.json
```

## How it works (architecture, for contributors)

- **Tokenizer** (`content.js`) parses whatever you paste into a clean list
  of search terms, auto-detecting the delimiter style (comma vs pipe vs
  middle-dot vs quoted phrases vs one-per-line), as shown in the scenarios
  above.
- **Cross-tag matching engine** finds the smallest DOM containers that have
  no nested block-level children (a `<li>`, a `<p>`, etc.), flattens just
  their text across inline tags (`<strong>`, `<em>`, `<a>`...), searches
  that flattened text, then wraps only the matched portions back into their
  original text nodes — even when a single match spans multiple tags.
- **Fuzzy regex builder** escapes each term for safe regex use, then
  broadens whitespace/quote/dash characters into tolerant character
  classes, and makes a stray leading/trailing quote character optional.
- **MutationObserver** watches for new content after the first highlight
  and re-runs the same matching logic only on newly added nodes (never on
  its own inserted `<span>` elements, so there's no infinite loop).
- **Popup ↔ content script messaging** — the popup never manipulates the
  page directly; it sends a message (`MWH_HIGHLIGHT` / `MWH_CLEAR`) to the
  persistent content script, which does the actual DOM work and reports
  back match counts per term.
- **Contrast-aware highlight color** — text color on top of the highlight
  is computed from the highlight background's luminance, so it stays
  readable on both light- and dark-themed pages.

## Packaging a signed `.crx` (optional)

"Load unpacked" (above) is the practical way to run this day-to-day. If you
need a signed `.crx` for something like an enterprise policy-managed
install, you'll need your own private key:

```bash
pip install crx3 --break-system-packages
python3 -c "
from crx3 import creator
creator.create_private_key_file('multi-word-highlighter.pem')
creator.create_crx_file('.', 'multi-word-highlighter.pem', 'multi-word-highlighter.crx')
"
```

**Never commit the generated `.pem` file to git** (it's already excluded
via `.gitignore`). It's the private key that gives the extension its
permanent identity — anyone who has it can sign updates that Chrome would
trust as coming from you.

## Permissions used

| Permission | Why |
|---|---|
| `storage` | Remembers your last-used search terms between popup opens |
| `activeTab` / `scripting` | Fallback: injects `content.js` into a tab that was already open before install/reload |
| `host_permissions: <all_urls>` + `content_scripts` | Lets the highlighter run on any site you visit |

## Contributing

Issues and PRs welcome. If something isn't matching correctly, please
include a snippet of the page's HTML structure around the text in
question — that's far more useful for reproducing matching edge cases than
a screenshot alone.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT](./LICENSE)
