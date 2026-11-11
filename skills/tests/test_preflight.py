import json, os, subprocess, sys, unittest
sys.path.insert(0, os.path.dirname(__file__))
from helpers import make_vault, write, SLUG, M1, M2

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "coursera-study", "scripts", "preflight.py")


def run(vault):
    out = subprocess.run([sys.executable, SCRIPT, vault, "--json"], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


class PreflightTest(unittest.TestCase):
    def test_reports_missing_plugins_and_profile(self):
        r = run(make_vault())
        self.assertEqual(r["plugins"]["obsidian-spaced-repetition"], "missing")
        self.assertEqual(r["plugins"]["obsidian-local-rest-api"], "missing")
        self.assertTrue(r["core"]["canvas"])
        self.assertTrue(r["core"]["bases"])
        self.assertFalse(r["profile"])
        self.assertIn("obsidian-spaced-repetition", r["required_missing"])

    def test_distinguishes_installed_from_enabled(self):
        r = run(make_vault(plugins=["obsidian-spaced-repetition", "obsidian-local-rest-api"], enabled=["obsidian-spaced-repetition"]))
        self.assertEqual(r["plugins"]["obsidian-spaced-repetition"], "enabled")
        self.assertEqual(r["plugins"]["obsidian-local-rest-api"], "installed")
        self.assertEqual(r["required_missing"], [])

    def test_flags_disabled_canvas_as_required(self):
        r = run(make_vault(core={"canvas": False, "bases": True}))
        self.assertIn("core:canvas", r["required_missing"])

    def test_lists_courses_and_module_note_status(self):
        v = make_vault()
        course = run(v)["courses"][0]
        self.assertEqual(course["slug"], SLUG)
        self.assertEqual([m["folder"] for m in course["modules"]], [M1, M2])
        self.assertEqual({m["notes_status"] for m in course["modules"]}, {"missing"})
        h = course["modules"][1]["source_hash"]
        self.assertTrue(h.startswith("sha256:"))
        write(v, f"Coursera/{SLUG}/{M2}/notes/_study.md", f'---\nsource_hash: "{h}"\n---\n')
        write(v, f"Coursera/{SLUG}/{M1}/notes/_study.md", '---\nsource_hash: "sha256:old"\n---\n')
        mods = run(v)["courses"][0]["modules"]
        self.assertEqual([m["notes_status"] for m in mods], ["stale", "fresh"])

    def test_detects_profile(self):
        v = make_vault()
        write(v, "Coursera/_profile.md", "# me\n")
        self.assertTrue(run(v)["profile"])

    def test_not_a_vault(self):
        out = subprocess.run([sys.executable, SCRIPT, "/nonexistent-dir", "--json"], capture_output=True, text=True)
        self.assertNotEqual(out.returncode, 0)


if __name__ == "__main__":
    unittest.main()
