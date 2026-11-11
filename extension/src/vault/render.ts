import type { CourseOutline, Manifest, ManifestModule, OutlineItem, OutlineModule } from '../shared/types';
import { ORIGIN } from '../coursera/endpoints';

export const SCHEMA = 'coursera-vault/1';

export interface RawMeta {
  type: 'video' | 'reading';
  course_slug: string;
  course_id: string;
  module: number;
  module_title: string;
  lesson: string;
  item_index: number;
  item_id: string;
  title: string;
  url: string;
  duration_min?: number;
  language: string;
  fetched_at: string;
  content_hash: string;
}

const yamlValue = (v: string | number) => (typeof v === 'number' ? String(v) : `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);

function frontmatter(entries: [string, string | number | undefined][], bare: string[] = []): string {
  const lines = entries
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${bare.includes(k) ? v : yamlValue(v as string | number)}`);
  return `---\n${lines.join('\n')}\n---\n`;
}

const BARE = ['schema', 'type'];

export function itemUrl(courseSlug: string, item: OutlineItem): string {
  const base = `${ORIGIN}/learn/${courseSlug}`;
  if (item.type === 'video') return `${base}/lecture/${item.id}/${item.slug}`;
  if (item.type === 'reading') return `${base}/supplement/${item.id}/${item.slug}`;
  return `${base}/item/${item.id}`;
}

export function renderRawFile(meta: RawMeta, body: string): string {
  const fm = frontmatter(
    [
      ['schema', SCHEMA],
      ['type', meta.type],
      ['course_slug', meta.course_slug],
      ['course_id', meta.course_id],
      ['module', meta.module],
      ['module_title', meta.module_title],
      ['lesson', meta.lesson],
      ['item_index', meta.item_index],
      ['item_id', meta.item_id],
      ['title', meta.title],
      ['url', meta.url],
      ['duration_min', meta.duration_min],
      ['language', meta.language],
      ['fetched_at', meta.fetched_at],
      ['content_hash', meta.content_hash],
    ],
    BARE,
  );
  return `${fm}\n# ${meta.title}\n\n${body}`;
}

const stripMd = (file: string) => file.replace(/\.md$/, '');

export function renderModuleMd(mod: OutlineModule, mm: ManifestModule, courseSlug: string): string {
  const fm = frontmatter(
    [
      ['schema', SCHEMA],
      ['type', 'module'],
      ['course_slug', courseSlug],
      ['module', mm.index],
      ['module_id', mod.id],
      ['title', mod.name],
    ],
    BARE,
  );
  const parts = [`${fm}\n# ${mm.folder}`];
  if (mod.description) parts.push(mod.description);
  if (mod.learningObjectives.length) parts.push(`## Learning objectives\n\n${mod.learningObjectives.map((o) => `- ${o}`).join('\n')}`);

  const byId = new Map(mod.items.map((i) => [i.id, i]));
  const lines = mm.items.map((mi) => {
    const item = byId.get(mi.id);
    const url = item ? itemUrl(courseSlug, item) : `${ORIGIN}/learn/${courseSlug}/item/${mi.id}`;
    if (mi.type === 'quiz') return `- 🧪 ${mi.title}${mi.graded ? ' (graded)' : ' (practice)'} — [Coursera](${url})`;
    const extra = item?.durationMin ? ` · ${item.durationMin} min` : '';
    if (mi.file && (mi.status === 'ok' || mi.status === 'removed')) return `- [[${stripMd(mi.file)}|${mi.title}]] · ${mi.type}${extra}`;
    return `- ${mi.title} · ${mi.type} · ${mi.status} — [Coursera](${url})`;
  });
  parts.push(`## Items\n\n${lines.join('\n')}`);
  return parts.join('\n\n') + '\n';
}

export function renderCourseMd(outline: CourseOutline, manifest: Manifest): string {
  const fm = frontmatter(
    [
      ['schema', SCHEMA],
      ['type', 'course'],
      ['course_id', outline.id],
      ['slug', outline.slug],
      ['title', outline.name],
      ['url', `${ORIGIN}/learn/${outline.slug}`],
      ['fetched_at', manifest.course.fetched_at],
    ],
    BARE,
  );
  const mods = manifest.modules.map((m) => `- [[${m.folder}/_module|${m.folder}]]`).join('\n');
  return `${fm}\n# ${outline.name}\n\n## Modules\n\n${mods}\n`;
}
