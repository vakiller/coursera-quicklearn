# Coursera → Obsidian Study Kit

> Study Coursera courses faster inside Obsidian. A Chrome extension pulls transcripts and readings into your vault, and a Claude Code skill turns them into a complete set of exam-prep notes.

Working adults rarely have time to watch every video. To earn a Coursera certificate you only need to **pass the graded assignments**; watching every video is not required. This project helps you study a module in **about 45–60 minutes** from notes, check yourself with practice tests, and then take the graded quiz on Coursera yourself.

```
Coursera ──(Chrome extension, no AI)──▶ Obsidian vault: Coursera/<course>/M0x/raw/
                                                │
                                                ▼
Claude Code + coursera-study skill ──▶ notes/: summary, mind map, exam prep, practice tests, flashcards
```

The two parts are fully decoupled. They share nothing except the **folder layout inside the vault** (the [vault contract](skills/coursera-study/references/vault-contract.md)).

## Features

### 🧩 Chrome extension: Coursera Vault Sync
- **One-click course sync:** module → lesson → video transcripts and readings, saved as Markdown.
- **Writes straight into your vault** through the File System Access API, or downloads a ZIP instead.
- **Re-syncs only what changed** (content hashes), and never touches your own notes.
- **Resumes where it stopped** if your session expires or the tab gets closed.
- **Every paragraph is linkable:** transcript paragraphs carry timestamp block ids (`^t0213`), reading paragraphs carry their own ids (`^p04`).
- **Account-safe:** waits between requests (700 ms by default) and **never opens quizzes, exams or assignments**. For assessments it records only their name and type.

### 🧠 Claude Code skill: `coursera-study`
From a module's raw content, the skill writes into `notes/`:

| File | Contents |
|---|---|
| `_study.md` | Main study page: step-by-step path, links to the module's Coursera tests, progress |
| `exam-prep.md` | Learning objectives, ⭐ importance ranking, must-know points, easily confused pairs, traps, cheat sheet |
| `summary.md` | A Mermaid mind map plus a per-lesson summary. Every point links back to the exact source paragraph |
| `mindmap.canvas` | Obsidian Canvas mind map. Click a node to open its concept note |
| `examples.md` | Everyday examples and examples tailored to your job (based on `_profile.md`) |
| `flashcards.md` | Cards for the Spaced Repetition plugin |
| `practice/*.md` | Pretest and practice test with tick boxes you answer right inside Obsidian |

The skill can also:
- **Grade the tests you ticked**, point out weak concepts and the passages to re-read. Below 80%, it writes a retry test.
- **Maintain shared concept notes** (`Coursera/_concepts/`) across courses. It appends to existing notes instead of creating duplicates.
- **Detect stale notes** after a re-sync.
- **Track progress** in an Obsidian Bases dashboard.

> [!NOTE]
> Explanations in the generated notes are written in **Vietnamese**, while terms and definitions stay in the course's original English, because the graded quizzes use that exact wording. To use another language, change the language rule in [`SKILL.md`](skills/coursera-study/SKILL.md).

> [!IMPORTANT]
> The skill does **not** answer graded Coursera quizzes, because that breaks the Coursera Honor Code. If asked, it declines and offers a practice test on the same topic instead.

## Requirements

- Google Chrome (or another Chromium browser that supports the File System Access API)
- Node.js 20+ to build the extension
- [Obsidian](https://obsidian.md) 1.9+ (Bases is needed for the dashboard) and the **Spaced Repetition** community plugin
- [Claude Code](https://claude.com/claude-code) and Python 3 (the scripts use only the standard library, so there is nothing to install)

## Installation

### 1. Build and load the extension

```bash
git clone <repo-url> coursera-obsidian
cd coursera-obsidian/extension
npm install
npm run build        # output: extension/.output/chrome-mv3
```

Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and select `extension/.output/chrome-mv3`.

### 2. Install the skill for Claude Code

Symlink the skill so it always matches the code in the repo:

```bash
mkdir -p ~/.claude/skills
ln -s "$(pwd)/../skills/coursera-study" ~/.claude/skills/coursera-study
```

To check, type `/coursera-study` in Claude Code. If the command shows up in the list, the skill is installed.

### 3. Prepare Obsidian

- Enable the **Spaced Repetition** community plugin.
- Make sure the **Canvas** and **Bases** core plugins are on (Settings → Core plugins).

## Usage

### Step 1: Sync a course into your vault

> The extension's interface is currently in Vietnamese. The English meaning of each button is given in brackets below.

1. Sign in to Coursera and open the course page (for example `coursera.org/learn/<course-slug>/home/module/1`).
2. Click the extension icon and choose **Sync course**.
3. First time only: click **Chọn thư mục vault** [Choose vault folder] and select your Obsidian vault.
4. Pick the transcript language (English is recommended), click **Bắt đầu sync** [Start sync] and **keep the Coursera tab open** until it finishes.

Result:

```
<Vault>/Coursera/<course-slug>/
├── _course.md, _manifest.json
└── M01 - <Module>/
    ├── _module.md
    └── raw/
        ├── 01 - <Title> (video).md
        └── 02 - <Title> (reading).md
```

### Step 2: Generate notes with Claude Code

Start Claude Code **inside your vault**. The skill finds the vault from the current folder:

```bash
cd ~/path/to/vault
claude
```

Then just ask in plain language (English or Vietnamese both work):

| You want to | Type |
|---|---|
| Check the vault and plugins (writes nothing) | `check my vault` or `/coursera-study setup` |
| Generate notes for a module | `make notes for module 3` |
| Grade a test you took | `grade the module 2 practice test` |
| Retake a test from scratch | `reset the module 2 practice test` |
| Refresh notes after a re-sync | `which modules need their notes updated?` |

On the first run the skill creates `Coursera/_profile.md`. Fill in your role, industry and the kind of projects you work on so the examples match your actual job.

### Step 3: Study in Obsidian

Open `Coursera/<course>/M0x - …/notes/_study.md` and follow the checklist:

1. **Pretest** (5 min): tick your answers to see what you already know.
2. **Exam prep** (10 min): read the must-know points (⭐⭐⭐ first) and the easily confused pairs.
3. **Mind map, examples, summary:** dig in when you need detail. Citation links jump to the exact source paragraph.
4. **Practice test:** tick your answers, then go back to Claude and ask it to grade the test. A score of 80% or more means you are ready for the graded quiz.
5. **Flashcards:** 5 minutes a day (`Cmd/Ctrl + P` → *Review flashcards*).

Track every module's progress in `Coursera/_dashboard.base`.

A detailed guide with troubleshooting (in Vietnamese) is in [docs/HUONG-DAN-SU-DUNG.md](docs/HUONG-DAN-SU-DUNG.md).

## Who writes what

| Path | Created by | Should you edit it? |
|---|---|---|
| `raw/`, `_module.md`, `_course.md`, `_manifest.json` | Extension | No. A re-sync overwrites them |
| `notes/` | Skill | Yes, tick answers and add notes. Files are rewritten when you ask the skill to regenerate notes for that module (scores and status are kept) |
| `my/` | You | Your private notes. The skill only reads them, for example `my/mistakes.md` to target retry tests at your weak spots |
| `Coursera/_concepts/` | Skill | Yes. The skill only appends to the end of sections |
| `Coursera/_profile.md` | You | Recommended |

## Repository layout

```
.
├── extension/               # Chrome extension (WXT + TypeScript, Manifest V3)
│   ├── entrypoints/         # popup, sync page, content script
│   ├── src/
│   │   ├── coursera/        # client and parsers for Coursera's internal API
│   │   ├── convert/         # VTT → transcript, CML → Markdown
│   │   ├── sync/            # sync orchestration, resume state
│   │   └── vault/           # file naming, rendering, manifest, file/ZIP writers
│   └── test/                # Vitest + fixtures
├── skills/coursera-study/   # Claude Code skill
│   ├── SKILL.md             # the skill's workflow
│   ├── references/          # guides for exam prep, examples, tests, Obsidian formats
│   ├── scripts/             # preflight, module_context, build_canvas, validate, grade
│   ├── assets/              # _study, _profile and dashboard.base templates
│   └── evals/               # skill evaluation cases
└── docs/                    # design spec, API notes, user guide
```

## Development

```bash
cd extension
npm run dev          # WXT dev mode with auto-reload
npm test             # Vitest
npm run typecheck
npm run build
```

The skill's scripts are plain Python 3 and can be run directly:

```bash
python3 skills/coursera-study/scripts/preflight.py <vault>
python3 skills/coursera-study/scripts/module_context.py <vault> <course-slug> <module-number>
python3 skills/coursera-study/scripts/validate.py <vault> "<module>/notes" "Coursera/_concepts"
python3 skills/coursera-study/scripts/grade.py "<practice-file>" [--reset]
```

## Limitations

- Chrome and Chromium browsers only.
- Some images in readings are not available through the API and show up as `*(image)*`. When the text describes them well enough, the skill rebuilds the important diagrams in Mermaid.
- "Exemplar" readings unlock only after you submit the related activity on Coursera. Submit it, then sync again to fetch them.
- The extension relies on Coursera's internal, undocumented API, so it may break when Coursera changes it.

## Responsible use

This project is for **personal study**. Course content belongs to Coursera and its content partners. Do not redistribute your vault or any synced content. Complete graded assessments yourself, as the Coursera Honor Code requires.

This project is not affiliated with or endorsed by Coursera, Obsidian or Anthropic.
