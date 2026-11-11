"""Shared helpers for reading a vault that follows the coursera-vault/1 contract."""
import hashlib
import json
import os
import re

COURSERA = "Coursera"


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def frontmatter(text):
    """Return (dict of simple key: value pairs, body). Values are unquoted strings."""
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---", 4)
    if end < 0:
        return {}, text
    meta = {}
    for line in text[4:end].splitlines():
        m = re.match(r"^([A-Za-z_][\w-]*):\s*(.*)$", line)
        if m:
            v = m.group(2).strip()
            if len(v) >= 2 and v[0] == v[-1] == '"':
                v = v[1:-1].replace('\\"', '"').replace("\\\\", "\\")
            meta[m.group(1)] = v
    body = text[end + 4:].lstrip("\n")
    return meta, body


def courses(vault):
    root = os.path.join(vault, COURSERA)
    if not os.path.isdir(root):
        return []
    out = []
    for slug in sorted(os.listdir(root)):
        mf = os.path.join(root, slug, "_manifest.json")
        if os.path.isfile(mf):
            out.append((slug, json.loads(read(mf))))
    return out


def load_manifest(vault, slug):
    return json.loads(read(os.path.join(vault, COURSERA, slug, "_manifest.json")))


def module_source_hash(module):
    parts = sorted(f"{i['id']}:{i.get('content_hash')}" for i in module["items"] if i.get("status") == "ok")
    return "sha256:" + hashlib.sha256("\n".join(parts).encode()).hexdigest()


def notes_status(vault, slug, module):
    study = os.path.join(vault, COURSERA, slug, module["folder"], "notes", "_study.md")
    if not os.path.isfile(study):
        return "missing"
    meta, _ = frontmatter(read(study))
    return "fresh" if meta.get("source_hash") == module_source_hash(module) else "stale"


def vault_link(slug, folder, file):
    """Full-path wikilink target (no .md) — basenames collide across courses."""
    return f"{COURSERA}/{slug}/{folder}/{file[:-3] if file.endswith('.md') else file}"


def is_vault(path):
    root = os.path.join(path, COURSERA)
    return os.path.isdir(root) and any(
        os.path.isfile(os.path.join(root, d, "_manifest.json")) for d in os.listdir(root)
    )


def find_vault(start):
    """The vault is the folder Claude is working in: start, one of its parents, or a single child folder."""
    cur = os.path.realpath(start)
    while True:
        if is_vault(cur):
            return cur
        parent = os.path.dirname(cur)
        if parent == cur:
            break
        cur = parent
    start = os.path.realpath(start)
    try:
        kids = [os.path.join(start, d) for d in sorted(os.listdir(start)) if not d.startswith(".")]
    except OSError:
        return None
    found = [k for k in kids if os.path.isdir(k) and is_vault(k)]
    return found[0] if len(found) == 1 else None
