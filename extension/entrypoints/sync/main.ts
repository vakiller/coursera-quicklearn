import { CourseraClient } from '../../src/coursera/client';
import { syncCourse, type SyncReport } from '../../src/sync/sync-course';
import { chromeResumeStore } from '../../src/sync/chrome-resume-store';
import { makeTabFetcher } from '../../src/tab-fetcher';
import { FsAccessWriter, ZipWriter, ensurePermission, loadRootHandle, saveRootHandle, type VaultWriter } from '../../src/vault/writers';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
const slug = params.get('slug') ?? '';
const tabId = Number(params.get('tabId'));
$('slug').textContent = slug;

let root: FileSystemDirectoryHandle | null = await loadRootHandle();
const showVault = () => {
  $('vault').textContent = root ? `Vault: ${root.name} → sẽ ghi vào Coursera/${slug}/` : 'Chưa chọn thư mục vault.';
  $<HTMLButtonElement>('start').disabled = !root;
};
showVault();

$('pick').onclick = async () => {
  root = await (window as unknown as { showDirectoryPicker(o: object): Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: 'readwrite' });
  await saveRootHandle(root);
  showVault();
};

function renderReport(r: SyncReport, extra = '') {
  const el = $('report');
  el.hidden = false;
  el.className = r.stoppedForAuth ? 'warn' : '';
  el.textContent =
    (r.stoppedForAuth ? 'Phiên đăng nhập Coursera đã hết. Đăng nhập lại rồi bấm Bắt đầu để chạy tiếp.\n\n' : 'Xong.\n\n') +
    `Thành công: ${r.ok} (ghi mới/cập nhật: ${r.written}, không đổi: ${r.unchanged})\n` +
    `Bị khóa: ${r.locked} · Không có transcript: ${r.unavailable} · Lỗi: ${r.error}\n` +
    `Bài quiz/test (chỉ ghi tên, không mở): ${r.quizzes}` +
    extra;
}

async function run(writer: VaultWriter): Promise<SyncReport | null> {
  const buttons = ['start', 'zip', 'pick'].map((id) => $<HTMLButtonElement>(id));
  buttons.forEach((b) => (b.disabled = true));
  $('report').hidden = true;
  try {
    const client = new CourseraClient(makeTabFetcher(tabId), { delayMs: Number($<HTMLInputElement>('delay').value) || 700 });
    return await syncCourse(slug, {
      client,
      writer,
      resume: chromeResumeStore,
      lang: $<HTMLSelectElement>('lang').value,
      now: () => new Date().toISOString(),
      onProgress: (done, total, title) => {
        $<HTMLProgressElement>('bar').value = done / total;
        $('current').textContent = `${done}/${total} · ${title}`;
      },
    });
  } catch (e) {
    const el = $('report');
    el.hidden = false;
    el.className = 'err';
    el.textContent = `Lỗi: ${(e as Error).message}\nKiểm tra tab Coursera còn mở rồi thử lại.`;
    return null;
  } finally {
    buttons.forEach((b) => (b.disabled = false));
    showVault();
  }
}

$('start').onclick = async () => {
  if (!root || !(await ensurePermission(root))) {
    $('vault').textContent = 'Chrome chưa cấp quyền ghi vào thư mục vault. Bấm "Chọn thư mục vault" để cấp lại.';
    return;
  }
  const report = await run(new FsAccessWriter(root));
  if (report) renderReport(report);
};

$('zip').onclick = async () => {
  const writer = new ZipWriter();
  const report = await run(writer);
  if (!report) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await writer.finish());
  a.download = `coursera-${slug}.zip`;
  a.click();
  renderReport(report, '\n\nĐã tải ZIP. Giải nén vào thư mục gốc của vault.');
};
