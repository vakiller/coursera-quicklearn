/** Minimal in-memory stand-in for the File System Access API directory handle. */
export class FakeDir {
  dirs = new Map<string, FakeDir>();
  files = new Map<string, string>();
  constructor(public permission: PermissionState = 'granted', public onRequest: PermissionState = 'granted') {}
  async getDirectoryHandle(name: string, opts?: { create?: boolean }) {
    let d = this.dirs.get(name);
    if (!d) {
      if (!opts?.create) throw new DOMException('not found', 'NotFoundError');
      d = new FakeDir();
      this.dirs.set(name, d);
    }
    return d;
  }
  async getFileHandle(name: string, opts?: { create?: boolean }) {
    if (!this.files.has(name)) {
      if (!opts?.create) throw new DOMException('not found', 'NotFoundError');
      this.files.set(name, '');
    }
    const files = this.files;
    return {
      getFile: async () => ({ text: async () => files.get(name) ?? '' }),
      createWritable: async () => {
        let buf = '';
        return { write: async (s: string) => void (buf += s), close: async () => void files.set(name, buf) };
      },
    };
  }
  async queryPermission() {
    return this.permission;
  }
  async requestPermission() {
    this.permission = this.onRequest;
    return this.onRequest;
  }
  read(path: string): string | undefined {
    const parts = path.split('/');
    let d: FakeDir | undefined = this;
    for (const p of parts.slice(0, -1)) d = d?.dirs.get(p);
    return d?.files.get(parts.at(-1)!);
  }
}
