import os, subprocess, sys, unittest
sys.path.insert(0, os.path.dirname(__file__))
from helpers import make_vault, write, SLUG, M2

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "coursera-study", "scripts", "module_context.py")


def run(*args):
    return subprocess.run([sys.executable, SCRIPT, *args], capture_output=True, text=True, check=True).stdout


class ModuleContextTest(unittest.TestCase):
    def setUp(self):
        self.v = make_vault()
        write(self.v, "Coursera/_concepts/Scope creep.md", "# Scope creep\n")
        self.out = run(self.v, SLUG, "2")

    def test_header(self):
        for s in [f"course_slug: {SLUG}", "course_title: Demo Course", "module: 2",
                  f"folder: Coursera/{SLUG}/{M2}", f"notes_dir: Coursera/{SLUG}/{M2}/notes", "source_hash: sha256:"]:
            self.assertIn(s, self.out)

    def test_existing_concepts_listed(self):
        self.assertIn("existing_concepts: Scope creep", self.out)

    def test_description(self):
        self.assertIn("Set goals and control scope.", self.out)

    def test_test_map(self):
        self.assertIn("Module 2 Challenge — graded challenge — scope: whole module", self.out)
        self.assertIn('Test your knowledge: Goals — practice — scope: lesson "Goals lesson" (SMART goals)', self.out)
        self.assertIn("Reflection: Scope — activity (not a test)", self.out)

    def test_locked_items(self):
        self.assertIn("Exemplar (reading) — locked", self.out)

    def test_exam_signal_items(self):
        self.assertIn("Wrap-up (video) — wrap-up", self.out)

    def test_sources_with_full_paths_and_bodies_without_frontmatter(self):
        self.assertIn(f"=== SOURCE: [[Coursera/{SLUG}/{M2}/raw/01 - SMART goals (video)]] · video · lesson: Goals lesson", self.out)
        self.assertIn("Goals should be SMART. ^t0000", self.out)
        self.assertNotIn("content_hash", self.out)
        self.assertLess(self.out.index("SMART goals (video)]]"), self.out.index("Scope creep (video)]]"))

    def test_module_by_folder_number_must_exist(self):
        r = subprocess.run([sys.executable, SCRIPT, self.v, SLUG, "9"], capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0)


if __name__ == "__main__":
    unittest.main()
