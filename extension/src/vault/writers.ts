import JSZip from 'jszip';
import { get, set } from 'idb-keyval';

export interface VaultWriter {
  readText(path: string): Promise<string | null>;
  writeText(path: string, content: string): Promise<void>;
}

const SEG = '[^/]+';
const OWNED = [
  new RegExp(`^Coursera/${SEG}/_course\\.md$`),
  new RegExp(`^Coursera/${SEG}/_manifest\\.json$`),
  new RegExp(`^Coursera/${SEG}/M\\d{2} - ${SEG}/_module\\.md$`),
  new RegExp(`^Coursera/${SEG}/M\\d{2} - ${SEG}/raw/${SEG}\\.md$`),
];

/** The extension may only write the files it owns (spec §3). Anything else — notes/, my/, _concepts/ … — is refused. */
export function assertExtensionOwnedPath(path: string): void {
  const segments = path.split('/');
  const ok =
    !segments.some((s) => s === '..' || s === '.' || s === '') &&
    !segments.slice(2).some((s) => s.startsWith('_concepts')) &&
    OWNED.some((re) => re.test(path));
  if (!ok) throw new Error(`Refusing to write outside extension-owned paths: ${path}`);
}

export class MemoryWriter implements VaultWriter {
  files = new Map<string, string>();
  async readText(path: string) {
    return this.files.get(path) ?? null;
  }
  async writeText(path: string, content: string) {
    assertExtensionOwnedPath(path);
    this.files.set(path, content);
  }
}

export class FsAccessWriter implements VaultWriter {
  constructor(private readonly root: FileSystemDirectoryHandle) {}

  private async dirFor(path: string, create: boolean): Promise<[FileSystemDirectoryHandle, string]> {
    const parts = path.split('/');
    let dir = this.root;
    for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create });
    return [dir, parts.at(-1)!];
  }

  async readText(path: string): Promise<string | null> {
    try {
      const [dir, name] = await this.dirFor(path, false);
      return await (await (await dir.getFileHandle(name)).getFile()).text();
    } catch (e) {
      if ((e as DOMException)?.name === 'NotFoundError') return null;
      throw e;
    }
  }

  async writeText(path: string, content: string): Promise<void> {
    assertExtensionOwnedPath(path);
    const [dir, name] = await this.dirFor(path, true);
    const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
    await writable.write(content);
    await writable.close();
  }
}

export class ZipWriter implements VaultWriter {
  private zip = new JSZip();
  private written = new Map<string, string>();
  async readText(path: string) {
    return this.written.get(path) ?? null;
  }
  async writeText(path: string, content: string) {
    assertExtensionOwnedPath(path);
    this.written.set(path, content);
    this.zip.file(path, content);
  }
  finish(): Promise<Blob> {
    return this.zip.generateAsync({ type: 'blob' });
  }
}

type PermissionHandle = FileSystemDirectoryHandle & {
  queryPermission(d: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(d: { mode: 'readwrite' }): Promise<PermissionState>;
};

export async function ensurePermission(root: FileSystemDirectoryHandle): Promise<boolean> {
  const h = root as PermissionHandle;
  if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  return (await h.requestPermission({ mode: 'readwrite' })) === 'granted';
}

const HANDLE_KEY = 'vault-root-handle';
export const saveRootHandle = (h: FileSystemDirectoryHandle) => set(HANDLE_KEY, h);
export const loadRootHandle = async () => ((await get(HANDLE_KEY)) as FileSystemDirectoryHandle | undefined) ?? null;
