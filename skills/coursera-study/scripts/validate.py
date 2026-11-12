#!/usr/bin/env python3
"""Validate generated notes before the learner opens them in Obsidian.

Usage: validate.py <vault> <file-or-dir> [...]
Checks: every [[wikilink]] / ![[embed]] resolves (file, #heading, #^block) and is not ambiguous;
Mermaid fences start with a known diagram type; .canvas files are valid JSON with existing file
nodes and edges between existing nodes; practice tests follow the question contract;
flashcards.md contains Spaced Repetition cards. Prints JSON {ok, errors[]}; exit 1 on errors.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from grade import HEADER, KEY, OPTION  # noqa: E402

LINK = re.compile(r"!?\[\[([^\]]+?)\]\]")
FENCE = re.compile(r"^(```|~~~)\s*(\S*)")
MERMAID_TYPES = {
    "flowchart", "graph", "mindmap", "timeline", "quadrantChart", "sequenceDiagram", "pie", "gantt",
    "classDiagram", "stateDiagram", "stateDiagram-v2", "erDiagram", "journey", "xychart-beta", "block-beta", "sankey-beta",
}
CHOICE = {"Chọn 1", "Chọn nhiều", "Đúng/Sai"}


class Vault:
    def __init__(self, root):
        self.root = os.path.abspath(root)
        self.files = []
        for d, dirs, fs in os.walk(self.root):
            dirs[:] = [x for x in dirs if not x.startswith(".")]
            for f in fs:
                self.files.append(os.path.relpath(os.path.join(d, f), self.root).replace(os.sep, "/"))
        self._cache = {}

    def resolve(self, target):
        """Return (relpath or None, error or None) the way Obsidian resolves a link target."""
        stripped = [f[:-3] if f.endswith(".md") else f for f in self.files]
        exact = [f for f, s in zip(self.files, stripped) if s == target or f == target]
        if exact:
            return exact[0], None
        hits = [f for f, s in zip(self.files, stripped) if s.endswith("/" + target) or f.endswith("/" + target)]
        if len(hits) == 1:
            return hits[0], None
        if len(hits) > 1:
            return None, f"ambiguous link [[{target}]] matches {len(hits)} files — use the full vault path"
        return None, f"link target not found: [[{target}]]"

    def text(self, rel):
        if rel not in self._cache:
            with open(os.path.join(self.root, rel), encoding="utf-8") as f:
                self._cache[rel] = f.read()
        return self._cache[rel]


def heading_exists(text, heading):
    want = re.sub(r"\s+", " ", heading).strip().lower()
    return any(re.sub(r"\s+", " ", m.group(1)).strip().lower() == want for m in re.finditer(r"^#{1,6}\s+(.*)$", text, re.M))


def check_markdown(v, rel, errors):
    text = v.text(rel)
    in_fence, fence_lang, first_in_fence = False, "", False
    for no, line in enumerate(text.splitlines(), 1):
        f = FENCE.match(line)
        if f:
            if not in_fence:
                in_fence, fence_lang, first_in_fence = True, f.group(2), True
            else:
                in_fence = False
            continue
        if in_fence:
            if fence_lang == "mermaid" and first_in_fence and line.strip():
                kind = line.strip().split()[0]
                if kind not in MERMAID_TYPES:
                    errors.append({"file": rel, "line": no, "message": f"unknown mermaid diagram type '{kind}'"})
                first_in_fence = False
            continue
        for m in LINK.finditer(line):
            inner = m.group(1).split("|", 1)[0]
            target, _, sub = inner.partition("#")
            target = target.strip()
            if target:
                dest, err = v.resolve(target)
                if err:
                    errors.append({"file": rel, "line": no, "message": err})
                    continue
            else:
                dest = rel
            if sub and dest.endswith(".md"):
                body = v.text(dest)
                if sub.startswith("^"):
                    if not re.search(r"\^" + re.escape(sub[1:]) + r"\s*$", body, re.M):
                        errors.append({"file": rel, "line": no, "message": f"block id #{sub} not found in {dest}"})
                elif not heading_exists(body, sub):
                    errors.append({"file": rel, "line": no, "message": f"heading '#{sub}' not found in {dest}"})


def check_practice(rel, text, errors):
    blocks, cur = [], None
    for no, line in enumerate(text.splitlines(), 1):
        h = HEADER.match(line)
        if h:
            cur = {"n": h.group(1), "kind": h.group(2), "line": no, "options": 0, "key": False, "answer_line": False}
            blocks.append(cur)
        elif cur:
            if OPTION.match(line):
                cur["options"] += 1
            if KEY.match(line):
                cur["key"] = True
            if line.startswith("Trả lời::"):
                cur["answer_line"] = True
    if not blocks:
        errors.append({"file": rel, "line": 1, "message": "practice file has no '### Câu N *(kind)*' questions"})
    for b in blocks:
        where = f"Câu {b['n']}"
        if not b["key"]:
            errors.append({"file": rel, "line": b["line"], "message": f"{where}: missing '> **Đáp án:**' answer key"})
        if b["kind"] in CHOICE and b["options"] < 2:
            errors.append({"file": rel, "line": b["line"], "message": f"{where}: choice question needs at least 2 '- [ ] A.' options"})
        if b["kind"] not in CHOICE and not b["answer_line"]:
            errors.append({"file": rel, "line": b["line"], "message": f"{where}: missing 'Trả lời:: ' line"})


def check_flashcards(rel, text, errors):
    lines = [l for l in text.splitlines() if not l.startswith(">")]
    if not any("::" in l or re.search(r"==[^=]+==", l) for l in lines):
        errors.append({"file": rel, "line": 1, "message": "no Spaced Repetition cards (Q::A, Q:::A or ==cloze==) found"})


def check_canvas(v, rel, errors):
    try:
        data = json.loads(v.text(rel))
    except ValueError as e:
        errors.append({"file": rel, "line": 1, "message": f"invalid canvas JSON: {e}"})
        return
    ids = set()
    for n in data.get("nodes", []):
        if n.get("id") in ids:
            errors.append({"file": rel, "line": 1, "message": f"duplicate node id {n.get('id')}"})
        ids.add(n.get("id"))
        if n.get("type") == "file" and n.get("file") not in v.files:
            errors.append({"file": rel, "line": 1, "message": f"file node points to missing file {n.get('file')}"})
    for e in data.get("edges", []):
        for end in ("fromNode", "toNode"):
            if e.get(end) not in ids:
                errors.append({"file": rel, "line": 1, "message": f"edge {e.get('id')} references unknown node {e.get(end)}"})


def main(argv):
    if len(argv) < 3:
        print(__doc__, file=sys.stderr)
        return 2
    v = Vault(argv[1])
    targets = []
    for p in argv[2:]:
        p = os.path.abspath(p if os.path.isabs(p) else os.path.join(v.root, p)) if not os.path.exists(p) else os.path.abspath(p)
        if os.path.isdir(p):
            for d, _, fs in os.walk(p):
                targets += [os.path.join(d, f) for f in sorted(fs) if f.endswith((".md", ".canvas"))]
        else:
            targets.append(p)
    errors = []
    for t in targets:
        rel = os.path.relpath(t, v.root).replace(os.sep, "/")
        if rel.endswith(".canvas"):
            check_canvas(v, rel, errors)
            continue
        check_markdown(v, rel, errors)
        if "/practice/" in "/" + rel:
            check_practice(rel, v.text(rel), errors)
        if os.path.basename(rel) == "flashcards.md":
            check_flashcards(rel, v.text(rel), errors)
    print(json.dumps({"ok": not errors, "checked": len(targets), "errors": errors}, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
