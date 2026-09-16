const wordsInput = document.getElementById("words");
const statusEl = document.getElementById("status");
const breakdownEl = document.getElementById("termBreakdown");

chrome.storage.local.get(["mwh_last_words"], (res) => {
  if (res.mwh_last_words) wordsInput.value = res.mwh_last_words;
});

function setStatus(msg) {
  statusEl.textContent = msg;
}

function renderBreakdown(terms, termCounts) {
  breakdownEl.innerHTML = "";
  if (!terms || !terms.length) return;
  terms.forEach((term, i) => {
    const count = termCounts ? termCounts[i] : 0;
    const chip = document.createElement("span");
    chip.className = "term-chip " + (count > 0 ? "matched" : "unmatched");
    chip.textContent = count > 0 ? `${term} (${count})` : `${term} — not found`;
    chip.title = term;
    breakdownEl.appendChild(chip);
  });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function sendToContentScript(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }, () => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          chrome.tabs.sendMessage(tabId, message, (retryResponse) => {
            resolve(chrome.runtime.lastError ? null : retryResponse);
          });
        });
      } else {
        resolve(response);
      }
    });
  });
}

document.getElementById("highlightBtn").addEventListener("click", async () => {
  const raw = wordsInput.value;
  if (!raw.trim()) {
    setStatus("Enter at least one word or phrase.");
    breakdownEl.innerHTML = "";
    return;
  }
  chrome.storage.local.set({ mwh_last_words: raw });

  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    setStatus("No active tab found.");
    return;
  }
  const result = await sendToContentScript(tab.id, { type: "MWH_HIGHLIGHT", raw });
  if (!result) {
    setStatus("Can't run on this page (e.g. chrome:// pages).");
    breakdownEl.innerHTML = "";
    return;
  }
  setStatus(
    result.count > 0
      ? `Highlighted ${result.count} match(es) across ${result.terms.length} term(s). Watching for new content...`
      : "No matches found."
  );
  renderBreakdown(result.terms, result.termCounts);
});

document.getElementById("clearBtn").addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    setStatus("No active tab found.");
    return;
  }
  const result = await sendToContentScript(tab.id, { type: "MWH_CLEAR" });
  breakdownEl.innerHTML = "";
  if (!result) {
    setStatus("Can't run on this page (e.g. chrome:// pages).");
    return;
  }
  setStatus(result.count > 0 ? `Cleared ${result.count} highlight(s).` : "Nothing to clear.");
});

