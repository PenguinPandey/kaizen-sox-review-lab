#!/usr/bin/env python3
"""Independent check of data/people.js.

Re-implements the finding rules in Python (no JavaScript involved) and prints the counts, so you can
compare them with the numbers the browser engine shows. Also checks structure: totals, references,
manager chains, role/system consistency.

Run:  python tools/validate_data.py        (exit code 1 on any structural error)
"""
import json
import os
import re
import sys
from collections import Counter
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(name, var):
    txt = open(os.path.join(ROOT, "data", name), encoding="utf-8").read()
    txt = re.sub(r"^\s*window\.%s\s*=\s*" % var, "", txt).strip().rstrip(";")
    return json.loads(txt)


REF = load("reference.js", "KAI_REF")
DATA = load("people.js", "KAI_DATA")
ASOF = date.fromisoformat(REF["org"]["asOf"])
people = {p["id"]: p for p in DATA["people"]}
roles = {r["id"]: r for r in REF["roles"]}
accts = DATA["accounts"]
errors = []


def err(msg):
    errors.append(msg)


def days(a, b):
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


# ---- structure
expected = {s["id"]: s["target"] for s in REF["systems"]}
got = Counter(a["sys"] for a in accts)
for k, v in expected.items():
    if got[k] != v:
        err("system %s has %d accounts, expected %d" % (k, got[k], v))
if len({a["id"] for a in accts}) != len(accts):
    err("duplicate account ids")
for a in accts:
    for r in a["roles"]:
        if r not in roles:
            err("%s unknown role %s" % (a["id"], r))
        elif roles[r]["sys"] != a["sys"]:
            err("%s role %s belongs to %s" % (a["id"], r, roles[r]["sys"]))
    if a["person"] and a["person"] not in people:
        err("%s unknown person" % a["id"])
    if a["owner"] and a["owner"] not in people:
        err("%s unknown owner" % a["id"])
for p in people.values():
    seen, cur = set(), p
    while cur["managerId"]:
        if cur["id"] in seen:
            err("manager cycle at " + cur["id"])
            break
        seen.add(cur["id"])
        cur = people.get(cur["managerId"])
        if cur is None:
            err("dangling manager for " + p["id"])
            break
for ex in DATA["exceptions"]:
    for k in ("personId", "reviewerId", "approverId"):
        if ex[k] not in people:
            err("exception %s unknown %s" % (ex["id"], k))
    for c in ex["controls"]:
        if c not in REF["controls"]:
            err("exception %s unknown control %s" % (ex["id"], c))
for rule in REF["sodRules"]:
    for c in rule["a"] + rule["b"]:
        if c not in REF["capabilities"]:
            err("rule %s unknown capability %s" % (rule["id"], c))

# ---- findings
by_kind = Counter()
caps = {}
for a in accts:
    if a["person"]:
        c = caps.setdefault(a["person"], set())
        for r in a["roles"]:
            c.update(roles[r]["caps"])

for a in accts:
    p = people.get(a["person"]) if a["person"] else None
    owner = people.get(a["owner"]) if a["owner"] else None
    leaver = bool(p and p["status"] == "Terminated")
    if leaver:
        by_kind["leaver"] += 1
    if p and p["status"] == "Active" and p["type"] == "Contractor" and p.get("contractEnd") and p["contractEnd"] < REF["org"]["asOf"]:
        by_kind["contractor"] += 1
    if a["type"] == "Generic":
        by_kind["generic"] += 1
    if a["type"] != "Named" and owner and owner["status"] == "Terminated":
        by_kind["svcowner"] += 1
    if a["type"] == "Named" and not leaver:
        never = a["lastLogin"] is None and days(a["created"], REF["org"]["asOf"]) >= 30
        if never or (a["lastLogin"] and days(a["lastLogin"], REF["org"]["asOf"]) > 90):
            by_kind["dormant"] += 1
        if any(roles[r]["depts"] and p["dept"] not in roles[r]["depts"] for r in a["roles"]):
            by_kind["mismatch"] += 1
    if a["type"] == "Named" and not a["ticket"]:
        by_kind["noticket"] += 1

by_rule = Counter()
for pid, c in caps.items():
    if people[pid]["status"] != "Active":
        continue
    for rule in REF["sodRules"]:
        if any(x in c for x in rule["a"]) and any(x in c for x in rule["b"]):
            by_rule[rule["id"]] += 1

print("Accounts per system:", dict(got), "| people:", len(people))
print("Account-level findings:", dict(by_kind))
print("SoD conflicts by rule:", dict(sorted(by_rule.items())), "| total", sum(by_rule.values()))
print("Exceptions seeded:", len(DATA["exceptions"]))
if errors:
    print("\nSTRUCTURAL ERRORS:")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("\nStructure OK.")
