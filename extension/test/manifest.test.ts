import { readFileSync } from 'node:fs';
import { buildManifest, mergeWithPrevious, type ItemResult } from '../src/vault/manifest';
import { parseCourse, parseOutline } from '../src/coursera/parse';
import type { Manifest } from '../src/shared/types';

const load = (f: string) => JSON.parse(readFileSync(`test/fixtures/${f}`, 'utf8'));
const outline = parseOutline(load('outline.json'), parseCourse(load('course.json')));
const T = '2026-11-11T09:00:00Z';

describe('buildManifest', () => {
  const results = new Map<string, ItemResult>([
    ['qHFCW', { status: 'ok', hash: 'sha256:1', file: 'raw/01 - Introduction to Course 2 (video).md' }],
  ]);
  const m = buildManifest(outline, results, T);

  it('carries course identity and module folders', () => {
    expect(m.schema).toBe('coursera-vault/1');
    expect(m.course).toEqual({ id: outline.id, slug: outline.slug, title: outline.name, fetched_at: T });
    expect(m.modules[0]!.folder).toBe('M01 - Fundamentals of project initiation');
    expect(m.modules[0]!.index).toBe(1);
  });

  it('records fetched items with file and hash', () => {
    expect(m.modules[0]!.items[0]).toEqual({
      index: 1, id: 'qHFCW', type: 'video', title: 'Introduction to Course 2',
      file: 'raw/01 - Introduction to Course 2 (video).md', content_hash: 'sha256:1', status: 'ok',
    });
  });

  it('records quizzes without a file', () => {
    const q = m.modules[0]!.items.find((i) => i.id === 'oLmxE')!;
    expect(q).toMatchObject({ type: 'quiz', graded: true, file: null, content_hash: null, status: 'not_fetched' });
  });

  it('numbers items within each module including quizzes', () => {
    expect(m.modules[1]!.items.map((i) => i.index)).toEqual(m.modules[1]!.items.map((_, k) => k + 1));
  });
});

describe('mergeWithPrevious', () => {
  const next = buildManifest(outline, new Map(), T);

  it('returns next unchanged when there is no previous manifest', () => {
    expect(mergeWithPrevious(next, null)).toEqual(next);
  });

  it('keeps items that disappeared from the course as removed, with their old file', () => {
    const prev: Manifest = structuredClone(next);
    prev.modules[0]!.items.push({ index: 99, id: 'GONE1', type: 'video', title: 'Old video', file: 'raw/99 - Old video (video).md', content_hash: 'sha256:x', status: 'ok' });
    const merged = mergeWithPrevious(next, prev);
    const gone = merged.modules[0]!.items.find((i) => i.id === 'GONE1')!;
    expect(gone).toMatchObject({ status: 'removed', file: 'raw/99 - Old video (video).md', content_hash: 'sha256:x' });
    expect(merged.modules[0]!.items.length).toBe(next.modules[0]!.items.length + 1);
  });

  it('keeps whole modules that disappeared as removed', () => {
    const prev: Manifest = structuredClone(next);
    prev.modules.push({ index: 9, id: 'OLDMOD', title: 'Old', folder: 'M09 - Old', items: [{ index: 1, id: 'Z', type: 'reading', title: 'z', file: 'raw/01 - z (reading).md', content_hash: 'h', status: 'ok' }] });
    const merged = mergeWithPrevious(next, prev);
    expect(merged.modules.at(-1)).toMatchObject({ id: 'OLDMOD', items: [{ id: 'Z', status: 'removed' }] });
  });

  it('carries the previous file and hash forward when an item becomes locked/unavailable/error', () => {
    const prev: Manifest = structuredClone(next);
    Object.assign(prev.modules[0]!.items[0]!, { status: 'ok', file: 'raw/01 - a (video).md', content_hash: 'sha256:p' });
    const now: Manifest = structuredClone(next);
    Object.assign(now.modules[0]!.items[0]!, { status: 'locked', file: null, content_hash: null });
    expect(mergeWithPrevious(now, prev).modules[0]!.items[0]).toMatchObject({ status: 'locked', file: 'raw/01 - a (video).md', content_hash: 'sha256:p' });
  });
});
