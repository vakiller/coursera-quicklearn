import { readFileSync } from 'node:fs';
import { syncCourse, memoryResumeStore } from '../src/sync/sync-course';
import { CourseraClient, type Fetcher } from '../src/coursera/client';
import { MemoryWriter } from '../src/vault/writers';
import type { Manifest } from '../src/shared/types';

const fx = (f: string) => readFileSync(`test/fixtures/${f}`, 'utf8');
const SLUG = 'project-initiation-google';
const BASE = `Coursera/${SLUG}`;
const lecture = JSON.parse(fx('lecture-video.json'));
const enUrl: string = lecture.linked['onDemandVideos.v1'][0].subtitlesVtt.en;

interface Opts {
  vttFor?: (itemId: string) => string;
  noEnglishFor?: string;
  status401For?: string;
}

function makeFetcher(opts: Opts = {}) {
  const calls: string[] = [];
  const fetcher: Fetcher = async (url) => {
    calls.push(url);
    const itemId = /~([^?]+)\?/.exec(url)?.[1];
    if (itemId && itemId === opts.status401For) return { status: 401, text: '' };
    if (url.includes('onDemandCourses.v1')) return { status: 200, text: fx('course.json') };
    if (url.includes('onDemandCourseMaterials')) return { status: 200, text: fx('outline.json') };
    if (url.includes('onDemandLectureVideos')) {
      const copy = structuredClone(lecture);
      const subs = copy.linked['onDemandVideos.v1'][0].subtitlesVtt;
      if (itemId === opts.noEnglishFor) delete subs.en;
      else subs.en = `${enUrl}&for=${itemId}`;
      return { status: 200, text: JSON.stringify(copy) };
    }
    if (url.includes('subtitleAssetProxy')) {
      const id = new URL(url).searchParams.get('for') ?? '';
      return { status: 200, text: opts.vttFor?.(id) ?? fx('subtitle-en.vtt') };
    }
    if (url.includes('onDemandSupplements')) return { status: 200, text: fx('supplement.json') };
    return { status: 404, text: '' };
  };
  return { fetcher, calls };
}

const deps = (fetcher: Fetcher, writer: MemoryWriter, resume = memoryResumeStore()) => ({
  client: new CourseraClient(fetcher, { sleep: async () => {} }),
  writer,
  resume,
  lang: 'en',
  now: () => '2026-11-11T09:00:00Z',
});

const manifestOf = (w: MemoryWriter) => JSON.parse(w.files.get(`${BASE}/_manifest.json`)!) as Manifest;

describe('syncCourse', () => {
  it('writes course, manifest, module pages and raw files, but nothing for quizzes', async () => {
    const w = new MemoryWriter();
    const { fetcher, calls } = makeFetcher();
    const report = await syncCourse(SLUG, deps(fetcher, w));
    expect(w.files.has(`${BASE}/_course.md`)).toBe(true);
    const m = manifestOf(w);
    expect(m.modules).toHaveLength(4);
    for (const mod of m.modules) expect(w.files.has(`${BASE}/${mod.folder}/_module.md`)).toBe(true);
    const content = m.modules.flatMap((x) => x.items).filter((i) => i.type === 'video' || i.type === 'reading');
    for (const it of content) {
      const mod = m.modules.find((x) => x.items.includes(it))!;
      expect(it.status).toBe('ok');
      expect(w.files.has(`${BASE}/${mod.folder}/${it.file}`)).toBe(true);
    }
    const rawFiles = [...w.files.keys()].filter((k) => k.includes('/raw/'));
    expect(rawFiles).toHaveLength(content.length);
    expect(rawFiles.some((k) => /quiz|Challenge/i.test(k))).toBe(false);
    expect(report.quizzes).toBe(m.modules.flatMap((x) => x.items).filter((i) => i.type === 'quiz').length);
    expect(report).toMatchObject({ ok: content.length, written: content.length, unchanged: 0, stoppedForAuth: false });
    expect(calls.some((u) => /exam|quiz|assignment/i.test(new URL(u).pathname))).toBe(false);
  });

  it('writes nothing on a second sync of unchanged content', async () => {
    const w = new MemoryWriter();
    await syncCourse(SLUG, deps(makeFetcher().fetcher, w));
    const report = await syncCourse(SLUG, deps(makeFetcher().fetcher, w));
    expect(report.written).toBe(0);
    expect(report.unchanged).toBe(report.ok);
  });

  it('rewrites only the video whose transcript changed', async () => {
    const w = new MemoryWriter();
    await syncCourse(SLUG, deps(makeFetcher().fetcher, w));
    const changed = makeFetcher({ vttFor: (id) => (id === 'r7wIt' ? 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nUpdated.\n' : fx('subtitle-en.vtt')) });
    const report = await syncCourse(SLUG, deps(changed.fetcher, w));
    expect(report.written).toBe(1);
    const file = [...w.files.entries()].find(([k]) => k.includes('Why is project initiation essential'))!;
    expect(file[1]).toContain('Updated. ^t0001');
  });

  it('marks a video without the chosen language as unavailable and continues', async () => {
    const w = new MemoryWriter();
    const report = await syncCourse(SLUG, deps(makeFetcher({ noEnglishFor: 'qHFCW' }).fetcher, w));
    const item = manifestOf(w).modules[0]!.items[0]!;
    expect(item).toMatchObject({ id: 'qHFCW', status: 'unavailable', file: null });
    expect(report.unavailable).toBe(1);
    expect(report.ok).toBeGreaterThan(10);
  });

  it('stops on an expired session and resumes where it left off', async () => {
    const w = new MemoryWriter();
    const resume = memoryResumeStore();
    const first = await syncCourse(SLUG, deps(makeFetcher({ status401For: 'KgGcu' }).fetcher, w, resume));
    expect(first.stoppedForAuth).toBe(true);
    expect(Object.keys(await resume.load(SLUG)).sort()).toEqual(['CQ4he', 'qHFCW']);
    expect(w.files.has(`${BASE}/_manifest.json`)).toBe(false);

    const again = makeFetcher();
    const second = await syncCourse(SLUG, deps(again.fetcher, w, resume));
    expect(second.stoppedForAuth).toBe(false);
    expect(again.calls.some((u) => u.includes('~qHFCW') || u.includes('~CQ4he'))).toBe(false);
    expect(manifestOf(w).modules[0]!.items[0]!.status).toBe('ok');
    expect(await resume.load(SLUG)).toEqual({});
  });

  it('reports progress over content items', async () => {
    const seen: number[] = [];
    const w = new MemoryWriter();
    await syncCourse(SLUG, { ...deps(makeFetcher().fetcher, w), onProgress: (done, total) => seen.push(done / total) });
    expect(seen.at(-1)).toBe(1);
  });
});
