import { readFileSync } from 'node:fs';
import { sha256 } from '../src/vault/hash';
import { renderRawFile, renderCourseMd, renderModuleMd, itemUrl, type RawMeta } from '../src/vault/render';
import { parseCourse, parseOutline } from '../src/coursera/parse';
import type { Manifest, ManifestModule } from '../src/shared/types';

const load = (f: string) => JSON.parse(readFileSync(`test/fixtures/${f}`, 'utf8'));
const outline = parseOutline(load('outline.json'), parseCourse(load('course.json')));

const meta: RawMeta = {
  type: 'video',
  course_slug: 'project-initiation-google',
  course_id: 'cid',
  module: 1,
  module_title: 'Fundamentals',
  lesson: 'Getting started',
  item_index: 1,
  item_id: 'qHFCW',
  title: 'Say "hi"',
  url: 'https://www.coursera.org/learn/project-initiation-google/lecture/qHFCW/x',
  duration_min: 3,
  language: 'en',
  fetched_at: '2026-11-11T09:00:00Z',
  content_hash: 'sha256:abc',
};

describe('sha256', () => {
  it('returns a prefixed hex digest', async () => {
    expect(await sha256('abc')).toBe('sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('renderRawFile', () => {
  const out = renderRawFile(meta, 'BODY\n');
  it('writes frontmatter keys in spec order', () => {
    const keys = out.split('---')[1]!.trim().split('\n').map((l) => l.split(':')[0]);
    expect(keys).toEqual([
      'schema', 'type', 'course_slug', 'course_id', 'module', 'module_title', 'lesson', 'item_index',
      'item_id', 'title', 'url', 'duration_min', 'language', 'fetched_at', 'content_hash',
    ]);
    expect(out.startsWith('---\nschema: coursera-vault/1\ntype: video\n')).toBe(true);
  });
  it('escapes quotes and appends title + body', () => {
    expect(out).toContain('title: "Say \\"hi\\""');
    expect(out).toContain('module: 1\n');
    expect(out.endsWith('---\n\n# Say "hi"\n\nBODY\n')).toBe(true);
  });
  it('omits duration_min when unknown', () => {
    const { duration_min, ...rest } = meta;
    expect(renderRawFile(rest, 'x')).not.toContain('duration_min');
  });
});

describe('itemUrl', () => {
  it('builds lecture, supplement and generic item URLs', () => {
    const m = outline.modules[0]!;
    expect(itemUrl('s', m.items[0]!)).toBe('https://www.coursera.org/learn/s/lecture/qHFCW/' + m.items[0]!.slug);
    expect(itemUrl('s', m.items[1]!)).toBe('https://www.coursera.org/learn/s/supplement/CQ4he/' + m.items[1]!.slug);
    expect(itemUrl('s', m.items.find((i) => i.type === 'quiz')!)).toMatch(/^https:\/\/www\.coursera\.org\/learn\/s\/item\/\w+$/);
  });
});

describe('renderModuleMd / renderCourseMd', () => {
  const mod = outline.modules[0]!;
  const mm: ManifestModule = {
    index: 1,
    id: mod.id,
    title: mod.name,
    folder: 'M01 - Fundamentals of project initiation',
    items: mod.items.map((it, k) => ({
      index: k + 1,
      id: it.id,
      type: it.type,
      title: it.name,
      ...(it.type === 'quiz' ? { graded: it.graded } : {}),
      file: it.type === 'video' ? `raw/${String(k + 1).padStart(2, '0')} - x (video).md` : null,
      content_hash: null,
      status: it.type === 'video' ? 'ok' : it.type === 'quiz' ? 'not_fetched' : 'locked',
    })),
  };
  const md = renderModuleMd(mod, mm, 'project-initiation-google');

  it('lists every item in order with wikilinks for fetched files', () => {
    expect(md).toContain('[[Coursera/project-initiation-google/M01 - Fundamentals of project initiation/raw/01 - x (video)|Introduction to Course 2]]');
    expect(md.indexOf('Introduction to Course 2')).toBeLessThan(md.indexOf('Module 1 Challenge'));
  });
  it('shows quizzes as 🧪 lines with a Coursera link and no file link', () => {
    const line = md.split('\n').find((l) => l.includes('Module 1 Challenge'))!;
    expect(line).toMatch(/^- 🧪 Module 1 Challenge \(graded\) — \[Coursera\]\(https:\/\/www\.coursera\.org\/learn\/project-initiation-google\/item\/oLmxE\)$/);
  });
  it('includes the module description and skips empty learning objectives', () => {
    expect(md).toContain('You will learn how the program is structured');
    expect(md).not.toContain('## Learning objectives');
    expect(renderModuleMd({ ...mod, learningObjectives: ['Do X'] }, mm, 's')).toContain('## Learning objectives\n\n- Do X');
  });
  it('renders the course page with module links', () => {
    const manifest: Manifest = {
      schema: 'coursera-vault/1',
      course: { id: outline.id, slug: outline.slug, title: outline.name, fetched_at: '2026-11-11T09:00:00Z' },
      modules: [mm],
    };
    const c = renderCourseMd(outline, manifest);
    expect(c).toMatch(/^---\nschema: coursera-vault\/1\n/);
    for (const k of ['course_id:', 'slug:', 'title:', 'url: "https://www.coursera.org/learn/project-initiation-google"', 'fetched_at:']) expect(c).toContain(k);
    expect(c).toContain('[[Coursera/project-initiation-google/M01 - Fundamentals of project initiation/_module|M01 - Fundamentals of project initiation]]');
  });
});
