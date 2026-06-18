#!/usr/bin/env python3
"""
Gateway Management — RealPage / OneSite report ingestion.

Parses the raw Excel exports in the Dashboard Project data folder for all four
properties and emits a single public/data.json consumed by the React app.

Usage:  python3 scripts/parse_reports.py
"""
import openpyxl
import xlrd
import json
import re
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.abspath(os.path.join(HERE, "..", "..", "Dashboard Project"))
OUT_PATH = os.path.abspath(os.path.join(HERE, "..", "public", "data.json"))


def safe_float(v, default=0):
    try:
        if v is None or str(v).strip() in ("", "None", "nan"):
            return default
        return float(v)
    except (ValueError, TypeError):
        return default


# ── General Ledger (.xlsx) ───────────────────────────────────
def parse_gl(filepath):
    try:
        wb = openpyxl.load_workbook(filepath)
        ws = wb.active
    except Exception:
        return {"meta": {}, "accounts": {}}

    rows = list(ws.iter_rows(values_only=True))
    meta = {}
    for row in rows[:6]:
        if row[0] and row[1]:
            meta[str(row[0]).strip().rstrip(":")] = str(row[1])

    accounts = {}
    current = None
    header_re = re.compile(r"(\d{4}-\d{4})\s*-\s*(.*?)\s*\(Balance Forward")

    for row in rows[5:]:
        cell0 = str(row[0]) if row[0] is not None else ""
        m = header_re.match(cell0)
        if m:
            num, name = m.group(1), m.group(2).strip()
            bal = safe_float(row[9])
            current = num
            accounts[num] = {
                "name": name,
                "balance_forward": bal,
                "transactions": [],
                "ending_balance": bal,
            }
        elif current and row[0] and str(row[0]).strip():
            date_str = str(row[0]).strip()
            if re.match(r"\d{2}/\d{2}/\d{4}", date_str):
                raw_bal = row[9]
                bal = None
                if raw_bal is not None and str(raw_bal).strip() not in ("", "None"):
                    bal = safe_float(raw_bal, None)
                txn = {
                    "date": date_str,
                    "doc": str(row[1] or "").strip(),
                    "memo": str(row[2] or "").strip(),
                    "jnl": str(row[6] or "").strip(),
                    "debit": safe_float(row[7]),
                    "credit": safe_float(row[8]),
                    "balance": bal,
                }
                accounts[current]["transactions"].append(txn)
                if bal is not None:
                    accounts[current]["ending_balance"] = bal

    return {"meta": meta, "accounts": accounts}


# ── Delinquent & Prepaid (.xls) ──────────────────────────────
def parse_delinquent(filepath):
    try:
        wb = xlrd.open_workbook(filepath)
        ws = wb.sheet_by_index(0)
    except Exception:
        return []

    header_row, headers = None, None
    for i in range(ws.nrows):
        row = [str(ws.cell_value(i, j)).strip() for j in range(ws.ncols)]
        if "Resh ID" in row:
            header_row, headers = i, row
            break
    if header_row is None:
        return []

    def col(row, name):
        try:
            return row[headers.index(name)]
        except ValueError:
            return ""

    out = []
    for i in range(header_row + 1, ws.nrows):
        row = [ws.cell_value(i, j) for j in range(ws.ncols)]
        if not row[0]:
            continue
        rec = {
            "unit": str(col(row, "Bldg/Unit")).strip(),
            "name": str(col(row, "Name")).strip(),
            "status": str(col(row, "Status")).strip(),
            "code": str(col(row, "Code Description")).strip(),
            "total_prepaid": safe_float(col(row, "Total Prepaid")),
            "total_delinquent": safe_float(col(row, "Total Delinquent")),
            "net_balance": safe_float(col(row, "Net Balance")),
            "current": safe_float(col(row, "Current")),
            "days_30": safe_float(col(row, "30 Days")),
            "days_60": safe_float(col(row, "60 Days")),
            "days_90": safe_float(col(row, "90+ Days")),
            "deposits_held": safe_float(col(row, "Deposits Held")),
            "outstanding_deposit": safe_float(col(row, "Outstanding Deposit")),
            "late_count": int(safe_float(col(row, "#Late"))),
            "nsf_count": int(safe_float(col(row, "#NSF"))),
        }
        if rec["unit"]:
            out.append(rec)
    return out


# ── Rent Roll Detail (.xls) ──────────────────────────────────
def parse_rent_roll(filepath):
    try:
        wb = xlrd.open_workbook(filepath)
        ws = wb.sheet_by_index(0)
    except Exception:
        return []

    # Header row contains "Resh ID" plus a unit column (Unit or Bldg/Unit).
    header_row = None
    for i in range(ws.nrows):
        row = [str(ws.cell_value(i, j)).strip().replace("\n", " ") for j in range(ws.ncols)]
        if "Resh ID" in row and any("Unit" in c for c in row):
            header_row = i
            break
    if header_row is None:
        return []

    out = []
    for i in range(header_row + 1, ws.nrows):
        row = [ws.cell_value(i, j) for j in range(ws.ncols)]
        unit = str(row[2]).strip() if len(row) > 2 else ""
        if not unit:
            continue
        out.append({
            "unit": unit,
            "floorplan": str(row[3] if len(row) > 3 else "").strip(),
            "sqft": safe_float(row[5] if len(row) > 5 else 0),
            "status": str(row[6] if len(row) > 6 else "").strip(),
            "name": str(row[7] if len(row) > 7 else "").strip(),
            "move_in": str(row[8] if len(row) > 8 else "").strip(),
            "move_out": str(row[9] if len(row) > 9 else "").strip(),
            "lease_start": str(row[10] if len(row) > 10 else "").strip(),
            "lease_end": str(row[11] if len(row) > 11 else "").strip(),
            "market_rent": safe_float(row[12] if len(row) > 12 else 0),
            "sub_journal": str(row[13] if len(row) > 13 else "").strip(),
            "required_deposit": safe_float(row[14] if len(row) > 14 else 0),
            "dep_on_hand": safe_float(row[15] if len(row) > 15 else 0),
            "balance": safe_float(row[16] if len(row) > 16 else 0),
            "lease_rent": safe_float(row[17] if len(row) > 17 else 0),
            "subrent": safe_float(row[18] if len(row) > 18 else 0),
            "resident_rent": safe_float(row[19] if len(row) > 19 else 0),
        })
    return out


# ── Bank Deposit Details (.xls) ──────────────────────────────
def parse_bank_deposit(filepath):
    try:
        wb = xlrd.open_workbook(filepath)
        ws = wb.sheet_by_index(0)
    except Exception:
        return []

    deposits, current = [], None
    for i in range(ws.nrows):
        row = [ws.cell_value(i, j) for j in range(ws.ncols)]
        cell0 = str(row[0]).strip()
        if "Bank Deposit #" in cell0:
            if current:
                deposits.append(current)
            dm = re.search(r"dated\s+(\d{2}/\d{2}/\d{4})", cell0) or re.search(r"dated\s+(\d{2}/\d{2})", cell0)
            current = {"header": cell0, "date": dm.group(1) if dm else "", "items": [], "total": 0}
        elif current:
            amounts = [safe_float(v) for v in row[1:] if v is not None and str(v).strip() not in ("", "None")]
            if "Total" in cell0 and amounts:
                current["total"] = amounts[-1]
            elif cell0 and amounts:
                current["items"].append({"description": cell0, "amount": amounts[-1]})
    if current:
        deposits.append(current)
    return deposits


PROPERTIES = [
    {"id": "eagleview", "name": "Eagleview Apartments", "short": "Eagleview",
     "gl": "General_Ledger_Report.xlsx", "dq": "Delinquent+and+Prepaid+-+Excel (3).xls",
     "rr": "Rent+Roll+Detail+-+Excel (2).xls", "bd": "Bank+Deposit+Details+-+Excel (3).xls"},
    {"id": "elk_valley", "name": "Elk Valley Manor", "short": "Elk Valley",
     "gl": "General_Ledger_Report (1).xlsx", "dq": "Delinquent+and+Prepaid+-+Excel (1).xls",
     "rr": "Rent+Roll+Detail+-+Excel (4).xls", "bd": None},
    {"id": "east_west", "name": "East West Apartments", "short": "East West",
     "gl": "General_Ledger_Report (2).xlsx", "dq": "Delinquent+and+Prepaid+-+Excel (2).xls",
     "rr": "Rent+Roll+Detail+-+Excel (3).xls", "bd": "Bank+Deposit+Details+-+Excel (2).xls"},
    {"id": "tidioute", "name": "Tidioute Towers", "short": "Tidioute",
     "gl": "General_Ledger_Report (3).xlsx", "dq": "Delinquent+and+Prepaid+-+Excel.xls",
     "rr": "Rent+Roll+Detail+-+Excel (5).xls", "bd": "Bank+Deposit+Details+-+Excel (1).xls"},
]


def main():
    result = {}
    for p in PROPERTIES:
        out = {"id": p["id"], "name": p["name"], "short": p["short"]}
        out["gl"] = parse_gl(os.path.join(DATA_DIR, p["gl"])) if p["gl"] else {"meta": {}, "accounts": {}}
        out["delinquent"] = parse_delinquent(os.path.join(DATA_DIR, p["dq"])) if p["dq"] else []
        out["rent_roll"] = parse_rent_roll(os.path.join(DATA_DIR, p["rr"])) if p["rr"] else []
        out["bank_deposits"] = parse_bank_deposit(os.path.join(DATA_DIR, p["bd"])) if p["bd"] else []
        result[p["id"]] = out
        units = len({r["unit"] for r in out["rent_roll"]})
        print(f"{p['name']:24} GL={len(out['gl']['accounts']):>3} acct  "
              f"DQ={len(out['delinquent']):>3}  RR={len(out['rent_roll']):>4} rows / {units} units  "
              f"BD={len(out['bank_deposits'])}")

    with open(OUT_PATH, "w") as f:
        json.dump(result, f, indent=2, default=str)
    print(f"\nWrote {OUT_PATH} ({os.path.getsize(OUT_PATH):,} bytes)")


if __name__ == "__main__":
    main()
