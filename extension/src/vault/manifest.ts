import type { CourseOutline, ItemStatus, Manifest, ManifestItem, ManifestModule } from '../shared/types';
import { moduleFolderName } from './naming';
import { SCHEMA } from './render';

export interface ItemResult {
  status: ItemStatus;
  hash: string | null;
  file: string | null;
}

export function buildManifest(outline: CourseOutline, results: Map<string, ItemResult>, fetchedAt: string): Manifest {
  return {
    schema: SCHEMA,
    course: { id: outline.id, slug: outline.slug, title: outline.name, fetched_at: fetchedAt },
    modules: outline.modules.map((mod, mi): ManifestModule => ({
      index: mi + 1,
      id: mod.id,
      title: mod.name,
      folder: moduleFolderName(mi + 1, mod.name),
      items: mod.items.map((item, ii): ManifestItem => {
        const base = { index: ii + 1, id: item.id, type: item.type, title: item.name };
        if (item.type === 'quiz' || item.type === 'other') {
          return { ...base, ...(item.type === 'quiz' ? { graded: item.graded } : {}), file: null, content_hash: null, status: 'not_fetched' };
        }
        const r = results.get(item.id);
        return { ...base, file: r?.file ?? null, content_hash: r?.hash ?? null, status: r?.status ?? 'not_fetched' };
      }),
    })),
  };
}

export function mergeWithPrevious(next: Manifest, prev: Manifest | null): Manifest {
  if (!prev) return next;
  const merged: Manifest = structuredClone(next);
  const removed = (i: ManifestItem): ManifestItem => ({ ...i, status: 'removed' });
  const prevItems = new Map(prev.modules.flatMap((m) => m.items.map((i) => [i.id, i] as const)));
  for (const nm of merged.modules)
    for (const ni of nm.items) {
      const pi = prevItems.get(ni.id);
      if (!ni.file && pi?.file && ['locked', 'unavailable', 'error'].includes(ni.status)) {
        ni.file = pi.file;
        ni.content_hash = pi.content_hash;
      }
    }
  for (const pm of prev.modules) {
    const nm = merged.modules.find((m) => m.id === pm.id);
    if (!nm) {
      merged.modules.push({ ...pm, items: pm.items.map(removed) });
      continue;
    }
    const ids = new Set(nm.items.map((i) => i.id));
    for (const pi of pm.items) if (!ids.has(pi.id)) nm.items.push(removed(pi));
  }
  return merged;
}
