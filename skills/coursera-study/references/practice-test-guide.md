# Practice tests — authoring and grading

Practice tests let the learner find gaps *before* the graded Module Challenge on Coursera. They mimic Coursera's style but are written from the module's raw sources. Never fetch or reproduce real Coursera quiz questions, and never help answer a graded Coursera quiz — offer to quiz the learner on the topic instead.

## Files
| File | When | Questions |
|---|---|---|
| `practice/pretest.md` | before studying — diagnostic | 5 |
| `practice/practice-test.md` | after studying — simulates the Module Challenge | 10–15 |
| `practice/retry-NN.md` | after grading — weak objectives only, new scenarios | 5–8 |

## Blueprint (practice-test)
- Cover every objective from exam-prep §1 with ≥ 2 questions; weight ⭐⭐⭐ concepts.
- Mix ≈ 30% definition/recognition, 50% **scenario** ("You are the PM of …; what should you do first?"), 20% multi-select / "which is NOT" / ordering.
- Distractors come from genuinely confusable pairs (goal vs deliverable, scope vs scope creep, stakeholder vs team member) or from plausible-but-not-first actions. No joke options.
- Use the course's English terms in questions; Vietnamese explanations are fine.

## Exact question format (grade.py and validate.py parse this)
```markdown
### Câu 3 *(Chọn 1)* · Objective: Define project scope
Bạn là PM của dự án … Việc nào nên làm **đầu tiên**?
- [ ] A. …
- [ ] B. …
- [ ] C. …
- [ ] D. …

> [!success]- Đáp án & giải thích
> **Đáp án:** B
> **Vì sao B đúng:** …
> **Vì sao A/C/D sai:** A — …; C — …; D — …
> Nguồn: [[full/path/raw/…#^t0213|04 · 02:13]]
```
- Kinds: `(Chọn 1)`, `(Chọn nhiều)`, `(Đúng/Sai)` (options `A. Đúng`, `B. Sai`), `(Điền)`, `(Sắp xếp)`.
- Choice options are tick boxes in a plain list — **not inside a callout** (boxes inside callouts are unreliable to click).
- `(Điền)` and `(Sắp xếp)` have a line `Trả lời:: ` (with a trailing space) right after the question; ordering answers are numbers like `3,1,2,4` referring to a numbered list in the question.
- The answer key line is exactly `> **Đáp án:** <letters | text | numbers>` as the first line inside the folded callout.
- Number questions 1..N; one blank line between blocks.
- Frontmatter: `type: practice`, `course`, `module`, `kind: pretest|practice-test|retry`, `source_hash`, `generated_at`, `skill_version`.

At the top of the file, after frontmatter: one short instruction line — "Tick đáp án (bấm vào ô), câu Điền thì gõ sau `Trả lời::`. Xong thì chạy `/coursera-study grade` với file này."

## Grading workflow
1. `python3 scripts/grade.py "<file>"` → JSON. Choice and ordering are graded; fill-ins with an exact match too.
2. Judge each `needs_judgement` fill-in by meaning (synonyms, small typos OK; a different concept is wrong). Explain briefly.
3. Write results into the file:
   - frontmatter: `score: "8/10"`, `score_pct: 80`, `graded_at`, `weak_objectives: [...]`
   - right after the instruction line, a callout `> [!abstract] Kết quả: 8/10 (80%)` listing each wrong question → the concept → a link to the source paragraph to re-read.
4. Update `_study.md` frontmatter (`practice_score` or `pretest_score`, `last_studied`, `status`).
5. ≥ 80% on practice-test → tell the learner they are ready, point to the cheat sheet, link the Module Challenge on Coursera. Otherwise create the next `retry-NN.md` on the weak objectives (new scenarios, never the same wording) and say which sources to re-read.
6. `grade.py "<file>" --reset` clears ticks and typed answers when the learner wants to retake it (leave results in frontmatter unless asked).
