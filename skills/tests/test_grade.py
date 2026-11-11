import json, os, subprocess, sys, tempfile, unittest

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "coursera-study", "scripts", "grade.py")

TEST = """---
title: Practice test
---

### Câu 1 *(Chọn 1)* · Objective: Identify stakeholders
Q1?
- [ ] A. a
- [x] B. b
- [ ] C. c

> [!success]- Đáp án & giải thích
> **Đáp án:** B
> because

### Câu 2 *(Chọn nhiều)* · Objective: Scope
Q2?
- [x] A. a
- [ ] B. b
- [x] C. c
- [ ] D. d

> [!success]- Đáp án & giải thích
> **Đáp án:** A, D

### Câu 3 *(Chọn 1)* · Objective: Goals
Q3?
- [x] A. a
- [X] B. b

> [!success]- Đáp án & giải thích
> **Đáp án:** A

### Câu 4 *(Đúng/Sai)* · Objective: Goals
Statement.
- [ ] A. Đúng
- [ ] B. Sai

> [!success]- Đáp án & giải thích
> **Đáp án:** B

### Câu 5 *(Điền)* · Objective: Scope
Term?
Trả lời:: scope creeping
> [!success]- Đáp án & giải thích
> **Đáp án:** Scope creep

### Câu 6 *(Điền)* · Objective: Scope
Term?
Trả lời:: Triple Constraint
> [!success]- Đáp án & giải thích
> **Đáp án:** triple constraint

### Câu 7 *(Sắp xếp)* · Objective: Life cycle
Order?
Trả lời:: 2, 1,3
> [!success]- Đáp án & giải thích
> **Đáp án:** 2,1,3
"""


def setup_file():
    d = tempfile.mkdtemp()
    p = os.path.join(d, "practice-test.md")
    with open(p, "w") as f:
        f.write(TEST)
    return p


class GradeTest(unittest.TestCase):
    def setUp(self):
        self.p = setup_file()
        out = subprocess.run([sys.executable, SCRIPT, self.p], capture_output=True, text=True, check=True).stdout
        self.r = json.loads(out)
        self.q = {q["n"]: q for q in self.r["questions"]}

    def test_counts(self):
        self.assertEqual(self.r["total"], 7)
        self.assertEqual(self.r["auto_correct"], 3)  # Q1, Q6 (exact), Q7
        self.assertEqual(self.r["needs_judgement"], [5])

    def test_single_choice(self):
        self.assertEqual(self.q[1]["selected"], ["B"])
        self.assertTrue(self.q[1]["correct"])
        self.assertEqual(self.q[1]["objective"], "Identify stakeholders")

    def test_multi_choice_partial_is_wrong(self):
        self.assertEqual(self.q[2]["selected"], ["A", "C"])
        self.assertEqual(self.q[2]["key"], ["A", "D"])
        self.assertFalse(self.q[2]["correct"])

    def test_single_choice_with_two_ticks_is_wrong(self):
        self.assertFalse(self.q[3]["correct"])
        self.assertIn("multiple", self.q[3]["note"])

    def test_unanswered(self):
        self.assertFalse(self.q[4]["correct"])
        self.assertTrue(self.q[4]["unanswered"])

    def test_fill_in(self):
        self.assertIsNone(self.q[5]["correct"])
        self.assertEqual(self.q[5]["response"], "scope creeping")
        self.assertEqual(self.q[5]["key"], "Scope creep")
        self.assertTrue(self.q[6]["correct"])

    def test_ordering(self):
        self.assertTrue(self.q[7]["correct"])

    def test_reset_unticks_and_clears_answers(self):
        subprocess.run([sys.executable, SCRIPT, self.p, "--reset"], check=True, capture_output=True)
        with open(self.p) as f:
            text = f.read()
        self.assertNotIn("[x]", text)
        self.assertNotIn("[X]", text)
        self.assertNotIn("Trả lời:: scope", text)
        self.assertIn("Trả lời:: \n", text)
        self.assertIn("> **Đáp án:** B", text)
        r = json.loads(subprocess.run([sys.executable, SCRIPT, self.p], capture_output=True, text=True).stdout)
        self.assertEqual(r["auto_correct"], 0)


if __name__ == "__main__":
    unittest.main()
