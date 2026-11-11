---
name: coursera-study
description: Turn Coursera course content synced into an Obsidian vault (Coursera/course-slug/M01…/raw transcripts and readings) into Obsidian-native study material — summary, Canvas mind map, exam-prep "must remember to pass the test" note, real-world examples, tick-box practice tests, Spaced Repetition flashcards — and grade practice tests the learner ticked in Obsidian. Use this whenever the user wants to study, summarise, review, make notes, mind maps, flashcards or practice questions for a Coursera course/module/week in their vault, wants to "học nhanh", "tóm tắt module", "tạo sơ đồ tư duy", "ôn thi", "làm đề luyện tập", "chấm bài", or mentions /coursera-study, even if they don't say "skill". Also use it to check which modules have stale notes after a new sync. Do not use it to answer graded Coursera quizzes.
---

# Coursera study notes in Obsidian

The learner is a busy working adult. Instead of watching every video, they study a module in ~45–60 minutes from notes this skill writes into their Obsidian vault, check themselves with practice tests, then take the graded quiz on Coursera themselves. Everything must render and be usable **inside Obsidian** — no web pages, no HTML.

A Chrome extension has already synced the course into the vault (raw transcripts and readings). This skill only reads that raw side and writes the notes side. Read `references/vault-contract.md` once per session — it defines paths, ownership and the full-path link rule.

Scripts live in `scripts/` inside this skill's base directory (Python 3 stdlib, no installs). Run them with `python3 "<skill-dir>/scripts/<name>.py" …`.

Write explanations in **Vietnamese**, keep the course's **English terms and definitions verbatim** (the graded quiz uses those words).

## Commands the user may give
- *Set up / check*: "kiểm tra vault", `/coursera-study setup` → step 1 only.
- *Make notes*: "tạo ghi chú cho module 2", `/coursera-study <course> [module]` → steps 1–6.
- *Grade*: "chấm bài", `/coursera-study grade <file>` → see Grading.
- *Retake*: "làm lại đề" → `grade.py <file> --reset`.

If the user asks you to answer or fetch a real **graded Coursera quiz**, decline briefly (it breaks Coursera's Honor Code and the learner's goal) and offer a practice test on the same topic instead.

## Workflow: make notes for a module

**1. Preflight.** Find the vault (the folder that contains `.obsidian/` and `Coursera/`; ask if unclear) and run `preflight.py <vault>`. Show the learner a short status table in Vietnamese. For anything missing, give one-line install hints and keep going in degraded mode:
- Spaced Repetition missing → still write `flashcards.md`; say review won't work until it is installed (Settings → Community plugins → Browse → "Spaced Repetition").
- Canvas/Bases core plugin off → Settings → Core plugins.
- Local REST API / Obsidian MCP missing → fine; write files directly. (If an Obsidian MCP tool is available in this session, you may use it to open `_study.md` at the end.)
- `Coursera/_profile.md` missing → copy `assets/_profile.md` there and ask the learner to fill it in; continue with generic examples.
- `Coursera/_dashboard.base` missing → copy `assets/dashboard.base` there.
- No course found → tell them to run the extension's Sync first, and stop.

**2. Pick scope.** Default to modules whose `notes_status` is `missing` or `stale`; confirm with the learner if several qualify. One module per pass — quality drops when modules are mixed.

**3. Read the module.** Run `module_context.py <vault> <course-slug> <module-number>` and read the whole output. It gives the full-path link for every source, the module description, the test map (graded challenge / practice + scope / activities), locked items, exam-signal items, existing concept notes and the `source_hash` to stamp on every note. If the output is very long, save it to a temp file and read it in parts — but read all of it before writing: the exam-prep depends on seeing every source.

**4. Write the notes** into `<module>/notes/` in this order (later notes reuse earlier analysis):
1. `exam-prep.md` — follow `references/exam-prep-guide.md`. This is the backbone: objectives, ⭐ ranking, must-know, confusable pairs, traps, cheat sheet.
2. `summary.md` — a Mermaid `mindmap` first, then one section per lesson: key points as short bullets, each ending with a full-path source link (`[[…#^t0213|04 · 02:13]]`). Rebuild missing diagrams (`*(image)*`) in Mermaid/tables where the text describes them, marked "(dựng lại từ nội dung bài)". Aim for ~10 minutes of reading.
3. `mindmap.canvas` — write an outline (see `references/obsidian-formats.md`), run `build_canvas.py outline.md "<notes>/mindmap.canvas"`. Link leaves to concept notes you create in step 6.
4. `examples.md` — follow `references/examples-guide.md`, using `_profile.md`.
5. `flashcards.md` — deck tag + one card per must-know item and per confusable pair (`references/obsidian-formats.md`).
6. `Coursera/_concepts/<Concept>.md` for each ⭐⭐⭐ concept: create (frontmatter `type: concept`, `aliases`, tag `#concept`; sections `## Định nghĩa` with the course wording + Vietnamese, `## Ví dụ`, `## Xuất hiện ở` with a link to this module's `exam-prep`) or, if it exists, append to `## Ví dụ` / `## Xuất hiện ở` without rewriting the rest.
7. `practice/pretest.md` and `practice/practice-test.md` — follow `references/practice-test-guide.md` exactly; `grade.py` parses that format.
8. `_study.md` — fill `assets/_study.md`: the study path, the tests on Coursera (links from `_module.md`), activities, locked items.

Every note gets the frontmatter from the vault contract with the module's `source_hash`. Write only inside `notes/`, `_concepts/`, `_dashboard.base` and (first time) `_profile.md`.

**5. Validate.** Run `validate.py <vault> "<module>/notes" "Coursera/_concepts"`. Fix every error (usually a link typo or a missing block id — re-check the id in `module_context` output; never invent ids) and run it again until `ok: true`.

**6. Hand over.** In Vietnamese, ≤ 10 lines: what was created, where to start (`_study.md`), plugin gaps, and one line on what makes the examples better (`_profile.md`) if it was empty.

## Grading
1. Run `grade.py "<practice file>"`.
2. Judge the `needs_judgement` fill-ins by meaning.
3. Write the result into the file and `_study.md`, and create a `retry-NN.md` when the score is below 80% — details in `references/practice-test-guide.md` → Grading workflow.
4. Reply with the score, the weak concepts and the 2–3 source paragraphs to re-read.

## Stale notes after a new sync
`preflight.py` marks a module `stale` when the raw content changed. Regenerate that module's notes (keeping `practice_score`/`status` from the old `_study.md` frontmatter, and leaving graded practice files' results in place), then validate.

## Quality checklist (before handing over)
- Every claim about the course cites a raw paragraph with a full-path link; nothing is invented about locked items.
- Definitions are the course's English words; Vietnamese explains.
- exam-prep has all 6 sections; practice-test covers every objective, ≥ 50% scenario questions, each with an answer key and explanation of every option.
- validate.py is clean.
