#!/usr/bin/env python3
"""
Anonymize resident PII in the dashboard data set.

Replaces every resident name in the Rent Roll and Delinquent records with a
deterministic fictional name (consistent per unit, so the dashboard stays
coherent across tables and drill-downs). All financial figures, units, dates,
and account detail are left untouched — only personally identifying names are
changed. Any email/phone fields, if present, are cleared.

Usage:
    python3 scripts/anonymize.py            # overwrite public/data.json in place
    python3 scripts/anonymize.py out.json   # write to a different file
"""
import json
import os
import re
import sys
import hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "public", "data.json")

FIRST = [
    "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Jamie", "Avery",
    "Quinn", "Drew", "Cameron", "Reese", "Hayden", "Rowan", "Skyler", "Emerson",
    "Parker", "Sawyer", "Finley", "Dakota", "Marlowe", "Ellis", "Harper", "Blake",
    "Logan", "Spencer", "Devon", "Sidney", "Aubrey", "Bailey", "Carmen", "Devin",
]
LAST = [
    "Rivera", "Brooks", "Hayes", "Coleman", "Bennett", "Sanders", "Powell",
    "Russell", "Griffin", "Hughes", "Foster", "Bryant", "Reyes", "Murphy",
    "Sullivan", "Wallace", "Fleming", "Hampton", "Sutton", "Mercer", "Whitfield",
    "Lambert", "Donovan", "Ellison", "Pruitt", "Vaughn", "Calloway", "Sterling",
    "Ashby", "Holloway", "Marsh", "Easton", "Conley", "Forsythe", "Garrison",
]


def fake_name(key):
    h = int(hashlib.md5(key.encode()).hexdigest(), 16)
    last = LAST[h % len(LAST)]
    first = FIRST[(h // len(LAST)) % len(FIRST)]
    mid = chr(ord('A') + (h // 997) % 26)
    return f"{last}, {first} {mid}"


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else SRC
    data = json.load(open(SRC))

    replaced = 0
    memos_scrubbed = 0
    for pid, prop in data.items():
        # one fictional name per (property, unit)
        unit_name = {}

        def name_for(unit):
            if unit not in unit_name:
                unit_name[unit] = fake_name(f"{pid}:{unit}")
            return unit_name[unit]

        # Collect the real name tokens BEFORE replacing, so they can also be
        # redacted from free-text GL memos (which sometimes name a resident).
        real_tokens = set()
        for r in prop.get("rent_roll", []) + prop.get("delinquent", []):
            nm = (r.get("name") or "").strip()
            if not nm:
                continue
            # "Last, First M"  ->  parts
            parts = re.split(r"[,\s]+", nm)
            for tok in parts:
                tok = tok.strip()
                if len(tok) >= 3:  # skip middle initials
                    real_tokens.add(tok)

        for r in prop.get("rent_roll", []):
            if r.get("name"):
                r["name"] = name_for(r.get("unit", ""))
                replaced += 1
            for f in ("email", "phone"):
                if f in r:
                    r[f] = ""
        for r in prop.get("delinquent", []):
            if r.get("name"):
                r["name"] = name_for(r.get("unit", ""))
                replaced += 1
            for f in ("email", "phone"):
                if f in r:
                    r[f] = ""

        # Redact any real name token appearing in GL transaction memos.
        if real_tokens:
            token_re = re.compile(
                r"\b(" + "|".join(re.escape(t) for t in sorted(real_tokens, key=len, reverse=True)) + r")\b",
                re.IGNORECASE,
            )
            for acct in prop.get("gl", {}).get("accounts", {}).values():
                for t in acct.get("transactions", []):
                    memo = t.get("memo", "")
                    if memo and token_re.search(memo):
                        new = token_re.sub("Resident", memo)
                        new = re.sub(r"(Resident)(\s+Resident)+", r"\1", new)  # collapse runs
                        t["memo"] = new
                        memos_scrubbed += 1

    json.dump(data, open(out_path, "w"), indent=2, default=str)
    print(f"Anonymized {replaced} name fields and {memos_scrubbed} GL memos across {len(data)} properties.")
    print(f"Wrote {out_path} ({os.path.getsize(out_path):,} bytes)")


if __name__ == "__main__":
    main()
