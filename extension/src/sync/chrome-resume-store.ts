import { browser } from 'wxt/browser';
import type { ItemResult } from '../vault/manifest';
import type { ResumeStore } from './sync-course';

const key = (slug: string) => `resume:${slug}`;

export const chromeResumeStore: ResumeStore = {
  load: async (slug) => ((await browser.storage.local.get(key(slug)))[key(slug)] as Record<string, ItemResult> | undefined) ?? {},
  save: (slug, done) => browser.storage.local.set({ [key(slug)]: done }),
  clear: (slug) => browser.storage.local.remove(key(slug)),
};
