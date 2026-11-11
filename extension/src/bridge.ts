import { isAllowedUrl } from './coursera/endpoints';

export const FETCH_KIND = 'coursera-fetch';

export type FetchReply = { status: number; text: string };

export function detectCourseSlug(url: string | undefined): string | null {
  const m = url ? /^https:\/\/www\.coursera\.org\/learn\/([^/?#]+)/.exec(url) : null;
  return m?.[1] ?? null;
}

/** Content-script side: re-checks the allowlist before touching the network. */
export async function handleFetchMessage(
  msg: unknown,
  doFetch: (url: string) => Promise<FetchReply>,
): Promise<FetchReply | undefined> {
  const m = msg as { kind?: string; url?: string };
  if (m?.kind !== FETCH_KIND || typeof m.url !== 'string') return undefined;
  if (!isAllowedUrl(m.url)) return { status: 0, text: 'NOT_ALLOWED' };
  return doFetch(m.url);
}
