# Gateway Management Services — Portfolio Performance Dashboard

A premium, institutional-grade property-management KPI dashboard for Gateway
Management Services LLC (USDA Rural Development / HUD affordable housing). Built
as a single, self-contained React application with Recharts visualizations.

It ingests RealPage / OneSite report exports for four properties — **Eagleview
Apartments, Elk Valley Manor, East West Apartments, and Tidioute Towers** — and
presents an owner-facing financial summary, an operational drill-down view, and
an aggregated portfolio summary.

## Running the prototype

```bash
npm install      # first time only
npm start        # dev server at http://localhost:3000
```

Or build a static bundle to host anywhere:

```bash
npm run build    # outputs ./build
npx serve -s build
```

There are **no external API calls** — all data is loaded from the bundled
`public/data.json`.

## Views

- **Portfolio Summary** (default landing) — aggregated units, occupancy, income,
  cash, payables, and delinquency across all four properties, plus per-property
  cards and comparison charts.
- **Owner** — occupancy, income (resident / rental-assistance / misc), cash &
  reserve balances, open payables, delinquency rate, capital expenditures, and
  income-vs-expense / income-mix / expense-category charts.
- **Operational** — occupancy & vacancy, flagged alerts, delinquency table,
  deposit deficiencies, lease-expiration pipeline (30/60/90-day highlights),
  pending move-ins, and a misc-income tracker.

Every KPI card, table row, and chart bucket is clickable and opens a slide-in
panel with the underlying transaction-level data.

## Data pipeline

Raw Excel/PDF exports live in the sibling `../Dashboard Project` folder. The
parser maps them to the KPI model:

```bash
python3 scripts/parse_reports.py   # regenerates public/data.json
```

Requires `openpyxl` and `xlrd` (`pip3 install openpyxl xlrd`).

### Source reports & key mappings

| Report | Format | Used for |
|--------|--------|----------|
| General Ledger | `.xlsx` | Cash `1116-1000`, RfR `1183-1000`, T&I `1180-1000`, payables `2110-0000`, income `512x/5311`, expenses `6xxx–8xxx`, capex `9xxx` |
| Rent Roll Detail | `.xls` | Units, occupancy, lease dates, deposits, rent |
| Delinquent & Prepaid | `.xls` | Resident / subsidy balances, aging, late counts |
| Bank Deposit Details | `.xls` | Income drill-down detail |

### Notes on affordable-housing nuances

- **Delinquency** is computed on true resident (tenant) arrears. Current-bucket
  subsidy charges are rental-assistance receivables (HUD/USDA payment timing),
  shown as a separate column for context but excluded from the headline rate.
- **Open Work Orders** has no source export in this data set, so the card
  degrades gracefully to a "Data not available" state.
- Prior-month occupancy is derived from move-in/move-out activity within the
  reporting period.

Reporting period: **May 2026** · Data as of **June 10, 2026** (most recent file
date in the set).
