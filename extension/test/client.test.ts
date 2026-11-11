import { readFileSync } from 'node:fs';
import { CourseraClient, AuthError, HttpError, LockedError, NotAllowedError, type Fetcher } from '../src/coursera/client';
import { urls } from '../src/coursera/endpoints';

const fx = (f: string) => readFileSync(`test/fixtures/${f}`, 'utf8');

function setup(handler: (url: string, n: number) => { status: number; text: string }) {
  const calls: string[] = [];
  const sleeps: number[] = [];
  const fetcher: Fetcher = async (url) => {
    calls.push(url);
    return handler(url, calls.length);
  };
  const client = new CourseraClient(fetcher, { sleep: async (ms) => void sleeps.push(ms) });
  return { client, calls, sleeps };
}

const okRouter = (url: string) => {
  if (url.includes('onDemandCourses.v1')) return { status: 200, text: fx('course.json') };
  if (url.includes('onDemandCourseMaterials')) return { status: 200, text: fx('outline.json') };
  if (url.includes('onDemandLectureVideos')) return { status: 200, text: fx('lecture-video.json') };
  if (url.includes('subtitleAssetProxy')) return { status: 200, text: fx('subtitle-en.vtt') };
  if (url.includes('onDemandSupplements')) return { status: 200, text: fx('supplement.json') };
  return { status: 404, text: '' };
};

describe('CourseraClient', () => {
  it('loads the outline via course + materials endpoints', async () => {
    const { client, calls } = setup(okRouter);
    const outline = await client.getOutline('project-initiation-google');
    expect(outline.name).toBe('Project Initiation: Starting a Successful Project');
    expect(calls).toEqual([urls.course('project-initiation-google'), urls.outline('project-initiation-google')]);
  });

  it('waits 700ms between consecutive requests', async () => {
    const { client, sleeps } = setup(okRouter);
    await client.getOutline('x');
    expect(sleeps).toEqual([700]);
  });

  it('fetches the transcript in the requested language, or null when missing', async () => {
    const { client } = setup(okRouter);
    expect(await client.getTranscript('c', 'i', 'en')).toMatch(/^WEBVTT/);
    expect(await client.getTranscript('c', 'i', 'xx')).toBeNull();
  });

  it('returns reading CML', async () => {
    const { client } = setup(okRouter);
    expect(await client.getReadingCml('c', 'i')).toMatch(/^<co-content/);
  });

  it('retries 429 with growing backoff, then succeeds', async () => {
    const { client, sleeps, calls } = setup((u, n) => (n === 1 ? { status: 429, text: '' } : okRouter(u)));
    await client.getReadingCml('c', 'i');
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([1400]);
  });

  it('gives up on persistent 5xx after 4 attempts', async () => {
    const { client, calls } = setup(() => ({ status: 500, text: '' }));
    await expect(client.getReadingCml('c', 'i')).rejects.toBeInstanceOf(HttpError);
    expect(calls).toHaveLength(4);
  });

  it('throws AuthError immediately on 401 without retrying', async () => {
    const { client, calls } = setup(() => ({ status: 401, text: '' }));
    await expect(client.getReadingCml('c', 'i')).rejects.toBeInstanceOf(AuthError);
    expect(calls).toHaveLength(1);
  });

  it('treats a single 403 as a locked item, but 5 in a row as an expired session', async () => {
    const { client } = setup(() => ({ status: 403, text: fx('supplement-403.json') }));
    for (let k = 0; k < 4; k++) await expect(client.getReadingCml('c', `i${k}`)).rejects.toBeInstanceOf(LockedError);
    await expect(client.getReadingCml('c', 'i5')).rejects.toBeInstanceOf(AuthError);
  });

  it('resets the 403 streak after a success', async () => {
    let fail = true;
    const { client } = setup((u) => (fail ? { status: 403, text: '' } : okRouter(u)));
    for (let k = 0; k < 4; k++) await expect(client.getReadingCml('c', 'i')).rejects.toBeInstanceOf(LockedError);
    fail = false;
    await client.getReadingCml('c', 'i');
    fail = true;
    await expect(client.getReadingCml('c', 'i')).rejects.toBeInstanceOf(LockedError);
  });

  it('never calls the fetcher for a non-allowlisted URL', async () => {
    const { client, calls } = setup(okRouter);
    await expect(client.request('https://www.coursera.org/api/onDemandExamSessions.v1/x')).rejects.toBeInstanceOf(NotAllowedError);
    expect(calls).toHaveLength(0);
  });

  it('treats a bridge NOT_ALLOWED reply as NotAllowedError', async () => {
    const { client } = setup(() => ({ status: 0, text: 'NOT_ALLOWED' }));
    await expect(client.getReadingCml('c', 'i')).rejects.toBeInstanceOf(NotAllowedError);
  });
});
