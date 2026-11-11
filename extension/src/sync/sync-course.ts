import type { Manifest, OutlineItem } from '../shared/types';
import { AuthError, LockedError, NotAllowedError, type CourseraClient } from '../coursera/client';
import { vttToMarkdown } from '../convert/vtt';
import { cmlToMarkdown } from '../convert/cml';
import { sha256 } from '../vault/hash';
import { itemFileName, moduleFolderName } from '../vault/naming';
import { itemUrl, renderCourseMd, renderModuleMd, renderRawFile } from '../vault/render';
import { buildManifest, mergeWithPrevious, type ItemResult } from '../vault/manifest';
import type { VaultWriter } from '../vault/writers';

export interface ResumeStore {
  load(slug: string): Promise<Record<string, ItemResult>>;
  save(slug: string, done: Record<string, ItemResult>): Promise<void>;
  clear(slug: string): Promise<void>;
}

export function memoryResumeStore(): ResumeStore {
  const store = new Map<string, Record<string, ItemResult>>();
  return {
    load: async (slug) => ({ ...(store.get(slug) ?? {}) }),
    save: async (slug, done) => void store.set(slug, { ...done }),
    clear: async (slug) => void store.delete(slug),
  };
}

export interface SyncReport {
  ok: number;
  written: number;
  unchanged: number;
  locked: number;
  unavailable: number;
  error: number;
  quizzes: number;
  stoppedForAuth: boolean;
}

export interface SyncDeps {
  client: CourseraClient;
  writer: VaultWriter;
  resume: ResumeStore;
  lang: string;
  now: () => string;
  onProgress?: (done: number, total: number, title: string) => void;
}

const isContent = (i: OutlineItem): i is OutlineItem & { type: 'video' | 'reading' } => i.type === 'video' || i.type === 'reading';

async function readManifest(writer: VaultWriter, path: string): Promise<Manifest | null> {
  const text = await writer.readText(path);
  if (!text) return null;
  try {
    return JSON.parse(text) as Manifest;
  } catch {
    return null;
  }
}

export async function syncCourse(slug: string, deps: SyncDeps): Promise<SyncReport> {
  const { client, writer, resume, lang, now } = deps;
  const base = `Coursera/${slug}`;
  const fetchedAt = now();
  const outline = await client.getOutline(slug);
  const prev = await readManifest(writer, `${base}/_manifest.json`);
  const prevById = new Map(prev?.modules.flatMap((m) => m.items.map((i) => [i.id, i] as const)) ?? []);
  const done = await resume.load(slug);

  const report: SyncReport = { ok: 0, written: 0, unchanged: 0, locked: 0, unavailable: 0, error: 0, quizzes: 0, stoppedForAuth: false };
  const total = outline.modules.flatMap((m) => m.items).filter(isContent).length;
  let progress = 0;

  for (const [mi, mod] of outline.modules.entries()) {
    const folder = moduleFolderName(mi + 1, mod.name);
    for (const [ii, item] of mod.items.entries()) {
      if (item.type === 'quiz') report.quizzes++;
      if (!isContent(item)) continue;

      if (!done[item.id]) {
        let result: ItemResult;
        try {
          result = await fetchItem(item, mi, ii, folder);
        } catch (e) {
          if (e instanceof AuthError) {
            report.stoppedForAuth = true;
            await resume.save(slug, done);
            return tally(report, done);
          }
          if (e instanceof NotAllowedError) throw e;
          result = { status: e instanceof LockedError ? 'locked' : 'error', hash: null, file: null };
        }
        done[item.id] = result;
        await resume.save(slug, done);
      }
      deps.onProgress?.(++progress, total, item.name);
    }
  }

  const results = new Map(Object.entries(done));
  const manifest = mergeWithPrevious(buildManifest(outline, results, fetchedAt), prev);
  for (const mod of outline.modules) {
    const mm = manifest.modules.find((m) => m.id === mod.id)!;
    await writer.writeText(`${base}/${mm.folder}/_module.md`, renderModuleMd(mod, mm, slug));
  }
  await writer.writeText(`${base}/_course.md`, renderCourseMd(outline, manifest));
  await writer.writeText(`${base}/_manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
  await resume.clear(slug);
  return tally(report, done);

  async function fetchItem(item: OutlineItem & { type: 'video' | 'reading' }, mi: number, ii: number, folder: string): Promise<ItemResult> {
    if (item.locked) return { status: 'locked', hash: null, file: null };
    let body: string;
    if (item.type === 'video') {
      const vtt = await client.getTranscript(outline.id, item.id, lang);
      if (vtt === null) return { status: 'unavailable', hash: null, file: null };
      body = vttToMarkdown(vtt);
    } else {
      body = cmlToMarkdown(await client.getReadingCml(outline.id, item.id));
    }
    const hash = await sha256(body);
    const file = `raw/${itemFileName(ii + 1, item.name, item.type)}`;
    const path = `${base}/${folder}/${file}`;
    const before = prevById.get(item.id);
    if (before?.content_hash === hash && before.file === file && (await writer.readText(path)) !== null) {
      report.unchanged++;
    } else {
      await writer.writeText(
        path,
        renderRawFile(
          {
            type: item.type,
            course_slug: slug,
            course_id: outline.id,
            module: mi + 1,
            module_title: outline.modules[mi]!.name,
            lesson: item.lessonName,
            item_index: ii + 1,
            item_id: item.id,
            title: item.name,
            url: itemUrl(slug, item),
            ...(item.durationMin ? { duration_min: item.durationMin } : {}),
            language: item.type === 'video' ? lang : 'en',
            fetched_at: fetchedAt,
            content_hash: hash,
          },
          body,
        ),
      );
      report.written++;
    }
    return { status: 'ok', hash, file };
  }
}

function tally(report: SyncReport, done: Record<string, ItemResult>): SyncReport {
  for (const r of Object.values(done)) {
    if (r.status === 'ok') report.ok++;
    else if (r.status === 'locked') report.locked++;
    else if (r.status === 'unavailable') report.unavailable++;
    else if (r.status === 'error') report.error++;
  }
  return report;
}
