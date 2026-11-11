import { readFileSync } from 'node:fs';
import { parseCourse, parseOutline, parseSubtitleUrls, parseSupplementCml } from '../src/coursera/parse';

const load = (f: string) => JSON.parse(readFileSync(`test/fixtures/${f}`, 'utf8'));

describe('parseCourse', () => {
  it('reads id, slug and name', () => {
    expect(parseCourse(load('course.json'))).toEqual({
      id: 'mYs5UAp9Eeuh2QpCvqFzYQ',
      slug: 'project-initiation-google',
      name: 'Project Initiation: Starting a Successful Project',
    });
  });
});

describe('parseOutline', () => {
  const outline = parseOutline(load('outline.json'), parseCourse(load('course.json')));

  it('keeps course identity and module order', () => {
    expect(outline.id).toBe('mYs5UAp9Eeuh2QpCvqFzYQ');
    expect(outline.slug).toBe('project-initiation-google');
    expect(outline.modules.map((m) => m.name)).toEqual([
      'Fundamentals of project initiation',
      'Defining project goals, scope, and success criteria',
      'Working effectively with stakeholders',
      'Utilizing resources and tools for project success',
    ]);
    expect(outline.modules.every((m) => m.items.length > 0)).toBe(true);
    expect(outline.modules.flatMap((m) => m.items)).toHaveLength(85);
  });

  it('maps item types, graded flags, lessons and durations in page order', () => {
    const m1 = outline.modules[0]!;
    expect(m1.description).toMatch(/^You will learn how the program is structured/);
    expect(m1.learningObjectives).toEqual([]);
    expect(m1.items.slice(0, 3).map((i) => [i.id, i.type])).toEqual([
      ['qHFCW', 'video'],
      ['CQ4he', 'reading'],
      ['KgGcu', 'reading'],
    ]);
    expect(m1.items[0]).toMatchObject({ lessonName: 'Getting started with the course', durationMin: 3 });
    const challenge = m1.items.find((i) => i.name === 'Module 1 Challenge')!;
    expect(challenge).toMatchObject({ type: 'quiz', graded: true });
    const practice = outline.modules[1]!.items.find((i) => i.name === 'Test your knowledge: Identifying project goals')!;
    expect(practice).toMatchObject({ type: 'quiz', graded: false });
    expect(m1.items.find((i) => i.id === 'ThXXJ')!.type).toBe('other');
  });
});

describe('parseSubtitleUrls / parseSupplementCml', () => {
  it('returns absolute subtitle URLs by language', () => {
    const subs = parseSubtitleUrls(load('lecture-video.json'));
    expect(subs.en).toMatch(/^https:\/\/www\.coursera\.org\/api\/subtitleAssetProxy\.v1\//);
    expect(subs.vi).toBeDefined();
  });
  it('extracts the CML string', () => {
    expect(parseSupplementCml(load('supplement.json'))).toMatch(/^<co-content/);
  });
});
