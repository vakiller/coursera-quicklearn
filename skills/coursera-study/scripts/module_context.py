#!/usr/bin/env python3
"""Bundle everything Claude needs to write notes for one module.

Usage: module_context.py <vault> <course-slug> <module-number>
Prints: header (paths, source_hash, existing concepts), module description, the map of tests
(graded challenge / practice / activity) with their scope, locked items, exam-signal items, then
every raw source with its full-path wikilink and body (frontmatter stripped).
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _vault import COURSERA, frontmatter, load_manifest, module_source_hash, read, vault_link  # noqa: E402

SIGNAL_PATTERNS = [
    (re.compile(r"wrap[- ]?up|recap|summary|review:", re.I), "wrap-up"),
    (re.compile(r"^introduction|^welcome|overview", re.I), "intro"),
    (re.compile(r"glossary", re.I), "glossary"),
]


def quiz_kind(it):
    name = it["title"]
    if it.get("graded") or re.search(r"challenge|graded|exam", name, re.I):
        return "challenge"
    if re.search(r"test your knowledge|practice|quiz", name, re.I):
        return "practice"
    return "activity"


def main(argv):
    if len(argv) != 4:
        print(__doc__, file=sys.stderr)
        return 2
    vault, slug, num = argv[1], argv[2], int(argv[3])
    manifest = load_manifest(vault, slug)
    mod = next((m for m in manifest["modules"] if m["index"] == num), None)
    if mod is None:
        print(f"module {num} not found in {slug}", file=sys.stderr)
        return 1
    base = os.path.join(vault, COURSERA, slug, mod["folder"])
    folder_rel = f"{COURSERA}/{slug}/{mod['folder']}"

    sources = []  # (item, meta, body)
    for it in mod["items"]:
        if it.get("file") and it.get("status") in ("ok", "locked", "unavailable", "error"):
            p = os.path.join(base, it["file"])
            if os.path.isfile(p):
                meta, body = frontmatter(read(p))
                body = re.sub(r"^# .*\n+", "", body, count=1)
                sources.append((it, meta, body))
    lesson_of = {it["id"]: meta.get("lesson", "") for it, meta, _ in sources}

    concepts_dir = os.path.join(vault, COURSERA, "_concepts")
    concepts = sorted(f[:-3] for f in os.listdir(concepts_dir) if f.endswith(".md")) if os.path.isdir(concepts_dir) else []

    desc_path = os.path.join(base, "_module.md")
    description = ""
    if os.path.isfile(desc_path):
        _, mbody = frontmatter(read(desc_path))
        paras = [p.strip() for p in mbody.split("\n\n") if p.strip() and not p.startswith("#")]
        description = paras[0] if paras else ""

    out = [
        "# MODULE CONTEXT",
        f"course_slug: {slug}",
        f"course_title: {manifest['course']['title']}",
        f"module: {num}",
        f"module_title: {mod['title']}",
        f"folder: {folder_rel}",
        f"notes_dir: {folder_rel}/notes",
        f"source_hash: {module_source_hash(mod)}",
        f"existing_concepts: {', '.join(concepts) if concepts else '(none)'}",
        "",
        "## Module description",
        description or "(none)",
        "",
        "## Tests in this module (quiz contents are never fetched)",
    ]
    last_lesson = ""
    for it in mod["items"]:
        if it["id"] in lesson_of:
            last_lesson = lesson_of[it["id"]]
        if it["type"] != "quiz":
            continue
        kind = quiz_kind(it)
        if kind == "challenge":
            out.append(f"- {it['title']} — graded challenge — scope: whole module")
        elif kind == "practice":
            covered = [s[0]["title"] for s in sources if s[1].get("lesson") == last_lesson]
            out.append(f'- {it["title"]} — practice — scope: lesson "{last_lesson}" ({", ".join(covered)})')
        else:
            out.append(f"- {it['title']} — activity (not a test)")

    gaps = [it for it in mod["items"] if it["type"] in ("video", "reading") and it.get("status") != "ok"]
    out += ["", "## Locked / unavailable items (do not invent their content)"]
    out += [f"- {it['title']} ({it['type']}) — {it['status']}" for it in gaps] or ["- (none)"]

    out += ["", "## Exam-signal items"]
    signals = []
    for it, _, _ in sources:
        for rx, tag in SIGNAL_PATTERNS:
            if rx.search(it["title"]):
                signals.append(f"- {it['title']} ({it['type']}) — {tag}")
                break
    out += signals or ["- (none)"]

    out += ["", "## Sources", ""]
    for it, meta, body in sources:
        link = vault_link(slug, mod["folder"], it["file"])
        out.append(f"=== SOURCE: [[{link}]] · {it['type']} · lesson: {meta.get('lesson', '')}")
        out.append(body.rstrip())
        out.append("")
    print("\n".join(out))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
