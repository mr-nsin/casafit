#!/usr/bin/env python3
"""Check the CasaFit Material 3 screens before merging a lane.

Run from the repo root:   python tools/check.py
Exit code 0 = no errors (warnings are allowed), 1 = at least one error.
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = os.path.join(ROOT, "project")
BALANCED = ("div", "a", "button", "span", "svg", "nav", "section", "ul", "li", "label")

errors, warnings = [], []


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def check_screen(path, names):
    name = os.path.basename(path)
    s = read(path)
    if '<script src="./support.js"></script>' not in s:
        errors.append(f"{name}: missing the exact support.js line")
    if "<x-dc>" not in s or "</x-dc>" not in s:
        errors.append(f"{name}: missing <x-dc> block")
        return set()
    body = s[s.index("<x-dc>"):s.index("</x-dc>")]

    for tag in BALANCED:
        opened = len(re.findall(r"<%s[\s>]" % tag, body))
        closed = body.count("</%s>" % tag)
        if opened != closed:
            errors.append(f"{name}: <{tag}> opened {opened} times, closed {closed}")

    for size in re.findall(r"font-size:\s*(\d+)px", s):
        if int(size) < 12:
            errors.append(f"{name}: font-size {size}px is below the 12px floor")
            break
    if re.search(r"text-transform:\s*uppercase", s):
        errors.append(f"{name}: uppercase text-transform (use sentence case)")
    if re.search(r"letter-spacing:\s*[0-9.]+px", s):
        errors.append(f"{name}: positive letter-spacing (tracked labels)")
    if "fitness_center" in s:
        errors.append(f"{name}: dumbbell icon fitness_center (home workouts, no gym)")

    for m in re.finditer(r'<(?:a|button)\b[^>]*style="([^"]*)"', body):
        h = re.search(r"(?<![-\w])height:\s*(\d+)px", m.group(1))
        if h and int(h.group(1)) < 44 and "margin: -" not in m.group(1):
            warnings.append(f"{name}: tap target {h.group(1)}px tall (aim for 44px or more)")
            break

    links = set(re.findall(r'href="([^"#]+\.dc\.html)"', s))
    for link in sorted(links):
        if link not in names:
            errors.append(f"{name}: link to missing screen {link}")
    return links


def main():
    screens = sorted(glob.glob(os.path.join(PROJECT, "m3-*.dc.html")))
    names = {os.path.basename(p) for p in glob.glob(os.path.join(PROJECT, "*.dc.html"))}
    inbound = {os.path.basename(p): 0 for p in screens}
    for path in screens:
        for link in check_screen(path, names):
            if link in inbound and link != os.path.basename(path):
                inbound[link] += 1

    orphans = sorted(n for n, c in inbound.items() if c == 0)
    if orphans:
        warnings.append("not linked from any screen (fine for state boards): " + ", ".join(o[3:-8] for o in orphans))

    canvas_path = os.path.join(PROJECT, "canvas.json")
    if os.path.exists(canvas_path):
        boards = json.loads(read(canvas_path)).get("boards", {})
        for board in boards:
            if board not in names:
                errors.append(f"canvas.json: board {board} has no file")
        unlisted = sorted(n for n in names if n not in boards)
        if unlisted:
            warnings.append(f"canvas.json does not list {len(unlisted)} screen files yet (integrator updates it)")

    for line in warnings:
        print("warning:", line)
    for line in errors:
        print("ERROR:  ", line)
    print(f"\n{len(screens)} Material 3 screens checked: {len(errors)} errors, {len(warnings)} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
