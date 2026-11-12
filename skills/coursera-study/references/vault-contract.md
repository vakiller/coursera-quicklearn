# Vault contract (coursera-vault/1)

The Chrome extension writes the raw side; this skill writes the notes side. Neither touches the other's files.

```
<Vault>/Coursera/
├── _dashboard.base                 # skill — Bases dashboard (copy of assets/dashboard.base)
├── _profile.md                     # LEARNER — role/industry/projects; skill creates it from the template once, never overwrites
├── _concepts/<Concept>.md          # skill — one note per concept, shared by every course
└── <course-slug>/
    ├── _course.md, _manifest.json  # extension
    └── M01 - <Module>/
        ├── _module.md              # extension
        ├── raw/NN - <Title> (video|reading).md   # extension — source of truth, never edit
        ├── notes/                  # skill
        │   ├── _study.md  summary.md  mindmap.canvas  exam-prep.md  examples.md  flashcards.md
        │   └── practice/pretest.md  practice-test.md  retry-NN.md
        └── my/                     # LEARNER — e.g. mistakes.md; skill only reads
```

## What the skill may write
`notes/**` of the module it is working on, `Coursera/_concepts/*.md`, `Coursera/_dashboard.base`, and `Coursera/_profile.md` only if it does not exist yet. Nothing else — not `raw/`, `_module.md`, `_manifest.json`, `my/`.

## Raw files
Frontmatter: `type` (video|reading), `module`, `lesson`, `item_id`, `title`, `url`, `duration_min`, `content_hash`.
Body: transcript paragraphs `**[MM:SS]** text ^tMMSS` or reading blocks ending in `^pNN`. `*(image)*` marks a diagram the API could not provide; `📎 name.ext` marks an attached file.

## Links — always full vault paths
File names repeat across courses ("01 - Introduction (video)"), so every link uses the full path without `.md`:

```
[[Coursera/project-initiation-google/M02 - Defining project goals, scope, and success criteria/raw/04 - How to set SMART goals (video)#^t0213|04 · 02:13]]
```
`module_context.py` prints each source already in this form — copy it, add `#^tMMSS` / `#^pNN` and a short alias.

## Note frontmatter (every file the skill writes in notes/)
```yaml
---
type: study-note            # study-note | practice | concept
course: "<course-slug>"
module: 2
source_hash: "sha256:…"     # from module_context.py — lets preflight detect stale notes
generated_at: "2026-11-11"
skill_version: 1
---
```
`_study.md` additionally carries progress fields read by the dashboard: `status` (new | studying | ready | passed), `pretest_score`, `practice_score`, `last_studied`.
