import { detectCourseSlug, handleFetchMessage, FETCH_KIND } from '../src/bridge';
import { urls } from '../src/coursera/endpoints';

describe('detectCourseSlug', () => {
  it('reads the slug from a course page URL', () => {
    expect(detectCourseSlug('https://www.coursera.org/learn/project-initiation-google/home/module/3')).toBe('project-initiation-google');
    expect(detectCourseSlug('https://www.coursera.org/learn/foo?x=1')).toBe('foo');
  });
  it('returns null elsewhere', () => {
    expect(detectCourseSlug('https://www.coursera.org/')).toBeNull();
    expect(detectCourseSlug('https://evil.com/learn/foo')).toBeNull();
    expect(detectCourseSlug(undefined)).toBeNull();
  });
});

describe('handleFetchMessage', () => {
  it('fetches allowlisted URLs', async () => {
    const seen: string[] = [];
    const res = await handleFetchMessage({ kind: FETCH_KIND, url: urls.outline('s') }, async (u) => (seen.push(u), { status: 200, text: 'ok' }));
    expect(res).toEqual({ status: 200, text: 'ok' });
    expect(seen).toEqual([urls.outline('s')]);
  });
  it('refuses non-allowlisted URLs without fetching', async () => {
    let called = false;
    const res = await handleFetchMessage({ kind: FETCH_KIND, url: 'https://www.coursera.org/api/onDemandExamSessions.v1/x' }, async () => {
      called = true;
      return { status: 200, text: '' };
    });
    expect(res).toEqual({ status: 0, text: 'NOT_ALLOWED' });
    expect(called).toBe(false);
  });
  it('ignores unrelated messages', async () => {
    expect(await handleFetchMessage({ kind: 'other' }, async () => ({ status: 200, text: '' }))).toBeUndefined();
  });
});
