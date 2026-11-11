# Coursera → Obsidian Vault — Thiết kế

Ngày: 2026-11-11 · Trạng thái: **Draft v2, chờ duyệt**

## 1. Mục đích

Người đi làm có ít thời gian nên học Coursera rất chậm: xem từng video, đọc từng bài.
Mục tiêu là **học qua bản tổng hợp trong Obsidian, rồi tự làm quiz/test trên Coursera để hoàn thành khóa**. Course Certificate chỉ yêu cầu pass các graded assignments, không yêu cầu xem hết video.

Hệ thống gồm 2 phần, tách bạch hoàn toàn:

| Phần | Vai trò | Có AI? |
|---|---|---|
| **A. Chrome extension** | Lấy nội dung khóa học (transcript video, bài reading) khi người dùng đã login, ghi ra file `.md` thô vào vault | **Không.** Chỉ là code thuần |
| **B. Skill `coursera-study`** + **Obsidian MCP** (có sẵn) | Đọc phần thô, tạo tóm tắt, sơ đồ tư duy, ý chính, ví dụ thực tế, câu hỏi luyện tập, flashcard ngay trong Obsidian | Có |

**Hợp đồng duy nhất giữa A và B là cấu trúc thư mục và frontmatter ở mục 3.** Hai bên không gọi trực tiếp nhau.

## 2. Mục tiêu / Ngoài phạm vi / Điều cấm

**Mục tiêu**
- Bấm một nút là lấy được toàn bộ khóa: module → lesson → item (transcript video, reading).
- Sync lại thì chỉ cập nhật item thay đổi, nhận biết qua content hash.
- Có tóm tắt theo module, sơ đồ tư duy, key points, ví dụ thực tế, câu hỏi luyện tập, flashcard. Tất cả dùng được trong Obsidian.
- Khái niệm dùng chung cho cả 6 khóa của Google PM Certificate.

**Ngoài phạm vi (v1)**
- Firefox và các trình duyệt khác. **Chỉ làm Chrome.**
- **Lấy nội dung quiz/test** dưới mọi hình thức: không mở, không đọc câu hỏi. Lý do là có rủi ro tạo attempt, ảnh hưởng tới điểm. Extension chỉ ghi *tên và loại* bài quiz (lấy từ dữ liệu outline có sẵn) vào manifest để Skill biết module có bài kiểm tra nào.
- Tải file video hoặc audio gốc.
- Bản audio/podcast tóm tắt, song ngữ (để sang v2).
- Tự viết MCP server riêng (đã có Obsidian MCP, xem 5.2).

**Điều cấm** (vi phạm thì coi là thất bại dù code chạy được)
- Gọi bất kỳ endpoint quiz, exam hay assignment nào của Coursera.
- Phân phối lại nội dung khóa học. Vault chỉ để học cá nhân.
- Extension ghi đè lên note do người dùng hoặc AI tạo (`notes/`, `_concepts/`).
- Dồn request làm tài khoản bị rate-limit hoặc khóa.
- Sinh output dạng web/HTML nằm ngoài Obsidian.

## 3. Cấu trúc vault (hợp đồng A ↔ B)

```
<Vault>/
└── Coursera/
    ├── _dashboard.md                    # B: dashboard Dataview
    ├── _concepts/                       # B: 1 note / khái niệm, dùng chung mọi khóa
    │   └── Stakeholder analysis.md
    └── <course-slug>/                   # vd: project-initiation-google
        ├── _course.md                   # A: metadata khóa + mục lục
        ├── _manifest.json               # A: dữ liệu máy đọc (ids, hash, thứ tự)
        ├── M01 - <Module name>/
        │   ├── _module.md               # A: metadata module + danh sách item (gồm cả quiz: chỉ tên/loại)
        │   ├── raw/                     # A: nội dung gốc, KHÔNG sửa tay
        │   │   ├── 01 - <Item title> (video).md
        │   │   └── 02 - <Item title> (reading).md
        │   ├── notes/                   # B: sản phẩm AI
        │   │   ├── _study.md            # trang học chính + lộ trình học module
        │   │   ├── summary.md           # có mermaid mindmap ở đầu
        │   │   ├── mindmap.canvas
        │   │   ├── exam-prep.md         # phân tích để pass test: keys phải nhớ, bẫy, cheat sheet
        │   │   ├── examples.md          # ví dụ thực tế theo từng khái niệm
        │   │   ├── flashcards.md
        │   │   └── practice/
        │   │       ├── pretest.md       # 5 câu chẩn đoán trước khi học
        │   │       ├── practice-test.md # đề mô phỏng bài graded quiz
        │   │       └── retry-01.md      # đề ôn lại phần yếu (sinh sau khi chấm)
        │   └── my/                      # NGƯỜI HỌC sở hữu, A và B chỉ đọc
        │       └── mistakes.md          # (tùy chọn) ghi lại câu sai sau khi làm quiz thật
        └── M02 - .../
    └── _profile.md                      # NGƯỜI HỌC: nghề nghiệp, ngành, dự án đang làm → để cá nhân hóa ví dụ
```

**Quy tắc sở hữu:** A chỉ ghi `_course.md`, `_manifest.json`, `_module.md`, `raw/`. B chỉ ghi `notes/`, `_concepts/`, `_dashboard.md`. Người học sở hữu `my/` và `_profile.md`. B tạo `_profile.md` từ template nếu chưa có, sau đó không ghi đè nữa.

**`_module.md` phải có** (lấy từ dữ liệu outline, không đụng quiz): mô tả module, **learning objectives** (nếu Coursera cung cấp, Phase 0 xác minh), thời lượng, danh sách item theo thứ tự, gồm cả quiz (chỉ tên, loại, graded).

**Đặt tên:** Loại item để trong ngoặc tròn `(video)` vì Obsidian không link được tới tên file chứa `[ ]`. `M` + số module 2 chữ số, item đánh số theo thứ tự trong module (tính cả quiz để số thứ tự khớp với Coursera, nên số file trong `raw/` có thể nhảy cóc). Tên file được làm sạch ký tự cấm (`/\:*?"<>|#^[]`), cắt tối đa 80 ký tự. Định danh thật là `item_id` trong frontmatter, không phải tên file.

### 3.1 Frontmatter file raw

```yaml
---
schema: coursera-vault/1
type: video            # video | reading
course_slug: project-initiation-google
course_id: <id>
module: 1
module_title: "..."
lesson: "..."
item_index: 3
item_id: <id>
title: "..."
url: https://www.coursera.org/learn/<slug>/lecture/<itemId>/<item-slug>
duration_min: 5        # nếu có
language: en
fetched_at: 2026-11-11T09:00:00Z
content_hash: sha256:...
---
```

### 3.2 Thân file raw

- **video:** Transcript chia đoạn, mỗi đoạn bắt đầu bằng mốc thời gian `**[02:15]**` và kết thúc bằng block id `^t0215`, lấy từ file VTT, gộp cue thành đoạn khoảng 30–60 giây.
- **reading:** Nội dung bài đọc chuyển sang Markdown, giữ heading, list, bảng, link, mỗi đoạn gắn block id `^p01`, `^p02`… Ảnh giữ dạng link ngoài, v1 không tải về.

Block id dùng để note AI trích dẫn ngược chính xác tới đoạn gốc.

### 3.3 `_manifest.json`

```json
{
  "schema": "coursera-vault/1",
  "course": { "id": "", "slug": "", "title": "", "fetched_at": "" },
  "modules": [
    { "index": 1, "id": "", "title": "", "folder": "M01 - ...",
      "items": [
        { "index": 1, "id": "", "type": "video", "title": "", "file": "raw/01 - ... (video).md",
          "content_hash": "", "status": "ok|locked|unavailable|error|removed" },
        { "index": 5, "id": "", "type": "quiz", "title": "", "graded": true, "file": null,
          "status": "not_fetched" }
      ] }
  ]
}
```

B dùng `content_hash` để biết note nào đã cũ: mỗi file trong `notes/` ghi lại `source_hashes` trong frontmatter của chính nó.

## 4. Phần A — Chrome extension

**Stack:** [WXT](https://wxt.dev) (Manifest V3), TypeScript, Vitest, thư viện `turndown` để chuyển HTML sang MD. Chỉ build cho Chrome; Edge/Brave dùng chung bản build Chromium nên chạy được, nhưng không cam kết hỗ trợ.

**Xác thực:** Content script chạy trên `coursera.org` và gọi API của Coursera với `credentials: 'include'`, dùng luôn phiên đăng nhập sẵn có. Không cần dán cookie.

**Nguồn dữ liệu:** Đây là API nội bộ, không công khai, có thể đổi bất cứ lúc nào. Phase 0 phải xác minh lại bằng DevTools.
- Cấu trúc khóa: `onDemandCourseMaterials.v2` (modules, lessons, items, kèm loại item, nhờ đó biết item là quiz mà không phải mở quiz)
- Video: `onDemandLectureVideos.v1` → link phụ đề VTT/TXT theo ngôn ngữ
- Reading: `onDemandSupplements.v1` → asset dạng CML (XML riêng của Coursera), cần bộ chuyển CML → MD
- **Có allowlist endpoint trong code:** `CourseraClient` chỉ được gọi 3 nhóm endpoint trên. Gọi endpoint khác thì throw lỗi, có unit test kiểm tra.

**Ghi file vào vault:** Dùng **File System Access API**. Người dùng chọn thư mục vault một lần, handle được lưu trong IndexedDB; Chrome có thể hỏi lại quyền khi mở lần sau. Dự phòng: xuất ZIP qua Downloads.

**UI (popup):** Nhận diện khóa từ tab đang mở → nút **Sync course** → thanh tiến độ theo item → báo cáo cuối: số item ok, số item bị khóa, số item lỗi. Phần cài đặt gồm thư mục vault, ngôn ngữ transcript (mặc định `en`), độ trễ giữa các request (mặc định 700ms).

**Hành vi:**
- Gọi tuần tự, có độ trễ, retry kèm backoff khi gặp 429/5xx.
- Có thể chạy tiếp từ chỗ dừng: tiến độ lưu trong `chrome.storage`.
- Sync lại: tính hash, chỉ ghi file khi nội dung đổi. Item bị xóa khỏi khóa thì đánh dấu `status: removed`, không xóa file.
- Item bị khóa (chưa trả phí, chưa tới hạn) ghi `status: locked`, không coi là lỗi.

**Kiểm thử:** Lưu fixture JSON/VTT/CML thật lấy ở Phase 0, test các bộ chuyển đổi (VTT→MD, CML→MD, đặt tên file, manifest diff, allowlist endpoint) bằng Vitest. Test tay end-to-end trên khóa *Project Initiation*.

## 5. Phần B — Skill `coursera-study` + Obsidian MCP

### 5.1 Skill (`~/.claude/skills/coursera-study/`)

Gồm `SKILL.md`, các template output, prompt cho từng loại note và một script kiểm tra (validate). Lệnh dùng:

- **`/coursera-study setup`**: chạy preflight (mục 5.3) và chọn vault/khóa.
- **`/coursera-study <course> [module]`**: tạo hoặc cập nhật `notes/` cho module (hoặc mọi module có note cũ).
  - `_study.md`: **trang học chính**, gồm lộ trình học (mục 5.8), checklist, link tới mọi note, và danh sách bài quiz/test thật của module lấy từ manifest kèm link Coursera.
  - `summary.md`: bản đọc khoảng 10 phút, mở đầu bằng Mermaid mindmap. Mỗi ý có trích dẫn nguồn `[[01 - … (video)#^t0215]]`.
  - `mindmap.canvas`: sơ đồ tư duy tương tác.
  - `exam-prep.md`: phân tích để pass test (mục 5.6).
  - `examples.md`: ví dụ thực tế (mục 5.7).
  - `practice/`: câu hỏi luyện tập (mục 5.5).
  - `flashcards.md`: flashcard theo định dạng Spaced Repetition, sinh từ danh sách "phải nhớ" trong `exam-prep.md`.
- **`/coursera-study grade <course> <module> [file]`**: chấm bài luyện tập người học đã làm ngay trong Obsidian, cập nhật điểm yếu, sinh đề `retry-NN.md`.
- **Khái niệm dùng chung:** tạo hoặc nối vào `Coursera/_concepts/<Concept>.md` (định nghĩa, ví dụ, backlink tới các module và khóa có nhắc tới).
- **Dashboard:** `Coursera/_dashboard.md` dùng Dataview.

**Nguyên tắc nội dung:** Chỉ khẳng định những gì có trong `raw/`. Kiến thức thêm từ ngoài (ví dụ, web) phải đánh dấu rõ là bổ sung.

### 5.2 Tương tác với Obsidian qua MCP

Đã có sẵn MCP cho Obsidian, không cần tự viết. Cách hoạt động: plugin cộng đồng **Local REST API** mở API tại `https://127.0.0.1:27124` (cần API key), và một MCP server nối API đó vào Claude ([hướng dẫn 2026](https://mcp.directory/blog/obsidian-mcp-complete-guide-2026)).

- **Mặc định:** `mcp-obsidian` (Python, `uvx`): `claude mcp add obsidian uvx mcp-obsidian -e OBSIDIAN_API_KEY=…`. Có thể thay bằng `@fazer-ai/mcp-obsidian` (TS/Bun, có thêm chạy command Obsidian và periodic notes). Phase 4 thử cả hai rồi chốt một.
- **Skill dùng MCP để:** đọc/tìm trong vault, ghi hoặc patch note theo heading (nối thêm vào `_concepts` mà không viết lại cả file), **mở `_study.md` trong Obsidian** sau khi tạo xong, và chạy command (ví dụ mở Canvas, mở review flashcard) nếu server hỗ trợ.
- **Dự phòng:** Không có MCP hoặc Obsidian đang tắt thì Skill ghi file trực tiếp vào thư mục vault (Claude Code làm được), rồi báo người dùng mở Obsidian.
- Lưu ý: chứng chỉ self-signed. Cấu hình theo hướng dẫn của plugin, **không** đặt `NODE_TLS_REJECT_UNAUTHORIZED=0` toàn cục.

### 5.3 Preflight: phát hiện thiếu plugin/MCP và báo người dùng

Mỗi lần chạy, Skill kiểm tra rồi in **một bảng trạng thái**. Skill **không tự cài**; người dùng tự cài theo hướng dẫn kèm theo.

| Kiểm tra | Cách kiểm tra | Mức | Nếu thiếu |
|---|---|---|---|
| Vault hợp lệ, có `Coursera/<course>/_manifest.json` | đọc file | Bắt buộc | Dừng, hướng dẫn chạy extension Sync |
| Obsidian MCP đã kết nối | thử gọi 1 tool của MCP | Khuyến nghị | Chạy chế độ ghi file trực tiếp; in lệnh `claude mcp add …` |
| Plugin Local REST API | `.obsidian/plugins/obsidian-local-rest-api/` + `community-plugins.json` | Khuyến nghị (cần cho MCP) | In hướng dẫn cài |
| Dataview | `.obsidian/plugins/dataview/` | Bắt buộc cho dashboard | Vẫn tạo note; báo dashboard sẽ không hiển thị |
| Spaced Repetition | `.obsidian/plugins/obsidian-spaced-repetition/` | Bắt buộc cho flashcard | Vẫn tạo file; báo không ôn được |
| Core plugin Canvas bật | `.obsidian/core-plugins.json` | Bắt buộc cho mindmap | Báo bật trong Settings → Core plugins |
| Markmap, Tasks | thư mục plugin | Tùy chọn | Chỉ ghi chú, không cảnh báo |

Plugin id phải xác minh lại ở Phase 4.

### 5.4 Nguyên tắc: mọi output đều "Obsidian-native"

Người học học và tương tác **trong Obsidian**, nên Skill **chỉ** sinh định dạng Obsidian (lõi hoặc plugin) render được. **Không** sinh web/HTML/artifact.

| Nhu cầu | Định dạng sinh ra | Cần gì |
|---|---|---|
| Sơ đồ tư duy tương tác (chính) | `mindmap.canvas` (JSON Canvas). Node trung tâm là module, nhánh là ý chính; **file node trỏ tới `_concepts/…`** để bấm vào mở note | Core: Canvas |
| Sơ đồ tư duy nhanh trong note | ` ```mermaid ` `mindmap` ở đầu `summary.md` | Core |
| Quy trình, so sánh | Mermaid `flowchart`, `timeline`, `quadrantChart` (ví dụ ma trận stakeholder power/interest) | Core |
| Ý chính, cảnh báo, ví dụ | Callouts `[!tip]`, `[!warning]`, `[!example]`, `[!abstract]` | Core |
| Quiz tự kiểm tra | Phương án là checkbox `- [ ]` để tick; câu điền dùng `Trả lời:: `; lời giải trong callout gập `> [!success]-` (mẫu ở 5.5) | Core |
| Flashcard | `Q::A`, `Q:::A` (2 chiều), cloze `==…==`, tag `#flashcards/<course>/<module>` | Spaced Repetition |
| Dashboard tiến độ, note cũ | ` ```dataview ` đọc frontmatter | Dataview |
| Checklist học | `- [ ]` | Core (Tasks: tùy chọn) |
| Mạng kiến thức | `[[wikilink]]`, tag `#concept`, alias trong frontmatter, xem trên Graph view | Core |
| Trích dẫn nguồn | `[[file#^t0215]]` / embed `![[…#^t0215]]` | Core |
| Mind map cây từ heading | ` ```markmap ` | Markmap (tùy chọn) |

**Kiểm tra trước khi ghi** (script trong skill): Mermaid parse được, `.canvas` là JSON hợp lệ và mọi file node trỏ tới file có thật, wikilink/block ref không gãy. Không sinh Excalidraw ở v1.

### 5.5 Câu hỏi luyện tập: lấy ở đâu, sinh thế nào

**Bước 1. Xác định phạm vi mỗi bài test thật (không cần mở quiz).** Từ thứ tự item trong manifest, phạm vi của một bài quiz là *mọi item nằm sau quiz trước đó và trước quiz này*. Ví dụ "Module 2 Challenge" bao phủ toàn bộ video và reading của module 2. Skill ghi bản đồ này vào `exam-prep.md`.

**Bước 2. Thu thập "tín hiệu đề thi" từ nội dung có sẵn**, theo thứ tự độ tin cậy:

| Nguồn | Vì sao quan trọng | Lấy từ đâu |
|---|---|---|
| **Learning objectives** của module | Bài graded được thiết kế để kiểm tra đúng các mục tiêu này | `_module.md` |
| **Glossary** của module (khóa Google thường có reading "Glossary terms from module N") | Thuật ngữ hay ra đề dạng định nghĩa | `raw/` (reading) |
| **Video wrap-up/recap** cuối module | Giảng viên tự tóm lại cái quan trọng | `raw/` (video) |
| **Câu nhấn mạnh** trong transcript ("key", "remember", "important", "the main…", các danh sách "three steps…") và thuật ngữ lặp lại nhiều lần | Dấu hiệu nội dung trọng tâm | `raw/` |
| **Case study của khóa** (công ty, dự án giả định xuyên suốt khóa) | Câu tình huống thường dùng lại bối cảnh này | `raw/` |
| **Câu sai của chính người học** | Điểm yếu thật | `my/mistakes.md` |

**Bước 3. Sinh câu hỏi theo "blueprint"** để giống đề thật. Mỗi learning objective có ít nhất 2 câu. Tỉ lệ mặc định gần với kiểu đề Google PM: khoảng 30% hỏi định nghĩa/nhận biết thuật ngữ, 50% **tình huống** ("Bạn là PM, stakeholder X yêu cầu Y, bạn nên làm gì trước?"), 20% chọn nhiều đáp án, câu "điều nào KHÔNG phải" hoặc sắp xếp thứ tự bước.

Mỗi câu hỏi phải có:
- Đề bài, các lựa chọn, đáp án đúng.
- **Giải thích vì sao đúng, và vì sao từng phương án nhiễu sai.** Đây là nơi người học hiểu bản chất.
- Phương án nhiễu được dựng từ **các cặp khái niệm hay nhầm** (ví dụ goal và deliverable, stakeholder và team member, scope creep và thay đổi có kiểm soát), không dựng bừa.
- Tag learning objective và trích dẫn tới đoạn gốc `[[…#^t0215]]`.

**Bước 4. Ba loại đề, dùng ở ba thời điểm:**

| File | Khi nào | Số câu | Mục đích |
|---|---|---|---|
| `pretest.md` | Trước khi học | 5 | Chẩn đoán: phần nào đã biết thì đọc lướt |
| `practice-test.md` | Sau khi học, trước khi làm bài thật | 10–15 | Mô phỏng bài graded. Đạt ≥ 80% thì đi làm bài thật |
| `retry-NN.md` | Sau khi chấm | 5–8 | Chỉ hỏi lại phần sai, đổi tình huống, không lặp nguyên câu |

**Bước 5. Làm bài và chấm ngay trong Obsidian, giao diện giống Coursera.**

- **Trắc nghiệm (chọn 1 / chọn nhiều):** mỗi phương án là một **checkbox** `- [ ]`. Người học **bấm tick** trong Obsidian, không phải gõ. Đề ghi rõ *(Chọn 1)* hoặc *(Chọn tất cả đáp án đúng)* như Coursera.
- **Điền thông tin / tự luận ngắn:** chỉ những câu này mới có dòng `Trả lời:: ` để gõ.
- **Đúng/Sai, sắp xếp thứ tự:** đúng/sai dùng 2 checkbox; câu sắp xếp ghi thứ tự vào `Trả lời:: ` (ví dụ `3,1,2,4`).
- Checkbox để ở danh sách thường, **không đặt trong callout**, để tick được ổn định ở cả Live Preview và Reading view. Lời giải nằm ngay dưới, trong callout gập `> [!success]- Đáp án & giải thích`.

Mẫu:

```markdown
### Câu 3 *(Chọn 1)* · Objective: Identify project stakeholders
Bạn vừa được giao dự án triển khai CRM mới. Việc nào nên làm **đầu tiên**?
- [ ] A. Lập kế hoạch truyền thông chi tiết
- [ ] B. Xác định các stakeholder và mức độ ảnh hưởng của họ
- [ ] C. Chọn nhà cung cấp phần mềm
- [ ] D. Viết tài liệu nghiệm thu

> [!success]- Đáp án & giải thích
> **B.** … Vì sao A/C/D chưa phải bước đầu: … · Nguồn: [[03 - … (video)#^t0215]]

### Câu 7 *(Điền)* · Objective: Define project scope
Thuật ngữ chỉ việc phạm vi dự án bị mở rộng ngoài kiểm soát là gì?
Trả lời:: 
> [!success]- Đáp án & giải thích
> **Scope creep** …
```

Chạy `/coursera-study grade` → Skill đọc trạng thái `[x]` và các dòng `Trả lời::`. Câu chọn 1 mà tick nhiều ô thì tính sai và ghi chú lại. Câu điền thì chấm theo nghĩa, chấp nhận đồng nghĩa và lỗi chính tả nhỏ. Kết quả ghi vào frontmatter (`score`, `weak_objectives`), cập nhật dashboard, sinh `retry-NN.md` và chỉ ra đoạn transcript cần xem lại. Muốn làm lại thì chạy `grade --reset` để bỏ hết dấu tick. Người học cũng có thể tự mở callout xem đáp án mà không cần chấm.

**Nguồn bổ sung từ internet** (đánh dấu rõ là bổ sung, ghi nguồn): câu hỏi cùng chủ đề từ tài liệu ôn **CAPM/PMP** và tài liệu mở về PM, dùng khi module ít nội dung hoặc người học muốn thêm đề.
**Không** lấy đáp án quiz Coursera từ các trang chia sẻ đáp án (vi phạm Honor Code, lại hay sai).

**Câu sai ở bài thật (tùy chọn):** Sau khi nộp bài graded, Coursera hiển thị phản hồi. Người học có thể tự ghi lại vắn tắt câu sai vào `my/mistakes.md`. Skill chỉ đọc file này để phân tích lỗ hổng và sinh đề retry. Extension không bao giờ lấy dữ liệu này.

### 5.6 `exam-prep.md`: phân tích để pass test

Cấu trúc cố định:

1. **Bản đồ đề thi:** bảng *bài test thật → item nằm trong phạm vi → learning objectives → khái niệm chính*.
2. **Phải nhớ (Must-know):** mỗi mục là một callout `[!important]`, xếp theo mức ưu tiên:
   - ⭐⭐⭐ xuất hiện ở objective + glossary + recap; ⭐⭐ ở 2 nguồn; ⭐ ở 1 nguồn.
   - **Định nghĩa giữ nguyên cách diễn đạt của khóa** (tiếng Anh, vì đề thi dùng đúng chữ đó), kèm diễn giải tiếng Việt một dòng.
   - Danh sách, khung lý thuyết **có thứ tự** (ví dụ các giai đoạn của vòng đời dự án, các thành phần của SMART), kèm mẹo nhớ (acronym, câu vần).
3. **Dễ nhầm:** bảng so sánh các cặp khái niệm hay bị lẫn: khác nhau ở đâu, dấu hiệu nhận ra trong đề.
4. **Bẫy đề thường gặp:** các dạng câu "best/first/most appropriate", phương án "đúng nhưng chưa phải bước đầu tiên", phương án tuyệt đối hóa ("always/never").
5. **Tư duy của khóa:** những nguyên tắc khóa học ưu tiên khi chọn đáp án tình huống, ví dụ "trao đổi với stakeholder trước khi quyết định", "ghi lại thay đổi thay vì tự làm".
6. **Cheat sheet 1 màn hình:** bản cô đọng nhất để đọc 3 phút trước khi làm bài.

Mỗi mục trích dẫn nguồn trong `raw/`, và mỗi mục Must-know sinh tương ứng ít nhất 1 flashcard.

### 5.7 `examples.md`: ví dụ thực tế để hiểu bản chất

Với mỗi khái niệm chính (theo thứ tự ưu tiên trong `exam-prep.md`), Skill viết một khối `[!example]` gồm 6 phần:

| Phần | Nội dung | Mục đích |
|---|---|---|
| **Bản chất 1 câu** | Nói thẳng khái niệm giải quyết vấn đề gì | Hiểu "tại sao có nó" |
| **Ví dụ đời thường** | Phép so sánh quen thuộc (tổ chức đám cưới, sửa nhà, chuyến du lịch) | Nắm ý trong 10 giây |
| **Ví dụ công việc** | Tình huống trong ngành/vai trò của người học, lấy từ `_profile.md`, có tên vai trò, con số, mốc thời gian cụ thể | Gắn với thực tế, nhớ lâu |
| **Ví dụ trong khóa** | Cách khóa học minh họa (case study), có trích dẫn | Khớp với ngữ cảnh đề thi |
| **Làm sai thì sao** | Phản ví dụ: bỏ qua khái niệm này thì dự án hỏng thế nào | Hiểu qua hậu quả |
| **Trong đề sẽ hỏi kiểu** | 1 câu tình huống mẫu kèm đáp án gập | Nối ví dụ với bài test |

**Tiêu chuẩn ví dụ:** cụ thể (có người, có số, có quyết định và hậu quả), ngắn (≤ 120 từ mỗi phần), không chung chung kiểu "trong một dự án nào đó". Ví dụ tự nghĩ ra thì ghi rõ là minh họa, không phải nội dung khóa. Khi cùng khái niệm xuất hiện ở khóa sau, ví dụ được nối vào `_concepts/<Concept>.md` thay vì viết lại.

**`_profile.md`** (người học điền một lần, Skill tạo template): vai trò, ngành, loại dự án đang làm, mục tiêu học. Không có profile thì dùng ví dụ công việc chung về phần mềm và vận hành.

### 5.8 Lộ trình học một module (hiển thị trong `_study.md`)

```
1. pretest.md            (5')   → biết mình đã nắm gì
2. exam-prep.md          (10')  → Must-know + Dễ nhầm, đọc kỹ phần pretest sai
3. mindmap.canvas        (3')   → nhìn tổng thể
4. examples.md           (10')  → hiểu bản chất các khái niệm ⭐⭐⭐
5. summary.md            (tùy)  → đọc khi cần chi tiết; bấm trích dẫn để xem đoạn video gốc
6. practice-test.md      (10')  → /coursera-study grade → đạt ≥ 80%?
      ├─ chưa → retry-NN.md → lặp lại
      └─ đạt  → đọc cheat sheet → làm bài graded thật trên Coursera
7. flashcards            (hằng ngày, 5') → ôn ngắt quãng
```
Mục tiêu khoảng 45–60 phút mỗi module thay vì vài giờ xem video.

## 6. Lộ trình

| Phase | Nội dung | Xong khi |
|---|---|---|
| **0. Spike** (1–2 ngày) | Dùng DevTools trên khóa Project Initiation: xác minh 3 nhóm endpoint (outline, video, reading), xem outline có **learning objectives** không, lưu fixture. Không đụng tới quiz | Có fixture + ghi chú API |
| **1. Extension MVP** | Scaffold WXT, `CourseraClient` + allowlist, VTT→MD, CML→MD, writer FS Access, popup sync | Sync xong khóa Project Initiation vào vault đúng cấu trúc mục 3 |
| **2. Sync lại có diff** | Hash, manifest diff, resume, locked/removed, ZIP dự phòng | Sync lần 2 không ghi lại file không đổi |
| **3. Skill v1: hiểu & nhớ** | Preflight, `_profile.md`, summary + Mermaid, mindmap.canvas, **exam-prep.md**, **examples.md**, flashcards, `_study.md`, ghi file trực tiếp | Module 3 có đủ notes; người dùng đọc trong Obsidian thấy dùng được |
| **4. Skill v2: luyện đề** | pretest, practice-test theo blueprint, lệnh `grade`, retry, đọc `my/mistakes.md`, dashboard điểm | Học xong 1 module chỉ bằng notes, practice-test ≥ 80%, rồi pass bài graded thật |
| **5. Tích hợp Obsidian MCP** | Thử `mcp-obsidian` / `@fazer-ai`, chốt một; patch `_concepts`, mở note sau khi tạo | Chạy skill thì Obsidian tự mở `_study.md` |
| **6. Khái niệm xuyên khóa** | `_concepts/`, nối ví dụ và câu hỏi khi sang khóa thứ 2 | Sang khóa 2 không sinh trùng khái niệm |
| **v2** | Audio tóm tắt, song ngữ, tải ảnh reading | — |

## 7. Rủi ro

- **Coursera đổi API nội bộ:** gom vào `CourseraClient`, có fixture test, báo lỗi rõ ràng.
- **Chrome mất quyền thư mục:** hỏi lại quyền; dự phòng ZIP.
- **MCP Obsidian cộng đồng thay đổi tool hoặc lỗi phiên bản** (đã có báo cáo crash khi không pin version `mcp`): pin version, có chế độ ghi file trực tiếp.
- **Transcript tự động có lỗi chính tả:** Skill được phép sửa khi tóm tắt, raw giữ nguyên.

## 8. Quyết định do Claude tự chọn (người dùng có thể đổi)

WXT + TypeScript; mặc định transcript tiếng Anh; sơ đồ tư duy chính dùng Canvas, bản nhanh dùng Mermaid; plugin bắt buộc chỉ Dataview + Spaced Repetition; delay 700ms; tách `raw/` và `notes/`; MCP mặc định `mcp-obsidian`; Skill có chế độ ghi file trực tiếp khi không có MCP.
