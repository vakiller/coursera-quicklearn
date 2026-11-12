import type { Manifest, OutlineItem } from '../shared/types';
import { AuthError, EnvironmentError, LockedError, NotAllowedError, type CourseraClient } from '../coursera/client';
import { vttToMarkdown } from '../convert/vtt';
import { cmlToMarkdown } from '../convert/cml';
import { sha256 } from '../vault/hash';
import { itemFileName, moduleFolderName } from '../vault/naming';
import { itemUrl, renderCourseMd, renderModuleMd, renderRawFile } from '../vault/render';
import { buildManifest, mergeWithPrevious, type ItemResult } from '../vault/manifest';
import type { VaultWriter } from '../vault/writers';

/** Progress of an interrupted run. Only reused for the same language + destination, within RESUME_MAX_AGE_MS. */
export interface ResumeEntry {
  context: string;
  startedAt: string;
  done: Record<string, ItemResult>;
}

export interface ResumeStore {
  load(slug: string): Promise<ResumeEntry | null>;
  save(slug: string, entry: ResumeEntry): Promise<void>;
  clear(slug: string): Promise<void>;
}

export function memoryResumeStore(): ResumeStore {
  const store = new Map<string, ResumeEntry>();
  return {
    load: async (slug) => (store.has(slug) ? structuredClone(store.get(slug)!) : null),
    save: async (slug, entry) => void store.set(slug, structuredClone(entry)),
    clear: async (slug) => void store.delete(slug),
  };
}

export const RESUME_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

export const VAULT_WRITE_MESSAGE =
  'Không ghi được vào thư mục vault (mất quyền, thư mục bị di chuyển hoặc đầy ổ). Chọn lại thư mục vault rồi bấm Bắt đầu để chạy tiếp.';

export interface SyncReport {
  ok: number;
  written: number;
  unchanged: number;
  locked: number;
  unavailable: number;
  error: number;
  quizzes: number;
  resumed: number;
  stoppedForAuth: boolean;
  stoppedForEnvironment: string | null;
}

export interface SyncDeps {
  client: CourseraClient;
  writer: VaultWriter;
  resume: ResumeStore;
  lang: string;
  /** Where files go (e.g. "vault:<folder name>"); resume data from another destination is discarded. */
  destination: string;
  now: () => string;
  onProgress?: (done: number, total: number, title: string) => void;
}

const isContent = (i: OutlineItem): i is OutlineItem & { type: 'video' | 'reading' } => i.type === 'video' || i.type === 'reading';

async function readManifest(writer: VaultWriter, path: string): Promise<Manifest | null> {
  const text = await writer.readText(path).catch(() => null);
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
  const context = `${lang}|${deps.destination}`;
  const report: SyncReport = {
    ok: 0, written: 0, unchanged: 0, locked: 0, unavailable: 0, error: 0, quizzes: 0, resumed: 0,
    stoppedForAuth: false, stoppedForEnvironment: null,
  };

  const write = async (path: string, content: string) => {
    try {
      await writer.writeText(path, content);
    } catch {
      throw new EnvironmentError(VAULT_WRITE_MESSAGE);
    }
  };

  const outline = await client.getOutline(slug);
  const prev = await readManifest(writer, `${base}/_manifest.json`);
  const prevById = new Map(prev?.modules.flatMap((m) => m.items.map((i) => [i.id, i] as const)) ?? []);

  const saved = await resume.load(slug);
  const usable = saved && saved.context === context && Date.parse(fetchedAt) - Date.parse(saved.startedAt) < RESUME_MAX_AGE_MS;
  const entry: ResumeEntry = usable ? saved : { context, startedAt: fetchedAt, done: {} };
  const done = entry.done; // persisted: ok / locked / unavailable
  const failed: Record<string, ItemResult> = {}; // this run only: per-item errors are retried next time
  report.resumed = Object.keys(done).length;

  const total = outline.modules.flatMap((m) => m.items).filter(isContent).length;
  let progress = 0;
  let recentLocked: string[] = []; // 403s since the last success: undone if the streak turns out to be an expired session

  try {
    for (const [mi, mod] of outline.modules.entries()) {
      const folder = moduleFolderName(mi + 1, mod.name);
      for (const [ii, item] of mod.items.entries()) {
        if (item.type === 'quiz') report.quizzes++;
        if (!isContent(item)) continue;

        if (!done[item.id]) {
          try {
            const result = await fetchItem(item, mi, ii, folder);
            done[item.id] = result;
            recentLocked = [];
          } catch (e) {
            if (e instanceof LockedError) {
              done[item.id] = { status: 'locked', hash: null, file: null };
              recentLocked.push(item.id);
            } else if (e instanceof AuthError || e instanceof EnvironmentError || e instanceof NotAllowedError) {
              throw e;
            } else {
              failed[item.id] = { status: 'error', hash: null, file: null };
            }
          }
          await resume.save(slug, entry);
        }
        deps.onProgress?.(++progress, total, item.name);
      }
    }

    const results = new Map(Object.entries({ ...done, ...failed }));
    const manifest = mergeWithPrevious(buildManifest(outline, results, fetchedAt), prev);
    for (const mod of outline.modules) {
      const mm = manifest.modules.find((m) => m.id === mod.id)!;
      await write(`${base}/${mm.folder}/_module.md`, renderModuleMd(mod, mm, slug));
    }
    await write(`${base}/_course.md`, renderCourseMd(outline, manifest));
    await write(`${base}/_manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
    await resume.clear(slug);
  } catch (e) {
    if (e instanceof AuthError) {
      report.stoppedForAuth = true;
      for (const id of recentLocked) delete done[id];
    } else if (e instanceof EnvironmentError) {
      report.stoppedForEnvironment = e.message;
    } else {
      throw e;
    }
    await resume.save(slug, entry);
  }
  return tally(report, { ...done, ...failed });

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
    if (before?.content_hash === hash && before.file === file && (await writer.readText(path).catch(() => null)) !== null) {
      report.unchanged++;
    } else {
      await write(
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

function tally(report: SyncReport, all: Record<string, ItemResult>): SyncReport {
  for (const r of Object.values(all)) {
    if (r.status === 'ok') report.ok++;
    else if (r.status === 'locked') report.locked++;
    else if (r.status === 'unavailable') report.unavailable++;
    else if (r.status === 'error') report.error++;
  }
  return report;
}
