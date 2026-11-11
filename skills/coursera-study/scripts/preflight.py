#!/usr/bin/env python3
"""Check an Obsidian vault before generating study notes.

Usage: preflight.py [vault] [--json]
Without a vault path, the vault is found from the current folder (itself, a parent, or a single child
folder that contains Coursera/<course>/_manifest.json) — run Claude Code inside the vault.
Reports Coursera courses + per-module note status (missing/stale/fresh), community plugins
(missing/installed/enabled), core plugins, and whether Coursera/_profile.md exists.
It never installs or changes anything.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _vault import courses, find_vault, module_source_hash, notes_status, read  # noqa: E402

REQUIRED_PLUGINS = {"obsidian-spaced-repetition": "Spaced Repetition (flashcard review)"}
OPTIONAL_PLUGINS = {
    "obsidian-local-rest-api": "Local REST API (needed for the Obsidian MCP)",
    "dataview": "Dataview (not needed — dashboard uses core Bases)",
}
REQUIRED_CORE = {"canvas": "Canvas (mind maps)", "bases": "Bases (dashboard)"}


def load_json(path, default):
    try:
        return json.loads(read(path))
    except (OSError, ValueError):
        return default


def check(vault):
    ob = os.path.join(vault, ".obsidian")
    enabled = set(load_json(os.path.join(ob, "community-plugins.json"), []))
    core = load_json(os.path.join(ob, "core-plugins.json"), {})
    if isinstance(core, list):  # older Obsidian format: list of enabled ids
        core = {k: True for k in core}

    def state(pid):
        if pid in enabled:
            return "enabled"
        return "installed" if os.path.isfile(os.path.join(ob, "plugins", pid, "manifest.json")) else "missing"

    plugins = {pid: state(pid) for pid in list(REQUIRED_PLUGINS) + list(OPTIONAL_PLUGINS)}
    core_state = {k: bool(core.get(k)) for k in REQUIRED_CORE}
    missing = [p for p in REQUIRED_PLUGINS if plugins[p] == "missing"]
    missing += [f"core:{k}" for k, on in core_state.items() if not on]

    return {
        "vault": os.path.realpath(vault),
        "courses": [
            {
                "slug": slug,
                "title": m["course"]["title"],
                "modules": [
                    {"index": mod["index"], "folder": mod["folder"], "source_hash": module_source_hash(mod),
                     "notes_status": notes_status(vault, slug, mod)}
                    for mod in m["modules"]
                ],
            }
            for slug, m in courses(vault)
        ],
        "plugins": plugins,
        "core": core_state,
        "profile": os.path.isfile(os.path.join(vault, "Coursera", "_profile.md")),
        "dashboard": os.path.isfile(os.path.join(vault, "Coursera", "_dashboard.base")),
        "required_missing": missing,
    }


def text_report(r):
    lines = [f"Vault: {r['vault']}", ""]
    for c in r["courses"]:
        lines.append(f"Course {c['slug']} — {c['title']}")
        for m in c["modules"]:
            lines.append(f"  {m['folder']}: notes {m['notes_status']}")
    if not r["courses"]:
        lines.append("No synced course found under Coursera/ — run the Chrome extension Sync first.")
    lines.append("")
    names = {**REQUIRED_PLUGINS, **OPTIONAL_PLUGINS}
    for pid, st in r["plugins"].items():
        tag = "REQUIRED" if pid in REQUIRED_PLUGINS else "optional"
        lines.append(f"  [{st:9}] {names[pid]} ({pid}, {tag})")
    for k, on in r["core"].items():
        lines.append(f"  [{'enabled' if on else 'OFF':9}] core: {REQUIRED_CORE[k]}")
    lines.append(f"  [{'ok' if r['profile'] else 'missing':9}] Coursera/_profile.md")
    lines.append(f"  [{'ok' if r['dashboard'] else 'missing':9}] Coursera/_dashboard.base")
    return "\n".join(lines)


def main(argv):
    args = [a for a in argv[1:] if not a.startswith("--")]
    vault = args[0] if args else find_vault(os.getcwd())
    if not vault or not os.path.isdir(vault):
        print("No vault found: run Claude Code inside your Obsidian vault (the folder with Coursera/), "
              "or pass the vault path: preflight.py <vault> [--json]", file=sys.stderr)
        return 2
    r = check(vault)
    print(json.dumps(r, ensure_ascii=False, indent=2) if "--json" in argv else text_report(r))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
