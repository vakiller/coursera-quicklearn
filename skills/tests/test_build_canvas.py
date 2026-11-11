import json, os, subprocess, sys, tempfile, unittest

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "coursera-study", "scripts", "build_canvas.py")

OUTLINE = """# Defining goals & scope
- Goals
  - SMART: Specific, Measurable, Attainable, Relevant, Time-bound
  - [[Coursera/_concepts/OKR]]
  - Deliverables
    - tangible outcomes
- Scope
  - In-scope vs out-of-scope
  - [[Coursera/_concepts/Scope creep|Scope creep]]
- Success criteria
- Triple constraint
- Launch vs land
"""


def build(text):
    d = tempfile.mkdtemp()
    src, out = os.path.join(d, "o.md"), os.path.join(d, "m.canvas")
    with open(src, "w") as f:
        f.write(text)
    subprocess.run([sys.executable, SCRIPT, src, out], check=True, capture_output=True)
    with open(out) as f:
        return json.load(f)


def overlaps(a, b):
    return a["x"] < b["x"] + b["width"] and b["x"] < a["x"] + a["width"] and a["y"] < b["y"] + b["height"] and b["y"] < a["y"] + a["height"]


class BuildCanvasTest(unittest.TestCase):
    def setUp(self):
        self.c = build(OUTLINE)
        self.nodes = {n["id"]: n for n in self.c["nodes"]}

    def test_root_and_counts(self):
        texts = [n.get("text", "") for n in self.c["nodes"]]
        self.assertIn("# Defining goals & scope", texts)
        self.assertEqual(len(self.c["nodes"]), 1 + 5 + 5)
        self.assertEqual(len(self.c["edges"]), 5 + 5)

    def test_wikilink_only_items_become_file_nodes(self):
        files = sorted(n["file"] for n in self.c["nodes"] if n["type"] == "file")
        self.assertEqual(files, ["Coursera/_concepts/OKR.md", "Coursera/_concepts/Scope creep.md"])

    def test_third_level_folds_into_parent_text(self):
        d = next(n for n in self.c["nodes"] if n.get("text", "").startswith("Deliverables"))
        self.assertIn("- tangible outcomes", d["text"])

    def test_edges_reference_nodes(self):
        for e in self.c["edges"]:
            self.assertIn(e["fromNode"], self.nodes)
            self.assertIn(e["toNode"], self.nodes)

    def test_no_overlapping_nodes(self):
        ns = self.c["nodes"]
        for i in range(len(ns)):
            for j in range(i + 1, len(ns)):
                self.assertFalse(overlaps(ns[i], ns[j]), (ns[i].get("text") or ns[i].get("file"), ns[j].get("text") or ns[j].get("file")))

    def test_branches_on_both_sides_and_colored(self):
        root = self.c["nodes"][0]
        branches = [n for n in self.c["nodes"] if any(e["fromNode"] == root["id"] and e["toNode"] == n["id"] for e in self.c["edges"])]
        self.assertTrue(any(b["x"] > root["x"] for b in branches) and any(b["x"] < root["x"] for b in branches))
        self.assertTrue(all("color" in b for b in branches))

    def test_rejects_outline_without_root(self):
        d = tempfile.mkdtemp()
        src = os.path.join(d, "o.md")
        with open(src, "w") as f:
            f.write("- no root\n")
        r = subprocess.run([sys.executable, SCRIPT, src, os.path.join(d, "x.canvas")], capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0)


if __name__ == "__main__":
    unittest.main()
