import { browser } from 'wxt/browser';
import { FETCH_KIND, type FetchReply } from './bridge';
import type { Fetcher } from './coursera/client';

/** Sync-page side: asks the content script in the Coursera tab to perform the fetch (same origin, user's session). */
export function makeTabFetcher(tabId: number): Fetcher {
  let injected = false;
  return async (url) => {
    try {
      return (await browser.tabs.sendMessage(tabId, { kind: FETCH_KIND, url })) as FetchReply;
    } catch (e) {
      if (injected) throw e;
      injected = true;
      await browser.scripting.executeScript({ target: { tabId }, files: ['/content-scripts/content.js'] });
      return (await browser.tabs.sendMessage(tabId, { kind: FETCH_KIND, url })) as FetchReply;
    }
  };
}
