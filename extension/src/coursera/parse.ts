import type { CourseOutline, ItemType, OutlineItem, OutlineModule } from '../shared/types';
import { ORIGIN } from './endpoints';

type Json = Record<string, any>;

export interface CourseInfo {
  id: string;
  slug: string;
  name: string;
}

export function parseCourse(json: unknown): CourseInfo {
  const e = (json as Json)?.elements?.[0];
  if (!e?.id) throw new Error('Unexpected course response: missing elements[0].id');
  return { id: e.id, slug: e.slug, name: e.name };
}

const READING = new Set(['supplement']);
const VIDEO = new Set(['lecture']);
const ASSESSMENT = new Set([
  'exam', 'quiz', 'staffGraded', 'ungradedAssignment', 'peer', 'phasedPeer', 'gradedPeer',
  'gradedProgramming', 'ungradedProgramming', 'gradedLti', 'ungradedLti', 'closedPeer', 'splitPeerReviewItem',
]);
const GRADED = new Set(['exam', 'staffGraded', 'peer', 'phasedPeer', 'gradedPeer', 'gradedProgramming', 'gradedLti', 'closedPeer']);

function itemType(typeName: string): ItemType {
  if (VIDEO.has(typeName)) return 'video';
  if (READING.has(typeName)) return 'reading';
  if (ASSESSMENT.has(typeName)) return 'quiz';
  return 'other';
}

export function parseOutline(json: unknown, course: CourseInfo): CourseOutline {
  const root = json as Json;
  const linked = root?.linked ?? {};
  const byId = <T extends Json>(arr: T[] | undefined) => new Map((arr ?? []).map((x) => [x.id as string, x]));
  const modules = byId(linked['onDemandCourseMaterialModules.v1']);
  const lessons = byId(linked['onDemandCourseMaterialLessons.v1']);
  const items = byId(linked['onDemandCourseMaterialItems.v2']);
  const moduleIds: string[] = root?.elements?.[0]?.moduleIds ?? [];
  if (moduleIds.length === 0) throw new Error('Unexpected outline response: no moduleIds');

  const outModules: OutlineModule[] = moduleIds.flatMap((mid) => {
    const m = modules.get(mid);
    if (!m) return [];
    const outItems: OutlineItem[] = [];
    for (const lid of (m.lessonIds ?? []) as string[]) {
      const lesson = lessons.get(lid);
      if (!lesson) continue;
      for (const iid of (lesson.itemIds ?? []) as string[]) {
        const it = items.get(iid);
        if (!it) continue;
        const typeName: string = it.contentSummary?.typeName ?? '';
        const durationMs: number | undefined = it.contentSummary?.definition?.duration ?? it.timeCommitment;
        outItems.push({
          id: it.id,
          slug: it.slug ?? '',
          name: it.name ?? '',
          type: itemType(typeName),
          graded: GRADED.has(typeName),
          locked: Boolean(it.isLocked),
          lessonName: lesson.name ?? '',
          ...(durationMs ? { durationMin: Math.max(1, Math.round(durationMs / 60000)) } : {}),
        });
      }
    }
    return [{ id: m.id, slug: m.slug ?? '', name: m.name ?? '', description: m.description ?? '', learningObjectives: [], items: outItems }];
  });

  return { id: root.elements[0].id ?? course.id, slug: course.slug, name: course.name, modules: outModules };
}

export function parseSubtitleUrls(json: unknown): Record<string, string> {
  const vtt: Record<string, string> = (json as Json)?.linked?.['onDemandVideos.v1']?.[0]?.subtitlesVtt ?? {};
  return Object.fromEntries(Object.entries(vtt).map(([lang, path]) => [lang, new URL(path, ORIGIN).toString()]));
}

export function parseSupplementCml(json: unknown): string {
  const value = (json as Json)?.linked?.['openCourseAssets.v1']?.[0]?.definition?.value;
  if (typeof value !== 'string') throw new Error('Unexpected supplement response: no CML value');
  return value;
}
