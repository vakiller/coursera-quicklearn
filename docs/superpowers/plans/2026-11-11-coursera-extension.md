# Coursera → Vault Chrome Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chrome extension: người dùng đã đăng nhập Coursera bấm "Sync course" → toàn bộ transcript video + reading của khóa được ghi thành file `.md` vào vault Obsidian theo đúng cấu trúc ở mục 3 của spec, sync lại chỉ ghi file đã đổi.

**Architecture:** Logic thuần (chuyển đổi, đặt tên, render, manifest, orchestrator) nằm trong `src/` và được test bằng Vitest qua các interface tiêm vào (`Fetcher`, `VaultWriter`, `ResumeStore`). Content script trên tab coursera.org chỉ làm một việc: thực hiện `fetch` cùng origin (cookie đăng nhập tự đi kèm) cho các URL nằm trong allowlist. Trang Sync (tab của extension) giữ quyền thư mục vault (File System Access API), chạy orchestrator và gọi content script qua `chrome.tabs.sendMessage`.

**Tech Stack:** WXT (MV3, chỉ Chrome), TypeScript strict, Vitest, `turndown` (HTML→MD), `fast-xml-parser` (CML), `jszip` (ZIP dự phòng), Web Crypto (`crypto.subtle`) cho SHA-256.

**Spec:** `docs/specs/2026-11-11-coursera-to-vault-design.md` (mục 2, 3, 4)

## Global Constraints

- Chỉ Chrome. Không code Firefox.
- `CourseraClient` **chỉ** được gọi 3 nhóm endpoint: outline (`onDemandCourseMaterials.v2`), video (`onDemandLectureVideos.v1` + file phụ đề), reading (`onDemandSupplements.v1`). Mọi URL khác → throw `NotAllowedError`. Không gọi endpoint quiz/exam/assignment dưới bất kỳ hình thức nào.
- Item `quiz` chỉ ghi vào manifest/`_module.md` với `file: null`, `status: "not_fetched"`; không tạo file raw.
- Extension chỉ ghi: `Coursera/<slug>/_course.md`, `_manifest.json`, `M../_module.md`, `M../raw/*`. Không bao giờ ghi vào `notes/`, `my/`, `_concepts/`, `_profile.md`, `_dashboard.md`.
- Frontmatter `schema: coursera-vault/1`; manifest `"schema": "coursera-vault/1"`.
- Tên thư mục module `M` + 2 chữ số + ` - ` + tên; file item `NN - <Title> [video|reading].md`; ký tự cấm `/\:*?"<>|#^[]` bị loại; tên cắt tối đa 80 ký tự (trước phần ` [type].md`).
- Transcript: đoạn ~30–60 giây, bắt đầu bằng `**[MM:SS]**`, kết thúc bằng block id ` ^tMMSS`. Reading: mỗi đoạn kết thúc bằng ` ^pNN`.
- Request tuần tự, delay mặc định 700ms, retry có backoff cho 429/5xx (tối đa 3 lần), 401/403 → dừng ngay với `AuthError`.
- Ngôn ngữ transcript mặc định `en`.
- `content_hash` tính trên **thân file** (không gồm `fetched_at`), dạng `sha256:<hex>`.

## Review Focus

1. **Phiên đăng nhập hết hạn giữa chừng (401/403)** → dừng, báo "Hãy đăng nhập lại Coursera rồi bấm Sync tiếp", lần sau chạy tiếp từ item chưa xong. Test: Task 7 (`AuthError`), Task 9 (`resumes after AuthError`).
2. **Video không có phụ đề ngôn ngữ đã chọn** → item `status: "unavailable"`, sync vẫn chạy tiếp. Test: Task 9.
3. **Hai item cùng tiêu đề / tiêu đề toàn ký tự cấm** → tên file vẫn duy nhất nhờ tiền tố số, không rỗng. Test: Task 1.
4. **Quyền thư mục vault bị mất khi mở lại Chrome** → trang Sync hỏi lại quyền thay vì lỗi im lặng. Test: Task 8 (`ensurePermission`).
5. **Sync lại khi khóa có item bị xóa** → manifest giữ item với `status: "removed"`, file cũ không bị xóa. Test: Task 6.

---

## File Structure

```
extension/
├── package.json, tsconfig.json, wxt.config.ts, vitest.config.ts
├── src/
│   ├── shared/types.ts            # mọi type dùng chung
│   ├── vault/naming.ts            # sanitize + tên file/thư mục
│   ├── convert/vtt.ts             # VTT → Markdown có ^tMMSS
│   ├── convert/cml.ts             # CML → Markdown có ^pNN
│   ├── coursera/endpoints.ts      # URL builders + allowlist
│   ├── coursera/parse.ts          # JSON Coursera → type nội bộ
│   ├── coursera/client.ts         # CourseraClient: delay, retry, lỗi
│   ├── vault/hash.ts              # sha256
│   ├── vault/render.ts            # render raw / _course.md / _module.md
│   ├── vault/manifest.ts          # build + merge manifest
│   ├── vault/writers.ts           # VaultWriter: FsAccess, Zip, Memory
│   └── sync/sync-course.ts        # orchestrator
├── entrypoints/
│   ├── content.ts                 # fetch bridge trên coursera.org
│   ├── popup/                     # nhận diện khóa, mở trang Sync
│   └── sync/                      # trang Sync: chọn vault, tiến độ, báo cáo
└── test/
    ├── fixtures/                  # dữ liệu thật từ Phase 0
    └── *.test.ts
docs/coursera-api-notes.md         # kết quả Phase 0
```

---

### Task 0: Spike — xác minh API Coursera (thủ công, không code sản phẩm)

**Files:**
- Create: `docs/coursera-api-notes.md`
- Create: `extension/test/fixtures/outline.json`, `lecture-video.json`, `subtitle-en.vtt`, `supplement.json`, `supplement-cml.xml`

- [ ] **Step 1:** Mở `https://www.coursera.org/learn/project-initiation-google/home/module/1` khi đã đăng nhập, mở DevTools → Network → lọc `api/`. Reload. Tìm request outline (`onDemandCourseMaterials.v2` hoặc tương đương). Lưu response → `outline.json`. Ghi vào notes: URL đầy đủ, tham số `includes`/`fields`, cách lấy `courseId`, cách nhận biết loại item (`contentSummary.typeName`), cờ `isLocked`, cờ graded, **module có `learningObjectives`/`description` không**.
- [ ] **Step 2:** Mở 1 video. Tìm request trả về danh sách phụ đề (`onDemandLectureVideos.v1`). Lưu → `lecture-video.json`; tải file VTT tiếng Anh → `subtitle-en.vtt`. Ghi: đường dẫn trường chứa URL phụ đề theo ngôn ngữ; URL phụ đề là tương đối hay tuyệt đối.
- [ ] **Step 3:** Mở 1 reading (ưu tiên reading "Glossary" nếu có). Tìm `onDemandSupplements.v1`. Lưu → `supplement.json`, tách chuỗi CML → `supplement-cml.xml`. Ghi danh sách tag CML gặp được (`text`, `heading`, `list`, `table`, `asset`, `code`, `img`…).
- [ ] **Step 4:** Kiểm tra fetch từ content script có gửi cookie: trong Console của tab Coursera chạy `fetch('<URL outline>', {credentials:'include'}).then(r=>r.status)` → kỳ vọng `200`.
- [ ] **Step 5:** **Không mở bất kỳ quiz nào.** Ghi trong notes danh sách host phụ đề (nếu VTT nằm ở domain khác coursera.org, ví dụ CDN, ghi lại để thêm vào allowlist và `host_permissions`).
- [ ] **Step 6:** `git init` ở thư mục gốc dự án; commit notes + fixtures.

```bash
git add docs/coursera-api-notes.md extension/test/fixtures
git commit -m "chore: phase 0 Coursera API notes and fixtures"
```

**Cổng chặn:** Nếu Step 1–4 cho thấy API khác hẳn giả định (ví dụ chỉ có GraphQL), dừng và cập nhật Task 4 & 7 theo notes trước khi làm tiếp. Các type trong Task 1 vẫn giữ nguyên; chỉ `parse.ts`/`endpoints.ts` thay đổi.

---

### Task 1: Scaffold + types + đặt tên file

**Files:**
- Create: `extension/` (WXT scaffold: `npx wxt@latest init extension --template vanilla-ts`), `extension/vitest.config.ts`
- Create: `extension/src/shared/types.ts`, `extension/src/vault/naming.ts`
- Test: `extension/test/naming.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export type ItemType = 'video' | 'reading' | 'quiz' | 'other';
  export type ItemStatus = 'ok' | 'locked' | 'unavailable' | 'error' | 'removed' | 'not_fetched';
  export interface OutlineItem { id: string; slug: string; name: string; type: ItemType; graded: boolean; locked: boolean; lessonName: string; durationMin?: number }
  export interface OutlineModule { id: string; slug: string; name: string; description: string; learningObjectives: string[]; items: OutlineItem[] }
  export interface CourseOutline { id: string; slug: string; name: string; modules: OutlineModule[] }
  export interface ManifestItem { index: number; id: string; type: ItemType; title: string; graded?: boolean; file: string | null; content_hash: string | null; status: ItemStatus }
  export interface ManifestModule { index: number; id: string; title: string; folder: string; items: ManifestItem[] }
  export interface Manifest { schema: 'coursera-vault/1'; course: { id: string; slug: string; title: string; fetched_at: string }; modules: ManifestModule[] }
  ```
- Produces (`naming.ts`): `sanitizeFileName(name: string, max = 80): string`, `moduleFolderName(index: number, name: string): string`, `itemFileName(index: number, title: string, type: 'video' | 'reading'): string`

- [ ] **Step 1: Write failing tests** (`naming.test.ts`)
  ```ts
  expect(sanitizeFileName('What is a "project"? / Part #1')).toBe('What is a project Part 1');
  expect(sanitizeFileName('a'.repeat(120)).length).toBe(80);
  expect(sanitizeFileName('???')).toBe('untitled');            // Review Focus 3
  expect(moduleFolderName(3, 'Set goals: OKRs')).toBe('M03 - Set goals OKRs');
  expect(itemFileName(7, 'Introduction [Part 1]', 'video')).toBe('07 - Introduction Part 1 [video].md');
  expect(itemFileName(1, 'Same', 'video')).not.toBe(itemFileName(2, 'Same', 'video'));
  ```
- [ ] **Step 2:** `cd extension && npx vitest run test/naming.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement `naming.ts`: xóa ký tự `/\:*?"<>|#^[]`, gộp khoảng trắng liên tiếp, trim; chuỗi rỗng → `untitled`; số đệm 2 chữ số.
- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5: Commit** `feat(ext): scaffold WXT, shared types, file naming`

---

### Task 2: VTT → Markdown

**Files:** Create `extension/src/convert/vtt.ts` · Test `extension/test/vtt.test.ts`

**Interfaces:** Produces `vttToMarkdown(vtt: string, opts?: { minSeconds?: number; maxSeconds?: number }): string` (mặc định 30 / 60).

- [ ] **Step 1: Write failing tests**
  - Inline VTT 4 cue (`00:00:01.000`, `00:00:20.000`, `00:00:40.000`, `00:01:05.000`) → kết quả có đúng 2 đoạn; đoạn 1 bắt đầu `**[00:01]**`, kết thúc ` ^t0001`; đoạn 2 bắt đầu `**[01:05]**`, kết thúc ` ^t0105`.
  - Cue lặp lại câu trước (Coursera hay lặp) không bị nhân đôi chữ.
  - Thẻ `<v Speaker>` và tag HTML trong cue bị loại bỏ.
  - Video > 1 giờ: `01:02:03` → `**[62:03]**` và `^t6203`.
  - Fixture `subtitle-en.vtt` → không ném lỗi, mọi đoạn khớp regex `/^\*\*\[\d{2,}:\d{2}\]\*\* .+ \^t\d{4,}$/m`.
- [ ] **Step 2:** `npx vitest run test/vtt.test.ts` → FAIL.
- [ ] **Step 3:** Implement: parse cue (bỏ header `WEBVTT`, NOTE, số thứ tự), gộp cue vào đoạn cho tới khi độ dài ≥ `minSeconds` và cue kết thúc câu (`.?!`) hoặc ≥ `maxSeconds`. Đoạn cách nhau một dòng trống.
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(ext): VTT to markdown with timestamp block ids`

---

### Task 3: CML → Markdown

**Files:** Create `extension/src/convert/cml.ts` · Test `extension/test/cml.test.ts`

**Interfaces:** Produces `cmlToMarkdown(cml: string): string`

- [ ] **Step 1: Write failing tests**
  - `<co-content><text>Hello <strong>world</strong></text></co-content>` → `Hello **world** ^p01`
  - `<heading level="2">Title</heading>` → `## Title` (heading **không** gắn block id)
  - `<list bulletType="numbers"><li><text>A</text></li><li><text>B</text></li></list>` → `1. A\n2. B` rồi dòng ` ^pNN` riêng sau list
  - `<a href="https://x.y">link</a>` → `[link](https://x.y)`; `<img src="https://i.png" alt="d"/>` → `![d](https://i.png)`
  - `<table>` 2×2 → bảng Markdown có hàng header
  - Tag lạ → giữ text bên trong, không ném lỗi
  - Fixture `supplement-cml.xml` → không ném lỗi, có ít nhất 1 `^p01`
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement bằng `fast-xml-parser` (`preserveOrder: true`) duyệt cây; inline (`strong`, `em`, `a`, `code`) render trong đoạn; `turndown` chỉ dùng nếu CML chứa HTML thô (ghi trong notes Phase 0). Đánh số `^pNN` tăng dần cho từng khối đoạn/list/table.
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(ext): CML reading to markdown with paragraph block ids`

---

### Task 4: Endpoints allowlist + parse JSON Coursera

**Files:** Create `extension/src/coursera/endpoints.ts`, `extension/src/coursera/parse.ts` · Test `extension/test/endpoints.test.ts`, `extension/test/parse.test.ts`

**Interfaces:**
- Produces (`endpoints.ts`): `urls.outline(slug: string): string`, `urls.lectureVideo(courseId: string, itemId: string): string`, `urls.supplement(courseId: string, itemId: string): string`, `isAllowedUrl(url: string): boolean`
- Produces (`parse.ts`): `parseOutline(json: unknown): CourseOutline`, `parseSubtitleUrls(json: unknown): Record<string, string>` (lang → URL tuyệt đối), `parseSupplementCml(json: unknown): string`
- URL/field chính xác lấy từ `docs/coursera-api-notes.md`.

- [ ] **Step 1: Write failing tests**
  - `isAllowedUrl(urls.outline('x'))`, `isAllowedUrl(urls.lectureVideo('c','i'))`, `isAllowedUrl(urls.supplement('c','i'))` → `true`; URL phụ đề lấy từ fixture → `true`.
  - `isAllowedUrl('https://www.coursera.org/api/onDemandExamSessions.v1/...')`, `.../quizzes...`, `.../onDemandProgrammingAssignments...`, `https://evil.com/api/onDemandCourseMaterials.v2` → `false`.
  - `parseOutline(fixture outline)` → `slug === 'project-initiation-google'`, `modules.length` bằng số module thấy trên web (ghi trong notes), mỗi module có ≥1 item, có item `type === 'quiz'` với `graded` đúng như trên web, thứ tự item khớp thứ tự trên trang.
  - `parseSubtitleUrls(fixture)` có key `en`, giá trị bắt đầu bằng `https://`.
  - `parseSupplementCml(fixture)` bắt đầu bằng `<co-content`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement. `isAllowedUrl` so khớp origin + tiền tố path theo danh sách cố định (không regex lỏng); `parseOutline` map `typeName` (`lecture`→`video`, `supplement`→`reading`, `exam`/`quiz`/`staffGraded`→`quiz`, khác→`other`); `learningObjectives` = `[]` nếu không có.
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(ext): Coursera endpoint allowlist and response parsers`

---

### Task 5: Hash + render file

**Files:** Create `extension/src/vault/hash.ts`, `extension/src/vault/render.ts` · Test `extension/test/render.test.ts`

**Interfaces:**
- Produces: `sha256(text: string): Promise<string>` → `sha256:<hex64>`
- Produces: `interface RawMeta { type: 'video' | 'reading'; course_slug: string; course_id: string; module: number; module_title: string; lesson: string; item_index: number; item_id: string; title: string; url: string; duration_min?: number; language: string; fetched_at: string; content_hash: string }`
- Produces: `renderRawFile(meta: RawMeta, body: string): string`, `renderCourseMd(outline: CourseOutline, manifest: Manifest): string`, `renderModuleMd(mod: OutlineModule, mm: ManifestModule, courseSlug: string): string`

- [ ] **Step 1: Write failing tests**
  - `sha256('abc')` → `sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`.
  - `renderRawFile` → bắt đầu `---\nschema: coursera-vault/1\ntype: video\n`, có đủ mọi key của spec 3.1 theo đúng thứ tự, `title` có dấu `"` được escape YAML, kết thúc frontmatter rồi `# <title>` rồi body.
  - `renderModuleMd` → có mục `## Learning objectives` (bỏ qua nếu rỗng), `## Items` liệt kê mọi item theo thứ tự; item video/reading là wikilink `[[raw/07 - … [video]|…]]`; item quiz là dòng `🧪 <title> (graded)` kèm link Coursera, **không** link file.
  - `renderCourseMd` → frontmatter `schema`, `course_id`, `slug`, `title`, `url`, `fetched_at`; danh sách link tới `_module.md` của từng module.
- [ ] **Step 2:** FAIL. **Step 3:** Implement (YAML viết tay, giá trị chuỗi luôn đặt trong `"…"` có escape). **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(ext): sha256 and markdown renderers for raw, course, module`

---

### Task 6: Manifest build + merge

**Files:** Create `extension/src/vault/manifest.ts` · Test `extension/test/manifest.test.ts`

**Interfaces:**
- Consumes: types Task 1, `moduleFolderName`, `itemFileName`
- Produces: `interface ItemResult { status: ItemStatus; hash: string | null; file: string | null }`
- Produces: `buildManifest(outline: CourseOutline, results: Map<string, ItemResult>, fetchedAt: string): Manifest`
- Produces: `mergeWithPrevious(next: Manifest, prev: Manifest | null): Manifest`

- [ ] **Step 1: Write failing tests**
  - Item quiz → `{ file: null, content_hash: null, status: 'not_fetched', graded: true }`.
  - Item video có result ok → `file` = `raw/01 - … [video].md` (tương đối với thư mục module), `folder` = `M01 - …`.
  - `mergeWithPrevious`: item có trong `prev` nhưng không có trong `next` → được thêm lại vào đúng module với `status: 'removed'`, giữ `file` cũ (Review Focus 5).
  - `prev = null` → trả nguyên `next`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(ext): manifest build and merge with removed items`

---

### Task 7: CourseraClient

**Files:** Create `extension/src/coursera/client.ts` · Test `extension/test/client.test.ts`

**Interfaces:**
- Consumes: `urls`, `isAllowedUrl`, parsers (Task 4)
- Produces: `type Fetcher = (url: string) => Promise<{ status: number; text: string }>`
- Produces: `class NotAllowedError`, `class AuthError`, `class HttpError { status: number }`
- Produces: `class CourseraClient { constructor(fetcher: Fetcher, opts?: { delayMs?: number; maxRetries?: number; sleep?: (ms: number) => Promise<void> }); getOutline(slug: string): Promise<CourseOutline>; getTranscript(courseId: string, itemId: string, lang: string): Promise<string | null>; getReadingCml(courseId: string, itemId: string): Promise<string> }`

- [ ] **Step 1: Write failing tests** (fake fetcher + fake `sleep` ghi lại số ms)
  - Mọi request đi qua `isAllowedUrl`; fetcher không bao giờ được gọi với URL bị chặn → `NotAllowedError`.
  - Giữa 2 request liên tiếp có `sleep(700)`.
  - 429 rồi 200 → thành công, có sleep backoff tăng dần; 500 ×4 → `HttpError(500)` sau đúng 4 lần gọi.
  - 401 hoặc 403 → `AuthError` ngay, không retry (Review Focus 1).
  - `getTranscript` khi không có lang yêu cầu → `null` (không ném lỗi).
- [ ] **Step 2:** FAIL. **Step 3:** Implement (backoff `delayMs * 2^attempt`). **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(ext): CourseraClient with allowlist, throttling, retry`

---

### Task 8: Vault writers

**Files:** Create `extension/src/vault/writers.ts` · Test `extension/test/writers.test.ts`

**Interfaces:**
- Produces: `interface VaultWriter { readText(path: string): Promise<string | null>; writeText(path: string, content: string): Promise<void> }` (path dùng `/`, tương đối với gốc vault)
- Produces: `class MemoryWriter implements VaultWriter { files: Map<string, string> }`
- Produces: `class FsAccessWriter implements VaultWriter { constructor(root: FileSystemDirectoryHandle) }` + `ensurePermission(root: FileSystemDirectoryHandle): Promise<boolean>`
- Produces: `class ZipWriter implements VaultWriter { finish(): Promise<Blob> }`
- Produces: `saveRootHandle(h)`, `loadRootHandle(): Promise<FileSystemDirectoryHandle | null>` (IndexedDB)

- [ ] **Step 1: Write failing tests**
  - `FsAccessWriter` với fake directory handle (in-memory mock của `getDirectoryHandle({create:true})`/`getFileHandle`/`createWritable`): `writeText('Coursera/a/M01 - x/raw/01 - y [video].md', 'z')` tạo đủ thư mục lồng nhau; `readText` file không tồn tại → `null`.
  - **Guard:** `writeText` với path chứa `/notes/`, `/my/`, `/_concepts/`, hoặc kết thúc `_profile.md`/`_dashboard.md` → throw (cả 3 writer dùng chung hàm `assertExtensionOwnedPath`).
  - `ensurePermission`: mock `queryPermission` → `'prompt'`, `requestPermission` → `'granted'` ⇒ `true`; `'denied'` ⇒ `false` (Review Focus 4).
  - `ZipWriter.finish()` → Blob mở lại bằng JSZip có đúng các path đã ghi.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(ext): vault writers (FS Access, ZIP, memory) with ownership guard`

---

### Task 9: Sync orchestrator

**Files:** Create `extension/src/sync/sync-course.ts` · Test `extension/test/sync-course.test.ts`

**Interfaces:**
- Consumes: Task 2–8
- Produces: `interface ResumeStore { load(slug: string): Promise<Record<string, ItemResult>>; save(slug: string, done: Record<string, ItemResult>): Promise<void>; clear(slug: string): Promise<void> }` + `chromeResumeStore` (dùng `chrome.storage.local`) + `memoryResumeStore()`
- Produces: `interface SyncReport { ok: number; written: number; unchanged: number; locked: number; unavailable: number; error: number; quizzes: number; stoppedForAuth: boolean }`
- Produces: `syncCourse(slug: string, deps: { client: CourseraClient; writer: VaultWriter; resume: ResumeStore; lang: string; now: () => string; onProgress?: (done: number, total: number, title: string) => void }): Promise<SyncReport>`

Luồng: lấy outline → đọc `Coursera/<slug>/_manifest.json` cũ (nếu có) → với từng item video/reading theo thứ tự (bỏ qua item đã có trong resume): locked → `locked`; lấy nội dung → convert → hash body → nếu hash bằng hash cũ **và** file tồn tại thì không ghi (`unchanged`), ngược lại ghi file raw → lưu resume sau mỗi item → cuối cùng ghi `_module.md` ×N, `_course.md`, `_manifest.json` (đã `mergeWithPrevious`) → `resume.clear`.

- [ ] **Step 1: Write failing tests** (fake fetcher phục vụ fixtures, `MemoryWriter`, `memoryResumeStore`)
  - Sync lần 1 → tạo `Coursera/project-initiation-google/_course.md`, `_manifest.json`, mỗi module có `_module.md` và file raw cho mọi video/reading không locked; **không** có file nào cho quiz; `report.quizzes` = số quiz trong outline.
  - Sync lần 2 cùng dữ liệu → `report.written === 0`, `report.unchanged === report.ok`.
  - Đổi nội dung VTT của 1 video → lần 3 `written === 1`.
  - Video không có phụ đề `en` → `status: 'unavailable'` trong manifest, sync tiếp tục (Review Focus 2).
  - Fetcher trả 401 ở item thứ 3 → `report.stoppedForAuth === true`, resume chứa 2 item đầu, **chưa** ghi `_manifest.json`; chạy lại với fetcher bình thường → fetcher **không** được gọi lại cho 2 item đầu, kết thúc đầy đủ (Review Focus 1).
  - Fetcher log: không có URL nào chứa `exam`, `quiz`, `Assignment`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS (cả bộ: `npx vitest run`).
- [ ] **Step 5: Commit** `feat(ext): sync orchestrator with diff and resume`

---

### Task 10: Content script, popup, trang Sync + E2E thủ công

**Files:**
- Create: `extension/entrypoints/content.ts`, `extension/entrypoints/popup/index.html`, `popup/main.ts`, `extension/entrypoints/sync/index.html`, `sync/main.ts`
- Modify: `extension/wxt.config.ts` (manifest: `permissions: ['storage', 'tabs']`, `host_permissions: ['https://www.coursera.org/*', <host phụ đề từ notes>]`)
- Test: `extension/test/content-bridge.test.ts`

**Interfaces:**
- Consumes: `isAllowedUrl`, `Fetcher`, `syncCourse`, writers, `chromeResumeStore`
- Produces: message `{ kind: 'coursera-fetch', url: string }` → response `{ status: number; text: string }`; `makeTabFetcher(tabId: number): Fetcher`; `detectCourseSlug(url: string): string | null`

- [ ] **Step 1: Write failing tests**
  - `detectCourseSlug('https://www.coursera.org/learn/project-initiation-google/home/module/3')` → `'project-initiation-google'`; `'https://www.coursera.org/'` → `null`.
  - Handler của content script với URL ngoài allowlist → `{ status: 0, text: 'NOT_ALLOWED' }` và **không** gọi `fetch` (kiểm tra lại allowlist ở cả hai phía).
- [ ] **Step 2:** FAIL. **Step 3:** Implement:
  - `content.ts`: lắng nghe message, kiểm tra `isAllowedUrl`, `fetch(url, { credentials: 'include' })`.
  - Popup: đọc tab hiện tại → slug; nếu không phải trang khóa → "Mở trang khóa học Coursera trước"; nút **Sync course** mở `sync.html?slug=…&tabId=…`.
  - Trang Sync: nút **Chọn thư mục vault** (`showDirectoryPicker`, `saveRootHandle`); khi mở lại thì `loadRootHandle` + `ensurePermission`; ô ngôn ngữ (mặc định `en`), ô delay (mặc định 700); nút **Bắt đầu** chạy `syncCourse` với thanh tiến độ `done/total – title`; báo cáo cuối hiển thị đủ các trường `SyncReport`; nếu `stoppedForAuth` → "Phiên đăng nhập Coursera đã hết. Đăng nhập lại rồi bấm Bắt đầu để chạy tiếp."; nút **Tải ZIP** dùng `ZipWriter` khi không chọn thư mục.
- [ ] **Step 4:** `npx vitest run` → PASS; `npx wxt build` → không lỗi.
- [ ] **Step 5: E2E thủ công** — `chrome://extensions` → Load unpacked `extension/.output/chrome-mv3`. Trên khóa *Project Initiation*: Sync vào vault thật. Kiểm tra:
  - Cây thư mục đúng spec mục 3; mở trong Obsidian thấy `_course.md` link tới các `_module.md`, các wikilink tới raw hoạt động.
  - Mở 1 file video, link `[[…#^t0215]]` thử từ một note khác nhảy đúng đoạn.
  - Bấm Sync lần 2 → báo cáo `written: 0`.
  - Network tab của trang Coursera: không có request quiz/exam nào do extension tạo.
- [ ] **Step 6: Commit** `feat(ext): content fetch bridge, popup, sync page`

---

## Sau Plan A

**Plan B — Skill `coursera-study`** (Phase 3–6 của spec): viết sau khi Task 10 chạy xong và vault đã có dữ liệu thật của khóa Project Initiation, để template, prompt, script `validate`/`grade` được thiết kế trên file raw thật.
