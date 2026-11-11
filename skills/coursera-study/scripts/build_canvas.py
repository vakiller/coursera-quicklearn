#!/usr/bin/env python3
"""Turn a nested-list outline into an Obsidian Canvas mind map (JSON Canvas 1.0).

Usage: build_canvas.py <outline.md> <out.canvas>

Outline format:
    # Root title
    - Branch                       (level 1 → branch, alternately right/left of the root)
      - Leaf text                  (level 2 → leaf next to its branch)
      - [[Coursera/_concepts/X]]   (a leaf that is only a wikilink → file node, opens the note)
        - detail                   (level 3+ → folded into the leaf's text as a bullet)
Layout is deterministic and overlap-free: each side stacks branch blocks vertically.
"""
import json
import re
import sys

ROOT_W, ROOT_H = 340, 90
BR_W, BR_H = 280, 70
LEAF_W, LEAF_BASE_H, LINE_H = 300, 60, 26
FILE_H = 120
GAP_Y, BLOCK_GAP = 24, 60
BR_X, LEAF_X = 480, 860
WIKI_ONLY = re.compile(r"^\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]$")


def parse(text):
    root, branches = None, []
    for raw in text.splitlines():
        if not raw.strip():
            continue
        if raw.startswith("# ") and root is None:
            root = raw[2:].strip()
            continue
        m = re.match(r"^(\s*)[-*]\s+(.*)$", raw)
        if not m:
            continue
        depth = len(m.group(1).replace("\t", "  ")) // 2
        label = m.group(2).strip()
        if depth == 0:
            branches.append({"text": label, "leaves": []})
        elif branches and depth == 1:
            branches[-1]["leaves"].append({"text": label, "details": []})
        elif branches and branches[-1]["leaves"]:
            branches[-1]["leaves"][-1]["details"].append("  " * (depth - 2) + "- " + label)
    if root is None:
        raise ValueError("outline needs a '# Root title' line")
    return root, branches


def leaf_node(leaf):
    m = WIKI_ONLY.match(leaf["text"])
    if m and not leaf["details"]:
        return {"type": "file", "file": m.group(1).strip() + ".md", "width": LEAF_W, "height": FILE_H}
    text = "\n".join([leaf["text"]] + leaf["details"])
    return {"type": "text", "text": text, "width": LEAF_W, "height": LEAF_BASE_H + LINE_H * len(leaf["details"])}


def build(text):
    root_text, branches = parse(text)
    nodes, edges = [], []
    nodes.append({"id": "n0", "type": "text", "text": f"# {root_text}", "x": -ROOT_W // 2, "y": -ROOT_H // 2,
                  "width": ROOT_W, "height": ROOT_H, "color": "6"})
    sides = {"right": [], "left": []}
    for i, b in enumerate(branches):
        leaves = [leaf_node(l) for l in b["leaves"]]
        leaves_h = sum(l["height"] for l in leaves) + GAP_Y * max(len(leaves) - 1, 0)
        sides["right" if i % 2 == 0 else "left"].append((i, b, leaves, max(BR_H, leaves_h)))

    counter = 1
    for side, blocks in sides.items():
        total = sum(h for *_, h in blocks) + BLOCK_GAP * max(len(blocks) - 1, 0)
        y = -total // 2
        for i, b, leaves, h in blocks:
            color = str(i % 5 + 1)
            bx = BR_X if side == "right" else -BR_X - BR_W
            bid = f"n{counter}"
            counter += 1
            nodes.append({"id": bid, "type": "text", "text": f"**{b['text']}**", "x": bx, "y": y + (h - BR_H) // 2,
                          "width": BR_W, "height": BR_H, "color": color})
            edges.append({"id": f"e{bid}", "fromNode": "n0", "fromSide": side, "toNode": bid,
                          "toSide": "left" if side == "right" else "right"})
            leaves_h = sum(l["height"] for l in leaves) + GAP_Y * max(len(leaves) - 1, 0)
            ly = y + (h - leaves_h) // 2
            for leaf in leaves:
                lid = f"n{counter}"
                counter += 1
                lx = LEAF_X if side == "right" else -LEAF_X - LEAF_W
                nodes.append({"id": lid, **leaf, "x": lx, "y": ly, "color": color})
                edges.append({"id": f"e{lid}", "fromNode": bid, "fromSide": side, "toNode": lid,
                              "toSide": "left" if side == "right" else "right"})
                ly += leaf["height"] + GAP_Y
            y += h + BLOCK_GAP
    return {"nodes": nodes, "edges": edges}


def main(argv):
    if len(argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    with open(argv[1], encoding="utf-8") as f:
        try:
            canvas = build(f.read())
        except ValueError as e:
            print(f"error: {e}", file=sys.stderr)
            return 1
    with open(argv[2], "w", encoding="utf-8") as f:
        json.dump(canvas, f, ensure_ascii=False, indent="\t")
    print(json.dumps({"nodes": len(canvas["nodes"]), "edges": len(canvas["edges"]), "out": argv[2]}))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
