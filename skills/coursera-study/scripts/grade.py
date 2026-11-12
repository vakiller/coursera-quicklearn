#!/usr/bin/env python3
"""Grade a practice test the learner ticked in Obsidian.

Usage: grade.py <practice.md>            → JSON report
       grade.py <practice.md> --reset    → untick every box, clear every "Trả lời::" value

Question contract (see references/practice-test-guide.md):
    ### Câu N *(Chọn 1|Chọn nhiều|Đúng/Sai|Điền|Sắp xếp)* · Objective: <text>
    - [ ] A. …            (choice kinds)
    Trả lời:: <answer>    (Điền, Sắp xếp)
    > **Đáp án:** B, D    (answer key, inside the folded callout)
Choice and ordering questions are graded here. Fill-ins are graded here only on an exact
(case-insensitive) match; otherwise they are listed in needs_judgement for Claude to judge by meaning.
"""
import json
import re
import sys

HEADER = re.compile(r"^###\s+Câu\s+(\d+)\s+\*\((Chọn 1|Chọn nhiều|Đúng/Sai|Điền|Sắp xếp)\)\*(?:\s*·\s*Objective:\s*(.*))?\s*$")
OPTION = re.compile(r"^\s*-\s+\[([ xX])\]\s+([A-Z])[.)]")
ANSWER_LINE = re.compile(r"^Trả lời::[ \t]*(.*)$")
KEY = re.compile(r"^>\s*\*\*Đáp án:\*\*\s*(.*)$")
CHOICE = {"Chọn 1", "Chọn nhiều", "Đúng/Sai"}


def norm(s):
    return re.sub(r"\s+", " ", s.strip().strip(".").lower())


def parse(text):
    questions, cur = [], None
    for line in text.splitlines():
        h = HEADER.match(line)
        if h:
            cur = {"n": int(h.group(1)), "kind": h.group(2), "objective": (h.group(3) or "").strip(),
                   "selected": [], "response": "", "key_raw": None}
            questions.append(cur)
            continue
        if cur is None:
            continue
        o = OPTION.match(line)
        if o and o.group(1) in "xX":
            cur["selected"].append(o.group(2))
        a = ANSWER_LINE.match(line)
        if a:
            cur["response"] = a.group(1).strip()
        k = KEY.match(line)
        if k and cur["key_raw"] is None:
            cur["key_raw"] = k.group(1).strip()
    return questions


def grade(q):
    kind, key_raw = q["kind"], q["key_raw"] or ""
    out = {"n": q["n"], "kind": kind, "objective": q["objective"], "correct": False, "unanswered": False, "note": ""}
    if kind in CHOICE:
        key = sorted(set(re.findall(r"\b([A-Z])\b", key_raw)))
        sel = sorted(set(q["selected"]))
        out.update(selected=sel, key=key, unanswered=not sel)
        if kind != "Chọn nhiều" and len(sel) > 1:
            out["note"] = "multiple boxes ticked for a single-answer question"
        else:
            out["correct"] = bool(sel) and sel == key
    elif kind == "Sắp xếp":
        resp, key = re.findall(r"\d+", q["response"]), re.findall(r"\d+", key_raw)
        out.update(response=q["response"], key=key_raw, unanswered=not resp, correct=bool(resp) and resp == key)
    else:  # Điền
        out.update(response=q["response"], key=key_raw, unanswered=not q["response"])
        if not q["response"]:
            out["correct"] = False
        elif norm(q["response"]) == norm(key_raw):
            out["correct"] = True
        else:
            out["correct"] = None
            out["note"] = "needs judgement by meaning"
    if q["key_raw"] is None:
        out["note"] = "no answer key found"
        out["correct"] = None
    return out


def reset(path, text):
    count = 0

    def untick(m):
        nonlocal count
        count += 1
        return m.group(1) + "[ ]"

    text = re.sub(r"^(\s*-\s+)\[[xX]\]", untick, text, flags=re.M)
    text = re.sub(r"^Trả lời::[ \t]*.*$", "Trả lời:: ", text, flags=re.M)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    return {"reset": True, "unticked": count}


def main(argv):
    if len(argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    with open(argv[1], encoding="utf-8") as f:
        text = f.read()
    if "--reset" in argv:
        print(json.dumps(reset(argv[1], text)))
        return 0
    graded = [grade(q) for q in parse(text)]
    report = {
        "file": argv[1],
        "total": len(graded),
        "auto_correct": sum(1 for g in graded if g["correct"] is True),
        "needs_judgement": [g["n"] for g in graded if g["correct"] is None],
        "questions": graded,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
