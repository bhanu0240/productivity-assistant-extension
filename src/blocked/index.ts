/**
 * Blocked-site page. Blocked domains are redirected here (see syncBlockRules in the
 * service worker) so none of the blocked site loads behind it.
 * The original URL arrives as everything after "?url=".
 */

const marker = "?url=";
const search = location.search;
const blockedUrl = search.startsWith(marker) ? decodeURIComponentSafe(search.slice(marker.length)) : "";

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

let host = "";
try {
  host = new URL(blockedUrl).hostname.replace(/^www\./, "");
} catch {
  /* unknown URL — leave the domain line empty */
}

const domainEl = document.getElementById("domain")!;
domainEl.textContent = host;
if (host) document.title = `${host} is blocked`;

const backBtn = document.getElementById("back") as HTMLButtonElement;
if (history.length <= 1) backBtn.hidden = true;
backBtn.addEventListener("click", () => history.back());

document.getElementById("close")!.addEventListener("click", () => {
  chrome.tabs.getCurrent((tab) => {
    if (tab?.id !== undefined) chrome.tabs.remove(tab.id);
    else window.close();
  });
});
