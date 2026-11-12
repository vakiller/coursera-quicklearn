import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { FETCH_KIND, handleFetchMessage } from '../src/bridge';

declare global {
  interface Window {
    __courseraVaultBridge?: boolean;
  }
}

export default defineContentScript({
  matches: ['https://www.coursera.org/*'],
  main() {
    if (window.__courseraVaultBridge) return;
    window.__courseraVaultBridge = true;
    browser.runtime.onMessage.addListener((msg: unknown, _sender: unknown, sendResponse: (r: unknown) => void) => {
      if ((msg as { kind?: string })?.kind !== FETCH_KIND) return undefined;
      handleFetchMessage(msg, async (url) => {
        const res = await fetch(url, { credentials: 'include' });
        return { status: res.status, text: await res.text() };
      })
        .then(sendResponse)
        .catch((e: unknown) => sendResponse({ status: 599, text: String(e) }));
      return true;
    });
  },
});
