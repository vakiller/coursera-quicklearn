import { browser } from 'wxt/browser';
import { detectCourseSlug } from '../../src/bridge';

const msg = document.getElementById('msg')!;
const btn = document.getElementById('sync') as HTMLButtonElement;

const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
const slug = detectCourseSlug(tab?.url);
if (!slug || tab?.id === undefined) {
  msg.textContent = 'Mở trang khóa học Coursera (coursera.org/learn/…) trước.';
} else {
  msg.textContent = `Khóa: ${slug}`;
  btn.hidden = false;
  btn.onclick = async () => {
    await browser.tabs.create({ url: browser.runtime.getURL(`/sync.html?slug=${encodeURIComponent(slug)}&tabId=${tab.id}`) });
    window.close();
  };
}
