import { browser } from 'wxt/browser';
import type { ResumeEntry, ResumeStore } from './sync-course';

const key = (slug: string) => `resume:${slug}`;

export const chromeResumeStore: ResumeStore = {
  load: async (slug) => ((await browser.storage.local.get(key(slug)))[key(slug)] as ResumeEntry | undefined) ?? null,
  save: (slug, entry) => browser.storage.local.set({ [key(slug)]: entry }),
  clear: (slug) => browser.storage.local.remove(key(slug)),
};
