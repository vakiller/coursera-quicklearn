"""Builds a small synthetic vault that follows the coursera-vault/1 contract (spec §3)."""
import json
import os
import tempfile

SLUG = "demo-course"
M1 = "M01 - Getting started"
M2 = "M02 - Goals and scope"


def raw(item_type, module, title, item_id, lesson, body, h):
    return (
        "---\n"
        "schema: coursera-vault/1\n"
        f"type: {item_type}\n"
        f'course_slug: "{SLUG}"\n'
        'course_id: "cid"\n'
        f"module: {module}\n"
        'module_title: "x"\n'
        f'lesson: "{lesson}"\n'
        "item_index: 1\n"
        f'item_id: "{item_id}"\n'
        f'title: "{title}"\n'
        'url: "https://www.coursera.org/x"\n'
        'language: "en"\n'
        'fetched_at: "2026-11-11T00:00:00Z"\n'
        f'content_hash: "{h}"\n'
        "---\n\n"
        f"# {title}\n\n{body}"
    )


def item(index, iid, typ, title, file=None, status="ok", h=None, graded=None):
    d = {"index": index, "id": iid, "type": typ, "title": title, "file": file, "content_hash": h, "status": status}
    if graded is not None:
        d["graded"] = graded
    return d


def make_vault(plugins=(), enabled=(), core=None):
    root = tempfile.mkdtemp(prefix="vault-")
    base = os.path.join(root, "Coursera", SLUG)
    files = {
        f"{M1}/raw/01 - Welcome (video).md": raw("video", 1, "Welcome", "v1", "Intro lesson",
                                                 "**[00:00]** Welcome to the course. ^t0000\n\n**[00:31]** The key idea is scope. ^t0031\n", "sha256:a"),
        f"{M1}/raw/02 - Course overview (reading).md": raw("reading", 1, "Course overview", "r1", "Intro lesson",
                                                           "## Overview\n\nRead this. ^p01\n", "sha256:b"),
        f"{M2}/raw/01 - SMART goals (video).md": raw("video", 2, "SMART goals", "v2", "Goals lesson",
                                                     "**[00:00]** Goals should be SMART. ^t0000\n", "sha256:c"),
        f"{M2}/raw/03 - Scope creep (video).md": raw("video", 2, "Scope creep", "v3", "Scope lesson",
                                                     "**[00:00]** Scope creep is uncontrolled growth. ^t0000\n", "sha256:d"),
        f"{M2}/raw/06 - Wrap-up (video).md": raw("video", 2, "Wrap-up", "v4", "Review lesson",
                                                 "**[00:00]** We covered goals and scope. ^t0000\n", "sha256:e"),
    }
    manifest = {
        "schema": "coursera-vault/1",
        "course": {"id": "cid", "slug": SLUG, "title": "Demo Course", "fetched_at": "2026-11-11T00:00:00Z"},
        "modules": [
            {"index": 1, "id": "m1", "title": "Getting started", "folder": M1, "items": [
                item(1, "v1", "video", "Welcome", "raw/01 - Welcome (video).md", h="sha256:a"),
                item(2, "r1", "reading", "Course overview", "raw/02 - Course overview (reading).md", h="sha256:b"),
                item(3, "q1", "quiz", "Module 1 Challenge", status="not_fetched", graded=True),
            ]},
            {"index": 2, "id": "m2", "title": "Goals and scope", "folder": M2, "items": [
                item(1, "v2", "video", "SMART goals", "raw/01 - SMART goals (video).md", h="sha256:c"),
                item(2, "q2", "quiz", "Test your knowledge: Goals", status="not_fetched", graded=False),
                item(3, "v3", "video", "Scope creep", "raw/03 - Scope creep (video).md", h="sha256:d"),
                item(4, "q3", "quiz", "Reflection: Scope", status="not_fetched", graded=False),
                item(5, "r9", "reading", "Exemplar", None, status="locked"),
                item(6, "v4", "video", "Wrap-up", "raw/06 - Wrap-up (video).md", h="sha256:e"),
                item(7, "q4", "quiz", "Module 2 Challenge", status="not_fetched", graded=True),
            ]},
        ],
    }
    for rel, content in files.items():
        p = os.path.join(base, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w") as f:
            f.write(content)
    for folder, desc in ((M1, "Learn the basics."), (M2, "Set goals and control scope.")):
        with open(os.path.join(base, folder, "_module.md"), "w") as f:
            f.write(f"---\nschema: coursera-vault/1\ntype: module\n---\n\n# {folder}\n\n{desc}\n\n## Items\n")
    with open(os.path.join(base, "_manifest.json"), "w") as f:
        json.dump(manifest, f)
    with open(os.path.join(base, "_course.md"), "w") as f:
        f.write("---\nschema: coursera-vault/1\ntype: course\n---\n\n# Demo Course\n")

    ob = os.path.join(root, ".obsidian")
    os.makedirs(os.path.join(ob, "plugins"), exist_ok=True)
    for pid in plugins:
        os.makedirs(os.path.join(ob, "plugins", pid), exist_ok=True)
        with open(os.path.join(ob, "plugins", pid, "manifest.json"), "w") as f:
            json.dump({"id": pid}, f)
    if enabled:
        with open(os.path.join(ob, "community-plugins.json"), "w") as f:
            json.dump(list(enabled), f)
    with open(os.path.join(ob, "core-plugins.json"), "w") as f:
        json.dump(core if core is not None else {"canvas": True, "bases": True}, f)
    return root


def write(root, rel, content):
    p = os.path.join(root, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w") as f:
        f.write(content)
    return p
