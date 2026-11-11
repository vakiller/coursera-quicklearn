import JSZip from 'jszip';
import { FsAccessWriter, ZipWriter, MemoryWriter, ensurePermission, assertExtensionOwnedPath } from '../src/vault/writers';
import { FakeDir } from './helpers/fake-fs';

const RAW = 'Coursera/project-initiation-google/M01 - Fundamentals/raw/01 - Intro (video).md';

describe('assertExtensionOwnedPath', () => {
  it.each([
    'Coursera/s/_course.md',
    'Coursera/s/_manifest.json',
    'Coursera/s/M01 - A/_module.md',
    RAW,
  ])('allows %s', (p) => expect(() => assertExtensionOwnedPath(p)).not.toThrow());

  it.each([
    'Coursera/s/M01 - A/notes/summary.md',
    'Coursera/s/M01 - A/my/mistakes.md',
    'Coursera/_concepts/Scope.md',
    'Coursera/_profile.md',
    'Coursera/_dashboard.md',
    'Coursera/s/M01 - A/raw/../notes/x.md',
    'Other/s/_course.md',
    'Coursera/s/M01 - A/raw/sub/x.md',
  ])('blocks %s', (p) => expect(() => assertExtensionOwnedPath(p)).toThrow());
});

describe('FsAccessWriter', () => {
  it('creates nested folders and reads files back', async () => {
    const root = new FakeDir();
    const w = new FsAccessWriter(root as unknown as FileSystemDirectoryHandle);
    await w.writeText(RAW, 'z');
    expect(root.read(RAW)).toBe('z');
    expect(await w.readText(RAW)).toBe('z');
    expect(await w.readText('Coursera/s/_manifest.json')).toBeNull();
  });

  it('refuses to write outside extension-owned paths', async () => {
    const w = new FsAccessWriter(new FakeDir() as unknown as FileSystemDirectoryHandle);
    await expect(w.writeText('Coursera/s/M01 - A/notes/summary.md', 'x')).rejects.toThrow();
  });
});

describe('ensurePermission', () => {
  it('re-requests permission when Chrome asks again', async () => {
    expect(await ensurePermission(new FakeDir('prompt', 'granted') as unknown as FileSystemDirectoryHandle)).toBe(true);
    expect(await ensurePermission(new FakeDir('prompt', 'denied') as unknown as FileSystemDirectoryHandle)).toBe(false);
    expect(await ensurePermission(new FakeDir('granted') as unknown as FileSystemDirectoryHandle)).toBe(true);
  });
});

describe('ZipWriter', () => {
  it('produces a zip containing every written path', async () => {
    const w = new ZipWriter();
    await w.writeText(RAW, 'a');
    await w.writeText('Coursera/s/_course.md', 'b');
    expect(await w.readText(RAW)).toBe('a');
    const zip = await JSZip.loadAsync(await (await w.finish()).arrayBuffer());
    expect(Object.keys(zip.files).filter((k) => !zip.files[k]!.dir).sort()).toEqual(['Coursera/s/_course.md', RAW].sort());
  });
});

describe('MemoryWriter', () => {
  it('stores files and applies the same guard', async () => {
    const w = new MemoryWriter();
    await w.writeText(RAW, 'q');
    expect(w.files.get(RAW)).toBe('q');
    await expect(w.writeText('Coursera/_profile.md', 'x')).rejects.toThrow();
  });
});
