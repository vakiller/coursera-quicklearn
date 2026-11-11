import json, os, subprocess, sys, unittest
sys.path.insert(0, os.path.dirname(__file__))
from helpers import make_vault, write, SLUG, M1, M2

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "coursera-study", "scripts", "validate.py")
RAW = f"Coursera/{SLUG}/{M1}/raw/01 - Welcome (video)"


def run(vault, *paths):
    r = subprocess.run([sys.executable, SCRIPT, vault, *paths], capture_output=True, text=True)
    return r.returncode, json.loads(r.stdout)


class ValidateTest(unittest.TestCase):
    def setUp(self):
        self.v = make_vault()
        self.notes = f"Coursera/{SLUG}/{M1}/notes"

    def note(self, name, text):
        return write(self.v, f"{self.notes}/{name}", text)

    def messages(self, res):
        return " | ".join(e["message"] for e in res["errors"])

    def test_good_links_pass(self):
        p = self.note("summary.md", f"See [[{RAW}#^t0031|here]] and ![[{RAW}#^t0000]] and [[{RAW}]].\n"
                                    f"Heading: [[Coursera/{SLUG}/{M1}/raw/02 - Course overview (reading)#Overview]]\n")
        code, res = run(self.v, p)
        self.assertEqual((code, res["errors"]), (0, []))

    def test_missing_file_and_block_and_heading(self):
        p = self.note("summary.md", f"[[Coursera/nope]] [[{RAW}#^t9999]] [[{RAW}#No such heading]]\n")
        code, res = run(self.v, p)
        self.assertEqual(code, 1)
        msg = self.messages(res)
        self.assertIn("Coursera/nope", msg)
        self.assertIn("^t9999", msg)
        self.assertIn("No such heading", msg)
        self.assertEqual(res["errors"][0]["line"], 1)

    def test_ambiguous_basename_is_an_error_but_unique_basename_is_ok(self):
        write(self.v, f"Coursera/other/{M1}/raw/01 - Welcome (video).md", "x")
        p = self.note("summary.md", "[[01 - Welcome (video)]] [[02 - Course overview (reading)]]\n")
        code, res = run(self.v, p)
        self.assertEqual(len(res["errors"]), 1)
        self.assertIn("ambiguous", self.messages(res))

    def test_links_inside_code_fences_are_ignored(self):
        p = self.note("summary.md", "```\n[[Coursera/nope]]\n```\n")
        self.assertEqual(run(self.v, p)[0], 0)

    def test_mermaid_type_checked(self):
        ok = self.note("a.md", "```mermaid\nmindmap\n  root((A))\n```\n```mermaid\nquadrantChart\n```\n")
        bad = self.note("b.md", "```mermaid\nmind-map\n  root((A))\n```\n")
        self.assertEqual(run(self.v, ok)[0], 0)
        code, res = run(self.v, bad)
        self.assertIn("mermaid", self.messages(res))

    def test_canvas_checks(self):
        good = {"nodes": [{"id": "a", "type": "text", "text": "x", "x": 0, "y": 0, "width": 10, "height": 10},
                          {"id": "b", "type": "file", "file": f"{RAW}.md", "x": 20, "y": 0, "width": 10, "height": 10}],
                "edges": [{"id": "e", "fromNode": "a", "toNode": "b"}]}
        p = self.note("mindmap.canvas", json.dumps(good))
        self.assertEqual(run(self.v, p)[0], 0)
        bad = {"nodes": [{"id": "a", "type": "file", "file": "Coursera/_concepts/Missing.md", "x": 0, "y": 0, "width": 1, "height": 1}],
               "edges": [{"id": "e", "fromNode": "a", "toNode": "zz"}]}
        p = self.note("mindmap.canvas", json.dumps(bad))
        code, res = run(self.v, p)
        msg = self.messages(res)
        self.assertIn("Missing.md", msg)
        self.assertIn("zz", msg)
        p = self.note("broken.canvas", "{not json")
        self.assertEqual(run(self.v, p)[0], 1)

    def test_practice_questions_need_answer_keys(self):
        good = ("### Câu 1 *(Chọn 1)* · Objective: x\nQ?\n- [ ] A. a\n- [ ] B. b\n\n> [!success]- Đáp án & giải thích\n> **Đáp án:** B\n\n"
                "### Câu 2 *(Điền)* · Objective: y\nQ?\nTrả lời:: \n> [!success]- Đáp án & giải thích\n> **Đáp án:** Scope creep\n")
        p = self.note("practice/practice-test.md", good)
        self.assertEqual(run(self.v, p)[0], 0)
        bad = "### Câu 1 *(Chọn 1)* · Objective: x\nQ?\n- [ ] A. only one\n\n### Câu 2 *(Điền)* · Objective: y\nQ?\n"
        p = self.note("practice/pretest.md", bad)
        code, res = run(self.v, p)
        msg = self.messages(res)
        self.assertIn("Câu 1", msg)
        self.assertIn("Câu 2", msg)

    def test_flashcards_need_cards(self):
        p = self.note("flashcards.md", "#flashcards/demo\n\nWhat is scope creep::Uncontrolled growth of scope\n")
        self.assertEqual(run(self.v, p)[0], 0)
        p = self.note("flashcards.md", "just text\n")
        self.assertEqual(run(self.v, p)[0], 1)

    def test_directory_argument_recurses(self):
        self.note("a.md", "[[Coursera/nope]]\n")
        self.note("practice/b.md", "[[Coursera/nope2]]\n")
        code, res = run(self.v, os.path.join(self.v, self.notes))
        self.assertEqual(len([e for e in res["errors"] if "not found" in e["message"]]), 2)


if __name__ == "__main__":
    unittest.main()
