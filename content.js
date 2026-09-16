(function () {
  const MARK_CLASS = "__mwh_highlight_ext__";
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "IFRAME", "NOSCRIPT", "SELECT", "OPTION"]);

  let observer = null;
  let activeWords = [];

  // =========================================================
  // 1. SMART TOKENIZER
  // =========================================================
  function stripBulletMarker(line) {
    return line
      .replace(/^\s*[-*•‣◦›»]\s+/, "")
      .replace(/^\s*\d+[.)]\s+/, "")
      .trim();
  }

  function splitByDelimiter(line, allowComma) {
    if (line.includes("|")) {
      return line.split("|").map((s) => s.trim()).filter(Boolean);
    }
    if (/[·•‣]/.test(line)) {
      return line.split(/[·•‣]/).map((s) => s.trim()).filter(Boolean);
    }
    if (line.includes(";")) {
      return line.split(";").map((s) => s.trim()).filter(Boolean);
    }
    if (allowComma && line.includes(",")) {
      return line.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [line.trim()].filter(Boolean);
  }

  function parseLine(line, allowComma) {
    const quoteRegex = /"([^"]+)"|'([^']+)'/g;
    const quoted = [];
    let m;
    let hasQuotes = false;
    while ((m = quoteRegex.exec(line)) !== null) {
      hasQuotes = true;
      quoted.push((m[1] || m[2]).trim());
    }
    if (hasQuotes) {
      const leftover = line.replace(quoteRegex, "").trim();
      const leftoverTerms = leftover ? splitByDelimiter(leftover, allowComma) : [];
      return [...quoted, ...leftoverTerms].filter(Boolean);
    }
    return splitByDelimiter(line, allowComma);
  }

  function parseSearchTerms(raw) {
    if (!raw) return [];
    const lines = raw
      .split(/\r?\n/)
      .map((l) => stripBulletMarker(l.trim()))
      .filter(Boolean);
    const allowComma = lines.length <= 1;
    let terms = [];
    lines.forEach((line) => {
      terms = terms.concat(parseLine(line, allowComma));
    });
    const seen = new Set();
    const result = [];
    terms.forEach((t) => {
      const key = t.toLowerCase();
      if (t && !seen.has(key)) {
        seen.add(key);
        result.push(t);
      }
    });
    return result;
  }

  // =========================================================
  // 2. VISIBILITY / OWN-HIGHLIGHT HELPERS
  // =========================================================
  function isVisible(el) {
    if (!el) return true;
    if (el.nodeType === Node.TEXT_NODE) el = el.parentElement;
    let node = el;
    while (node && node.nodeType === 1) {
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
      node = node.parentElement;
    }
    return true;
  }

  function isOwnHighlight(node) {
    if (!node) return false;
    if (node.nodeType === 1 && node.classList && node.classList.contains(MARK_CLASS)) return true;
    if (node.nodeType === 1 && node.closest && node.closest("." + MARK_CLASS)) return true;
    return false;
  }

  // =========================================================
  // 3. FUZZY MATCH PATTERN
  //    Tolerates copy/paste punctuation drift: smart quotes vs
  //    straight quotes, different dash characters, extra/odd
  //    whitespace between words.
  // =========================================================
  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function fuzzyPattern(term) {
    const SINGLE_Q = "['’‘]";
    const DOUBLE_Q = '["“”]';

    let core = term.trim();
    let leadingQ = null;
    let trailingQ = null;

    if (/^['’‘]/.test(core)) {
      leadingQ = SINGLE_Q;
      core = core.slice(1);
    } else if (/^["“”]/.test(core)) {
      leadingQ = DOUBLE_Q;
      core = core.slice(1);
    }

    if (/['’‘]$/.test(core)) {
      trailingQ = SINGLE_Q;
      core = core.slice(0, -1);
    } else if (/["“”]$/.test(core)) {
      trailingQ = DOUBLE_Q;
      core = core.slice(0, -1);
    }

    let p = escapeRegExp(core);
    p = p.replace(/ +/g, "\\s+");
    p = p.replace(/['’‘]/g, SINGLE_Q);
    p = p.replace(/["“”]/g, DOUBLE_Q);
    p = p.replace(/[-‐‑‒–—]/g, "[-‐‑‒–—]");

    // A leading/trailing quote is often a copy-paste artifact (e.g. a
    // pull-quote's closing mark got included in the paste, but the actual
    // rendered page text has no quote character there at all — it's shown
    // via a decorative icon instead). Make just that edge character
    // optional, so the term still matches whether or not it's really there.
    if (leadingQ) p = leadingQ + "?" + p;
    if (trailingQ) p = p + trailingQ + "?";

    return p;
  }

  function buildFuzzyRegex(words) {
    const patterns = words.map(fuzzyPattern).filter(Boolean);
    return new RegExp("(" + patterns.join("|") + ")", "gi");
  }

  // =========================================================
  // 4. CROSS-INLINE-TAG BLOCK MATCHING ENGINE
  //    A phrase like "Situation: Greenlight needed..." often has
  //    its first word(s) inside a <strong>/<em>/<a> and the rest
  //    in a sibling text node. Matching one DOM text node at a
  //    time can never find that phrase. So: find the smallest
  //    containers with no nested block-level children (a <li>, a
  //    <p>, etc.), flatten just THEIR text across inline tags,
  //    match against that, then wrap only the matched portions
  //    back into their original text nodes (possibly several
  //    spans for one phrase, if it crosses tag boundaries).
  // =========================================================
  function isInlineDisplay(display) {
    return (
      display === "inline" ||
      display === "inline-block" ||
      display === "inline-flex" ||
      display === "inline-grid" ||
      display === "contents" ||
      display === "ruby"
    );
  }

  function isBlockElement(el) {
    if (!el || el.nodeType !== 1) return false;
    const style = window.getComputedStyle(el);
    return !isInlineDisplay(style.display);
  }

  function collectLeafBlocks(el, out) {
    if (!el || el.nodeType !== 1) return;
    if (SKIP_TAGS.has(el.tagName)) return;
    if (el.isContentEditable) return;
    if (el.closest && el.closest('[contenteditable="true"]')) return;
    if (isOwnHighlight(el)) return;
    if (!isVisible(el)) return;

    const children = Array.from(el.children).filter((c) => !SKIP_TAGS.has(c.tagName));
    const hasBlockChild = children.some((c) => isBlockElement(c));
    if (!hasBlockChild) {
      out.push(el);
      return;
    }
    children.forEach((c) => collectLeafBlocks(c, out));
  }

  function collectTextNodeMap(leafEl) {
    const walker = document.createTreeWalker(leafEl, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
        const parent = node.parentNode;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
        if (isOwnHighlight(parent)) return NodeFilter.FILTER_REJECT;
        if (!isVisible(parent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const map = [];
    let offset = 0;
    let node;
    while ((node = walker.nextNode())) {
      const len = node.nodeValue.length;
      map.push({ node, start: offset, end: offset + len });
      offset += len;
    }
    return { map, fullText: map.map((e) => e.node.nodeValue).join("") };
  }

  // =========================================================
  // COLOR + CONTRAST
  //    The highlight paints its own background over whatever was
  //    there before, so we must never blindly inherit the page's
  //    original text color (a dark-themed site's white text would
  //    become unreadable on a light highlight, and vice versa).
  //    Instead we always compute a text color that has good
  //    contrast against OUR OWN chosen highlight background.
  // =========================================================
  const HIGHLIGHT_BG = "#4ade80"; // green = matched on page

  function getContrastTextColor(hexColor) {
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? "#111111" : "#ffffff";
  }

  const HIGHLIGHT_TEXT = getContrastTextColor(HIGHLIGHT_BG);

  function applyHighlightStyle(span) {
    span.className = MARK_CLASS;
    span.style.background = HIGHLIGHT_BG;
    span.style.color = HIGHLIGHT_TEXT;
    span.style.fontWeight = "bold";
    span.style.padding = "0";
    span.style.margin = "0";
    span.style.border = "0";
    span.style.borderRadius = "2px";
    span.style.display = "inline";
  }

  function highlightTextNodeGroup(map, fullText, words) {
    const regex = buildFuzzyRegex(words);
    const matches = [];
    let m;
    while ((m = regex.exec(fullText)) !== null) {
      if (m[0].length === 0) {
        regex.lastIndex++;
        continue;
      }
      matches.push([m.index, m.index + m[0].length]);
    }
    if (matches.length === 0) return 0;

    map.forEach((entry) => {
      const localRanges = [];
      matches.forEach(([mStart, mEnd]) => {
        const segStart = Math.max(mStart, entry.start);
        const segEnd = Math.min(mEnd, entry.end);
        if (segStart < segEnd) localRanges.push([segStart - entry.start, segEnd - entry.start]);
      });
      if (localRanges.length === 0) return;

      const text = entry.node.nodeValue;
      const frag = document.createDocumentFragment();
      let cursor = 0;
      localRanges.forEach(([s, e]) => {
        if (s > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, s)));
        const span = document.createElement("span");
        span.textContent = text.slice(s, e);
        applyHighlightStyle(span);
        frag.appendChild(span);
        cursor = e;
      });
      if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
      if (entry.node.parentNode) entry.node.parentNode.replaceChild(frag, entry.node);
    });

    return matches.length;
  }

  function countTermOccurrences(term, leafTexts) {
    const pattern = fuzzyPattern(term);
    if (!pattern) return 0;
    const regex = new RegExp(pattern, "gi");
    let total = 0;
    leafTexts.forEach((text) => {
      let m;
      regex.lastIndex = 0;
      while ((m = regex.exec(text)) !== null) {
        total++;
        if (m[0].length === 0) regex.lastIndex++;
      }
    });
    return total;
  }

  function highlightWithinRoot(root, words) {
    if (!root || !words.length) return { count: 0, termCounts: words.map(() => 0) };
    if (root.nodeType === 3) {
      const fullText = root.nodeValue;
      const count = highlightTextNodeGroup(
        [{ node: root, start: 0, end: fullText.length }],
        fullText,
        words
      );
      const termCounts = words.map((w) => countTermOccurrences(w, [fullText]));
      return { count, termCounts };
    }
    if (root.nodeType !== 1 || SKIP_TAGS.has(root.tagName)) {
      return { count: 0, termCounts: words.map(() => 0) };
    }

    const leaves = [];
    collectLeafBlocks(root, leaves);

    // Snapshot every leaf's flattened text BEFORE any mutation happens, so
    // per-term counting and the actual wrapping both work off the same
    // unmodified text (mutating while counting would throw off offsets).
    const snapshots = leaves
      .map((leaf) => collectTextNodeMap(leaf))
      .filter((s) => s.fullText.trim());

    const leafTexts = snapshots.map((s) => s.fullText);
    const termCounts = words.map((w) => countTermOccurrences(w, leafTexts));

    let total = 0;
    snapshots.forEach(({ map, fullText }) => {
      total += highlightTextNodeGroup(map, fullText, words);
    });

    return { count: total, termCounts };
  }

  function clearAllHighlights() {
    let count = 0;
    document.querySelectorAll("span." + MARK_CLASS).forEach((span) => {
      const parent = span.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize();
      count++;
    });
    return count;
  }

  // =========================================================
  // 5. MUTATION OBSERVER — dynamically loaded content (AJAX/SPA)
  // =========================================================
  function startObserving() {
    if (observer) observer.disconnect();
    observer = new MutationObserver((mutations) => {
      if (!activeWords.length) return;
      observer.disconnect();
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (isOwnHighlight(node)) return;
            highlightWithinRoot(node, activeWords);
          });
        } else if (mutation.type === "characterData") {
          const parent = mutation.target.parentNode;
          if (parent && !isOwnHighlight(parent)) {
            highlightWithinRoot(mutation.target, activeWords);
          }
        }
      });
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      }
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }

  function stopObserving() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // =========================================================
  // 6. PUBLIC ACTIONS
  // =========================================================
  function highlight(rawInput) {
    const words = parseSearchTerms(rawInput);
    clearAllHighlights();
    stopObserving();
    if (words.length === 0) return { count: 0, terms: [], termCounts: [] };
    activeWords = words;
    const { count, termCounts } = highlightWithinRoot(document.body, words);
    startObserving();
    return { count, terms: words, termCounts };
  }

  function clear() {
    activeWords = [];
    stopObserving();
    const count = clearAllHighlights();
    return { count };
  }

  // =========================================================
  // 7. MESSAGE LISTENER
  // =========================================================
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === "MWH_HIGHLIGHT") {
      sendResponse(highlight(msg.raw || ""));
    } else if (msg.type === "MWH_CLEAR") {
      sendResponse(clear());
    } else if (msg.type === "MWH_PING") {
      sendResponse({ ok: true });
    }
    return true;
  });
})();
