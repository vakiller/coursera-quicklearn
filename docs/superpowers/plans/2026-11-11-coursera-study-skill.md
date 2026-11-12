# Skill `coursera-study` — Plan (Plan B)

> Built with the official **skill-creator** process (Anthropic): capture intent → draft SKILL.md → test cases in `evals/` → parallel runs with/without skill → grading + benchmark + `eval-viewer/generate_review.py` for human review → iterate → description optimisation → package.

**Goal:** A Claude skill that turns the raw Coursera files in an Obsidian vault into Obsidian-native study material — summary, Canvas mind map, exam-prep, real-world examples, practice tests (tick-box), flashcards — and grades the practice tests the learner ticks in Obsidian.

**Spec:** `docs/specs/2026-11-11-coursera-to-vault-design.md` §5 (5.1–5.8). This plan only records what differs from or adds to the spec.

**Input in practice:** vault `/Users/aiden/pm-course-google`, course `Coursera/project-initiation-google` (4 modules, 34 videos + 27 readings ≈ 43k words, 16 quiz items listed but not fetched).

---

## 1. Findings from the real sync (drive the design)

| Finding | Consequence for the skill |
|---|---|
| ~10–15k words per module | One module fits in context: read all raw files of a module in one go; no chunking needed. |
| Quiz items in the outline mix **graded "Module N Challenge"**, **practice "Test your knowledge"**, and **Activity/Reflection** (also typed `quiz`) | Spec 5.5 rule "scope = items since previous quiz" is wrong. New rule: *Module Challenge* → whole module; *Test your knowledge* → the lesson it sits in (raw frontmatter `lesson`); Activity/Reflection → not a test, list as hands-on tasks in `_study.md`. |
| Learning objectives unavailable; module `description` + "Introduction"/"Wrap-up" videos exist | Exam signals = description + intro/wrap-up videos + glossary + emphasis phrases. |
| Course glossary is a Google Doc link, not inline | Skill builds its own glossary from raw; optionally fetches the public Google Doc template link if reachable (mark as supplementary). |
| Images are `*(image)*` placeholders (e.g. RACI chart, power grid) | Skill reconstructs key visuals in Mermaid (`quadrantChart` for power/interest grid, Markdown table for RACI) from the surrounding text. Separate extension task: resolve image URLs (see §6). |
| Vault has **no community plugins** yet; core **Canvas** and **Bases** are enabled | Preflight will report missing plugins. **Proposal: use core Bases (`.base`) for the dashboard instead of Dataview** → only community plugin required = Spaced Repetition (+ Local REST API if MCP is wanted). Needs user OK. |
| Some items `locked` (exemplars not submitted, "Course wrap-up") | Skill notes gaps in `_study.md`; never invents their content. |

## 2. Skill layout (developed in this repo, installed by symlink)

```
skills/coursera-study/                 # in repo → symlinked to ~/.claude/skills/coursera-study
├── SKILL.md                           # workflow + routing (<500 lines)
├── references/
│   ├── vault-contract.md              # A↔B contract: paths, frontmatter, ownership (from spec §3)
│   ├── obsidian-formats.md            # callouts, Mermaid types, Canvas JSON, SR flashcards, Bases, block refs — with examples
│   ├── exam-prep-guide.md             # how to find exam signals, 6-section exam-prep template, ⭐ rules
│   ├── examples-guide.md              # 6-part example block, quality bar, using _profile.md
│   └── practice-test-guide.md         # blueprint (30/50/20), question/answer-key format, distractor rules, retry
├── scripts/
│   ├── preflight.py                   # vault check → status table (JSON + text); never installs anything
│   ├── module_context.py              # dump a module: _module.md + all raw files + quiz map → one text bundle
│   ├── build_canvas.py                # nested-list outline (MD) → mindmap.canvas (radial layout, file nodes to _concepts)
│   ├── validate.py                    # canvas JSON + file nodes, wikilinks + #^blockrefs resolve, Mermaid fence sanity, SR syntax
│   └── grade.py                       # parse practice file: ticked boxes + "Trả lời::" vs answer key → JSON (MC graded; fill-ins left for Claude)
└── assets/
    ├── _study.md, _profile.md         # templates
    ├── dashboard.base                 # Bases dashboard (or dashboard-dataview.md if user prefers Dataview)
    └── question-template.md
```

Why scripts: layout of Canvas, checkbox parsing and link validation are deterministic and error-prone for a model; scripts make every run identical and cheap. Claude does the judgement work (what matters, examples, questions, semantic grading of fill-ins).

**Python stdlib only** (no installs). All scripts take the vault path as an argument and print JSON.

## 3. Behaviour (SKILL.md workflow)

1. **Preflight** (`preflight.py <vault>`): vault + manifest present; Obsidian MCP reachable?; plugins: Spaced Repetition, Local REST API, (Dataview if chosen); core Canvas/Bases enabled. Print table; missing items → install instructions; continue in degraded mode. `_profile.md` missing → create from template and ask the learner to fill it (continue with generic examples).
2. **Pick scope:** course + module(s). Default: modules whose notes are missing or stale (`source_hashes` ≠ manifest hashes).
3. **Read** `module_context.py` bundle.
4. **Generate** into `M../notes/` (only there + `_concepts/` + `_dashboard`): `summary.md` (Mermaid mindmap on top), outline → `build_canvas.py` → `mindmap.canvas`, `exam-prep.md`, `examples.md`, `flashcards.md`, `practice/pretest.md`, `practice/practice-test.md`, `_study.md`; create/append `_concepts/<Concept>.md`.
   - All citations use **full vault paths**: `[[Coursera/<slug>/<Mxx - …>/raw/<NN - Title (video)>#^t0215]]`.
   - Frontmatter of every note: `source_hashes`, `generated_at`, `skill_version`.
5. **Validate** (`validate.py`), fix, re-validate.
6. **Open** `_study.md` via Obsidian MCP if connected.
7. **Grade** (`/coursera-study grade <file>`): `grade.py` → Claude grades fill-ins semantically → writes `score`, `weak_objectives` into frontmatter, adds a result callout at top, creates `retry-NN.md`, points to source paragraphs. `--reset` unticks everything.

Writing language: Vietnamese explanations, English course terms kept verbatim (spec 5.6).

## 4. Practice-test file format (contract between Claude and `grade.py`)

```markdown
### Câu 3 *(Chọn 1)* · Objective: <text>
<stem>
- [ ] A. …
- [ ] B. …
- [ ] C. …
- [ ] D. …

> [!success]- Đáp án & giải thích
> **Đáp án:** B
> …giải thích từng phương án… · Nguồn: [[…#^t0215]]

### Câu 7 *(Điền)* · Objective: <text>
<stem>
Trả lời:: 
> [!success]- Đáp án & giải thích
> **Đáp án:** Scope creep
```
Question kinds: `(Chọn 1)`, `(Chọn nhiều)`, `(Đúng/Sai)`, `(Điền)`, `(Sắp xếp)`. `grade.py` keys on the `### Câu N *(kind)*` header and the `**Đáp án:**` line.

## 5. Skill-creator steps (what will actually run)

| Step | Work | Output |
|---|---|---|
| S1 Capture intent | From this conversation + spec; confirm open decisions (§7) | — |
| S2 Draft | SKILL.md + references + scripts + assets. Scripts are TDD'd with `python -m unittest` on fixtures cut from the real vault | `skills/coursera-study/` |
| S3 Test cases (`evals/`, schema from skill-creator `references/schemas.md`) | **(a) build-module-notes**: "Tạo bộ ghi chú học cho Module 2" on a copy of the real course · **(b) grade-practice-test**: practice-test.md with pre-ticked answers (2 wrong, 1 fill-in near-synonym) · **(c) preflight-missing-plugins**: vault without plugins/MCP · **(d) stale-update**: one raw file changed → only that module regenerated | case folders with `prompt.md`, `case.yaml`, `files/` |
| S4 Run | For each case: with-skill + without-skill subagents in parallel, outputs to `coursera-study-workspace/iteration-1/` | outputs, timing.json |
| S5 Assertions (while runs go) | e.g. all 9 note files exist; `mindmap.canvas` valid + file nodes resolve; every wikilink/blockref resolves; practice-test ≥10 questions, each has answer key + citation; ~30/50/20 mix; flashcards in SR syntax; exam-prep has 6 sections; nothing written outside notes/_concepts; grade score correct (b); preflight lists Spaced Repetition missing (c); untouched modules not rewritten (d) | `graders/`, grading.json |
| S6 Review | `aggregate_benchmark` + analyst notes + **`eval-viewer/generate_review.py`** → user reviews outputs in browser, leaves feedback | benchmark.md, feedback.json |
| S7 Iterate | Improve from feedback, iteration-2 with `--previous-workspace` | — |
| S8 Description optimisation | 20 trigger queries (VN + EN, near-misses like "tóm tắt video YouTube", "làm quiz Coursera giúp tôi") → `run_loop` | best description |
| S9 Install | symlink to `~/.claude/skills/coursera-study`; real run on Module 3 in the user's vault | — |

Note: case (b) also checks the skill refuses to answer **graded Coursera quizzes** if asked (anti-goal).

## 6. Follow-up for the extension (separate, small)

- Resolve CML `img assetId` to a real URL (probe `api/assets.v2`-style endpoint while logged in) so readings keep their diagrams; add to allowlist only after probing.
- Deferred minors from the review (module duration, `$&` in bold text, …).

## 7. Decisions needed from the user

1. **Dashboard: core Bases (recommended, already enabled, no plugin) or Dataview?**
2. **Skill home: repo `skills/coursera-study` + symlink (recommended, versioned in git) or directly in `~/.claude/skills`?**
3. Obsidian MCP now (install Local REST API plugin + `mcp-obsidian`) or after the skill works with direct file writes (recommended: after).
