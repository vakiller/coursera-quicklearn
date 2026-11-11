# Hướng dẫn sử dụng: Coursera → Obsidian → học nhanh

Hệ thống gồm 2 phần:

| Phần | Làm gì | Ở đâu |
|---|---|---|
| **Chrome extension "Coursera Vault Sync"** | Lấy transcript video và bài reading của khóa học vào vault Obsidian | `extension/.output/chrome-mv3` |
| **Skill `coursera-study`** cho Claude Code | Từ nội dung đó tạo ghi chú học, sơ đồ tư duy, ý phải nhớ, ví dụ, đề luyện tập, flashcard ngay trong vault; chấm đề bạn đã làm | `~/.claude/skills/coursera-study` (liên kết tới `skills/coursera-study` trong repo này) |

Mọi thứ bạn học và tương tác đều nằm **trong vault Obsidian của bạn**: `/Users/aiden/pm-course-google`. Bạn không cần mở thư mục nào khác.

---

## 1. Cài đặt (làm một lần)

### 1.1 Extension Chrome
1. Mở `chrome://extensions` và bật **Developer mode**.
2. Bấm **Load unpacked**, rồi chọn `/Users/aiden/learn_pm_course_coursera/extension/.output/chrome-mv3`.
3. Nếu sau này code được cập nhật: build lại bằng `cd extension && npx wxt build`, rồi bấm ↻ trên thẻ extension và F5 tab Coursera.

### 1.2 Plugin Obsidian
| Plugin | Bắt buộc? | Cách bật |
|---|---|---|
| **Spaced Repetition** | Có (để ôn flashcard) | Settings → Community plugins → Turn on → Browse → "Spaced Repetition" → Install → Enable |
| Canvas, Bases | Có, nhưng là plugin lõi và **đã bật sẵn** | Settings → Core plugins |
| Local REST API + Obsidian MCP | Không (để sau) | Chỉ cần khi muốn Claude tự mở note trong Obsidian |

### 1.3 Skill
Đã cài sẵn. Kiểm tra bằng cách gõ `/coursera-study` trong Claude Code; nếu lệnh xuất hiện trong danh sách là được.

### 1.4 Hồ sơ người học (2 phút)
Mở `Coursera/_profile.md` trong Obsidian, rồi điền vai trò, ngành, loại dự án đang làm và mục tiêu học. Skill dựa vào đây để viết **ví dụ sát với công việc của bạn**. Để trống thì ví dụ sẽ chung chung.

---

## 2. Đưa khóa học vào vault

1. Đăng nhập Coursera trên Chrome, rồi mở trang khóa học (ví dụ `coursera.org/learn/<tên-khóa>/home/module/1`).
2. Bấm icon extension và chọn **Sync course**.
3. Ở tab Sync:
   - Lần đầu: bấm **Chọn thư mục vault** và chọn `/Users/aiden/pm-course-google`.
   - Chọn ngôn ngữ transcript. Nên để English, vì đề thi dùng thuật ngữ tiếng Anh.
   - Bấm **Bắt đầu sync** và **giữ tab Coursera mở** đến khi xong, khoảng 1–2 phút mỗi khóa.
4. Kết quả: thư mục `Coursera/<tên-khóa>/M01 - …/raw/` chứa transcript và bài đọc.

**Sync lại** (khi Coursera cập nhật bài, hoặc khi bạn đã mở khóa thêm bài) cũng làm y như trên. Chỉ những file thay đổi mới bị ghi lại, và ghi chú của bạn không bị đụng tới.

Nếu sync bị dừng giữa chừng (hết phiên đăng nhập, lỡ đóng tab): đăng nhập lại hoặc mở lại tab, rồi bấm **Bắt đầu sync**. Extension chạy tiếp từ chỗ dừng.

---

## 3. Mở Claude Code đúng chỗ

Luôn mở Claude Code **ngay trong vault**:

```bash
cd ~/pm-course-google
claude
```

Skill tự nhận ra vault từ thư mục hiện tại, nên bạn không cần gõ đường dẫn. Mọi ghi chú được ghi thẳng vào vault và hiện ngay trong Obsidian.

Nếu bạn lỡ mở Claude ở chỗ khác, chỉ cần nói thêm "vault của mình ở ~/pm-course-google".

---

## 4. Các câu lệnh hay dùng (nói tự nhiên, tiếng Việt cũng được)

| Bạn muốn | Gõ | Kết quả |
|---|---|---|
| Kiểm tra vault và plugin | `kiểm tra vault` hoặc `/coursera-study setup` | Bảng trạng thái: plugin còn thiếu, module nào đã có hoặc chưa có ghi chú. **Không ghi file nào** |
| Tạo ghi chú cho một module | `tạo ghi chú cho module 3` | Ghi đủ bộ ghi chú vào `M03 - …/notes/` (mất khoảng 5–10 phút) |
| Chấm đề đã làm | `chấm bài practice test module 2` hoặc `/coursera-study grade` | Điểm, phần còn yếu, đoạn cần đọc lại. Dưới 80% thì có thêm đề retry |
| Làm lại đề từ đầu | `làm lại đề practice test module 2` | Bỏ hết dấu tick và câu trả lời đã gõ |
| Cập nhật sau khi sync lại | `module nào cần cập nhật ghi chú?` rồi `cập nhật ghi chú module 2` | Tạo lại ghi chú của module có nội dung thay đổi |
| Khóa học tiếp theo | Sync khóa mới bằng extension, rồi `tạo ghi chú module 1 khóa <tên>` | Note khái niệm dùng chung được nối thêm, không tạo trùng |

Skill **không** tìm đáp án cho bài graded trên Coursera. Thay vào đó nó tạo đề luyện tập cùng chủ đề.

---

## 5. Học một module trong Obsidian (khoảng 45–60 phút)

Mở **`Coursera/<khóa>/M0x - …/notes/_study.md`** và làm theo checklist trong đó:

1. **Pretest** (`practice/pretest.md`, 5 phút): tick đáp án để biết mình đã nắm gì.
2. **Exam prep** (`exam-prep.md`, 10 phút): đọc phần *Phải nhớ* (⭐⭐⭐ trước) và *Dễ nhầm*.
3. **Sơ đồ tư duy** (`mindmap.canvas`): bấm vào ô có biểu tượng file để mở note khái niệm.
4. **Ví dụ thực tế** (`examples.md`): mỗi khái niệm có bản chất, ví dụ đời thường, ví dụ công việc, ví dụ trong khóa, làm sai thì sao, và đề sẽ hỏi kiểu gì.
5. **Tóm tắt** (`summary.md`): đọc khi cần chi tiết. Bấm link trích dẫn (ví dụ `04 · 02:13`) để nhảy đúng đoạn transcript gốc.
6. **Practice test** (`practice/practice-test.md`):
   - Bấm vào ô `[ ]` để tick đáp án. Câu *Điền* thì gõ sau `Trả lời::`.
   - Xong thì quay lại Claude và gõ `chấm bài practice test module X`.
   - Đạt từ 80% trở lên: đọc *Cheat sheet* cuối `exam-prep.md`, rồi làm bài graded trên Coursera.
   - Chưa đạt: làm đề `retry-01.md` mà skill vừa tạo.
7. **Flashcards**: mỗi ngày 5 phút. Bấm `Ctrl/Cmd + P`, gõ "Review flashcards" (cần plugin Spaced Repetition).

Mẹo: đáp án trong đề được **gập lại**. Muốn tự xem thì bấm vào dòng "Đáp án & giải thích".

---

## 6. Theo dõi tiến độ

Mở **`Coursera/_dashboard.base`**. Dashboard có 2 bảng:
- **Tiến độ module:** trạng thái từng module và điểm pretest, practice.
- **Kết quả luyện đề:** điểm của từng đề đã chấm.

---

## 7. Được sửa gì và không nên sửa gì

| Thư mục / file | Ai tạo | Bạn có nên sửa? |
|---|---|---|
| `raw/`, `_module.md`, `_course.md`, `_manifest.json` | Extension | **Không**. Sync lại sẽ ghi đè |
| `notes/` | Skill | Được tick, gõ đáp án, ghi thêm. Lưu ý: khi bạn yêu cầu *tạo lại / cập nhật* ghi chú module đó, các file trong `notes/` sẽ được viết lại (điểm số và trạng thái trong `_study.md` được giữ). |
| `my/` (ví dụ `my/mistakes.md`) | **Bạn** | Ghi chú riêng của bạn, skill chỉ đọc, không bao giờ ghi đè. Nên ghi lại các câu sai ở bài graded tại đây: skill sẽ dùng để tạo đề retry sát điểm yếu |
| `Coursera/_concepts/` | Skill (nối thêm qua các khóa) | Được sửa và bổ sung. Skill chỉ nối thêm vào cuối các mục |
| `Coursera/_profile.md` | Bạn | Nên điền |

---

## 8. Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| Extension báo "Mất kết nối với tab Coursera" | Mở lại hoặc F5 trang khóa học, rồi bấm Bắt đầu sync (chạy tiếp từ chỗ dừng) |
| Extension báo "Phiên đăng nhập Coursera đã hết" | Đăng nhập lại, rồi bấm Bắt đầu sync |
| Extension báo "Không ghi được vào thư mục vault" | Bấm **Chọn thư mục vault** và chọn lại `pm-course-google` |
| Một số bài báo "Bị khóa" | Bài exemplar chỉ mở sau khi bạn nộp activity trên Coursera. Nộp xong thì sync lại |
| Trong bài reading thấy `*(image)*` | Ảnh gốc chưa lấy được. Skill dựng lại các sơ đồ quan trọng (RACI, power grid…) bằng Mermaid trong `summary.md` |
| Claude không tìm thấy vault | Mở Claude bằng `cd ~/pm-course-google && claude`, hoặc nói rõ đường dẫn vault |
| Flashcard không ôn được | Cài và bật plugin Spaced Repetition |
| Dashboard trống hoặc lỗi | Cần Obsidian 1.9 trở lên (có Bases). Kiểm tra trong Settings → About |

---

## 9. Hiện có gì trong vault

- **Khóa Project Initiation:** đã sync xong 4 module.
- **Module 2** (Defining project goals, scope, and success criteria): **đã có đủ bộ ghi chú**. Bắt đầu tại `Coursera/project-initiation-google/M02 - Defining project goals, scope, and success criteria/notes/_study.md`.
- **Module 1, 3, 4:** gõ `tạo ghi chú cho module 1` (tương tự với 3 và 4) để tạo.
