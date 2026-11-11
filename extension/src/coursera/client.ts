import type { CourseOutline } from '../shared/types';
import { isAllowedUrl, urls } from './endpoints';
import { parseCourse, parseOutline, parseSubtitleUrls, parseSupplementCml } from './parse';

export type Fetcher = (url: string) => Promise<{ status: number; text: string }>;

export class NotAllowedError extends Error {
  constructor(url: string) {
    super(`Blocked request to non-allowlisted URL: ${url}`);
  }
}
export class AuthError extends Error {
  constructor() {
    super('Coursera session is not authorised (logged out or expired).');
  }
}
export class LockedError extends Error {
  constructor(url: string) {
    super(`Item is locked for this account: ${url}`);
  }
}
export class HttpError extends Error {
  constructor(public status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
  }
}

const CONSECUTIVE_403_LIMIT = 5;

export class CourseraClient {
  private readonly delayMs: number;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private hasRequested = false;
  private forbiddenStreak = 0;

  constructor(
    private readonly fetcher: Fetcher,
    opts: { delayMs?: number; maxRetries?: number; sleep?: (ms: number) => Promise<void> } = {},
  ) {
    this.delayMs = opts.delayMs ?? 700;
    this.maxRetries = opts.maxRetries ?? 3;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async request(url: string): Promise<string> {
    if (!isAllowedUrl(url)) throw new NotAllowedError(url);
    if (this.hasRequested) await this.sleep(this.delayMs);
    this.hasRequested = true;

    for (let attempt = 0; ; attempt++) {
      if (attempt > 0) await this.sleep(this.delayMs * 2 ** attempt);
      let res: { status: number; text: string };
      try {
        res = await this.fetcher(url);
      } catch {
        res = { status: 599, text: '' };
      }
      if (res.status === 0 && res.text === 'NOT_ALLOWED') throw new NotAllowedError(url);
      if (res.status >= 200 && res.status < 300) {
        this.forbiddenStreak = 0;
        return res.text;
      }
      if (res.status === 401) throw new AuthError();
      if (res.status === 403) {
        this.forbiddenStreak++;
        if (this.forbiddenStreak >= CONSECUTIVE_403_LIMIT) throw new AuthError();
        throw new LockedError(url);
      }
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= this.maxRetries) throw new HttpError(res.status, url);
    }
  }

  async getOutline(slug: string): Promise<CourseOutline> {
    const course = parseCourse(JSON.parse(await this.request(urls.course(slug))));
    return parseOutline(JSON.parse(await this.request(urls.outline(slug))), course);
  }

  async getTranscript(courseId: string, itemId: string, lang: string): Promise<string | null> {
    const subs = parseSubtitleUrls(JSON.parse(await this.request(urls.lectureVideo(courseId, itemId))));
    const url = subs[lang];
    return url ? this.request(url) : null;
  }

  async getReadingCml(courseId: string, itemId: string): Promise<string> {
    return parseSupplementCml(JSON.parse(await this.request(urls.supplement(courseId, itemId))));
  }
}
