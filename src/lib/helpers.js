// ─────────────────────────────────────────────────────────────
// Gateway Management — data helpers & metric computation
// All metrics are derived in the browser from the parsed report
// exports (public/data.json) so drill-downs can reach source rows.
// ─────────────────────────────────────────────────────────────

// Reporting period: the GL activity month for this data set is May 2026.
export const PERIOD = { year: 2026, month: 5, label: 'May 2026' };
// As-of "today" for forward-looking calculations (most recent file date).
export const AS_OF = new Date(2026, 5, 10); // June 10, 2026

// ── Formatters ──────────────────────────────────────────────
export const fmtUSD = (n, decimals = 0) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
};

export const fmtUSDk = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
  return fmtUSD(n);
};

export const fmtPct = (n, decimals = 1) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toFixed(decimals) + '%';
};

export const fmtNum = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US').format(n);
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export function parseDate(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const d = new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2]));
  return isNaN(d.getTime()) ? null : d;
}

export function fmtDate(str) {
  const d = typeof str === 'string' ? parseDate(str) : str;
  if (!d) return '—';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function daysBetween(a, b) {
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// ── Account helpers ─────────────────────────────────────────
export function acct(prop, num) {
  return prop?.gl?.accounts?.[num] || null;
}
export function acctBalance(prop, num) {
  const a = acct(prop, num);
  return a ? a.ending_balance : null;
}

// Expense category mapping by GL account prefix.
export function categorizeExpense(num) {
  const p4 = num.slice(0, 4);
  const p3 = num.slice(0, 3);
  const p2 = num.slice(0, 2);
  if (p4 === '6820' || p4 === '6830' || p4 === '6821') return 'Mortgage';
  if (p4 === '6711' || p4 === '6712' || p3 === '671') return 'Taxes';
  if (p3 === '672') return 'Insurance';
  if (p3 === '662') return 'Depreciation';
  if (p2 === '64' || p2 === '65') return 'Maintenance';
  if (p2 === '63') return 'Administrative';
  return 'Other';
}

export const EXPENSE_COLORS = {
  Maintenance: '#60a5fa',
  Administrative: '#a78bfa',
  Insurance: '#2dd4bf',
  Taxes: '#fbbf24',
  Mortgage: '#f87171',
  Depreciation: '#64748b',
  Other: '#94a3b8',
};

// ── Core metric computation for a single property ───────────
export function computeMetrics(prop) {
  if (!prop) return null;
  const accounts = prop.gl?.accounts || {};
  const rr = prop.rent_roll || [];
  const dq = prop.delinquent || [];

  // ---- Income (GL is canonical; credit balances on income accts) ----
  const residentIncome = Math.abs(acctBalance(prop, '5120-0000') ?? 0);
  const subsidyIncome = Math.abs(acctBalance(prop, '5121-0000') ?? 0);
  // Misc income: any 53xx account (laundry, etc.)
  let miscIncome = 0;
  Object.entries(accounts).forEach(([num, a]) => {
    if (num.startsWith('53')) miscIncome += Math.abs(a.ending_balance || 0);
  });
  const totalIncome = residentIncome + subsidyIncome + miscIncome;

  // Capital accounts per Gateway definition: 6589-XXXX and 9120-XXXX.
  const isCapex = (num) => num.startsWith('6589') || num.startsWith('9120');

  // ---- Expenses by category (6xxx–8xxx; debit balances) ----
  // Capital accounts (6589-xxxx) are excluded here so they are not double-counted.
  const expenseByCat = {};
  const expenseAccounts = [];
  let totalExpenses = 0;
  Object.entries(accounts).forEach(([num, a]) => {
    const first = num[0];
    if ((first === '6' || first === '7' || first === '8') && !isCapex(num)) {
      const amt = a.ending_balance || 0;
      if (Math.abs(amt) < 0.005) return;
      const cat = categorizeExpense(num);
      expenseByCat[cat] = (expenseByCat[cat] || 0) + amt;
      expenseAccounts.push({ num, name: a.name, amount: amt, cat });
      totalExpenses += amt;
    }
  });

  // ---- Capital expenditures (6589-XXXX and 9120-XXXX) ----
  const capexAccounts = [];
  let totalCapex = 0;
  Object.entries(accounts).forEach(([num, a]) => {
    if (isCapex(num)) {
      const amt = a.ending_balance || 0;
      if (Math.abs(amt) < 0.005) return;
      capexAccounts.push({ num, name: a.name, amount: amt });
      totalCapex += amt;
    }
  });

  // ---- Balances ----
  const cash = acctBalance(prop, '1116-1000');
  const rfr = acctBalance(prop, '1183-1000');
  const ti = acctBalance(prop, '1180-1000');
  const apRaw = acctBalance(prop, '2110-0000');
  const payables = apRaw === null ? null : Math.abs(apRaw);

  // ---- Occupancy (dedup rent roll by unit, prefer RESIDENT row) ----
  const unitMap = {};
  rr.forEach((r) => {
    if (!unitMap[r.unit]) unitMap[r.unit] = { resident: null, subsidy: null, rows: [] };
    if (r.sub_journal === 'SUBSIDY') unitMap[r.unit].subsidy = r;
    else unitMap[r.unit].resident = r;
    unitMap[r.unit].rows.push(r);
  });
  const units = Object.entries(unitMap).map(([unit, v]) => {
    const base = v.resident || v.subsidy || v.rows[0];
    return {
      unit,
      name: base.name,
      status: base.status,
      floorplan: base.floorplan,
      sqft: base.sqft,
      move_in: base.move_in,
      move_out: base.move_out,
      lease_start: base.lease_start,
      lease_end: base.lease_end,
      market_rent: base.market_rent,
      required_deposit: base.required_deposit,
      dep_on_hand: base.dep_on_hand,
      resident_rent: v.resident ? v.resident.lease_rent : 0,
      subsidy_rent: v.subsidy ? v.subsidy.lease_rent : 0,
      total_rent: (v.resident ? v.resident.lease_rent : 0) + (v.subsidy ? v.subsidy.lease_rent : 0),
      hasSubsidy: !!(v.subsidy && v.subsidy.lease_rent > 0),
    };
  });

  const totalUnits = units.length;
  const isVacant = (s) => /vacant/i.test(s);
  const isPending = (s) => /pending|notice|pre-?lease|applicant/i.test(s) && !/vacant/i.test(s);
  const vacantUnits = units.filter((u) => isVacant(u.status));
  const occupiedUnits = units.filter((u) => !isVacant(u.status));
  const pendingUnits = units.filter((u) => {
    const mi = parseDate(u.move_in);
    return (isVacant(u.status) && mi && mi > AS_OF) || isPending(u.status);
  });
  const occupied = occupiedUnits.length;
  const vacant = vacantUnits.length;
  const occupancyRate = totalUnits ? (occupied / totalUnits) * 100 : 0;

  // Prior-month occupancy derived from move activity within the period.
  const inPeriod = (d) => d && d.getFullYear() === PERIOD.year && d.getMonth() === PERIOD.month - 1;
  const moveInsThisPeriod = units.filter((u) => inPeriod(parseDate(u.move_in))).length;
  const moveOutsThisPeriod = units.filter((u) => inPeriod(parseDate(u.move_out))).length;
  const priorOccupied = occupied - moveInsThisPeriod + moveOutsThisPeriod;
  const priorOccRate = totalUnits ? (priorOccupied / totalUnits) * 100 : 0;
  const occDelta = occupancyRate - priorOccRate;

  // Vacant units with days vacant
  const vacantDetail = vacantUnits.map((u) => {
    const mo = parseDate(u.move_out);
    const daysVacant = mo ? daysBetween(mo, AS_OF) : null;
    return { ...u, daysVacant };
  }).sort((a, b) => (b.daysVacant || 0) - (a.daysVacant || 0));

  // ---- Property subsidy classification ----
  const propHasSubsidy = units.some((u) => u.hasSubsidy) || subsidyIncome > 0;

  // ---- Delinquency (aggregate by unit) ----
  const dqByUnit = {};
  dq.forEach((r) => {
    const key = r.unit;
    if (!dqByUnit[key]) {
      dqByUnit[key] = {
        unit: r.unit, name: r.name, status: r.status,
        resident_balance: 0, subsidy_balance: 0, total: 0,
        current: 0, d30: 0, d60: 0, d90: 0,
        late: 0, nsf: 0, rows: [],
      };
    }
    const g = dqByUnit[key];
    const isSub = /SUBRENT|SUBSIDY/i.test(r.code);
    if (isSub) g.subsidy_balance += r.net_balance;
    else g.resident_balance += r.net_balance;
    g.total += r.net_balance;
    g.current += r.current;
    g.d30 += r.days_30;
    g.d60 += r.days_60;
    g.d90 += r.days_90;
    g.late = Math.max(g.late, r.late_count);
    g.nsf = Math.max(g.nsf, r.nsf_count);
    if (!r.name && g.name) {} else if (r.name) g.name = r.name;
    g.rows.push(r);
  });
  // A unit counts as delinquent on true tenant arrears: a positive resident
  // (non-subsidy) balance, or any amount aged past current. Current-bucket
  // subsidy charges are rental-assistance receivables (HUD/USDA timing), not
  // resident delinquency, so they are shown for context but excluded from the
  // headline rate.
  const delinquentUnits = Object.values(dqByUnit)
    .map((u) => {
      // True tenant delinquency = positive resident (non-subsidy) balance.
      const delinquentAmount = u.resident_balance > 0 ? u.resident_balance : 0;
      let bucket = 'Current';
      if (u.d90 > 0) bucket = '90+';
      else if (u.d60 > 0) bucket = '60';
      else if (u.d30 > 0) bucket = '30';
      const subsidyAnomaly = !propHasSubsidy && Math.abs(u.subsidy_balance) > 0.005;
      return { ...u, bucket, subsidyAnomaly, delinquentAmount };
    })
    .filter((u) => u.delinquentAmount > 0.005 || u.subsidyAnomaly)
    .sort((a, b) => b.delinquentAmount - a.delinquentAmount);

  const totalDelinquent = delinquentUnits.reduce((s, u) => s + u.delinquentAmount, 0);

  // Total monthly billed rent (gross potential / actual charges = resident + subsidy).
  const monthlyRentRoll = units.reduce((s, u) => s + u.total_rent, 0);

  // Delinquency rate (Gateway definition): current-month resident rent still
  // owed (the "Current" aging bucket for resident charges only) ÷ total monthly
  // billed rent. Older past-due and subsidy receivables are excluded.
  const currentRentDelinquent = dq.reduce((s, r) => {
    const isSub = /SUBRENT|SUBSIDY/i.test(r.code);
    return isSub ? s : s + Math.max(0, r.current || 0);
  }, 0);
  const delinquencyRate = monthlyRentRoll ? (currentRentDelinquent / monthlyRentRoll) * 100 : 0;

  // ---- Deposit deficiencies ----
  const depositDeficiencies = units
    .filter((u) => u.required_deposit > 0 && u.dep_on_hand < u.required_deposit - 0.005)
    .map((u) => ({
      unit: u.unit, name: u.name,
      required: u.required_deposit, onHand: u.dep_on_hand,
      shortfall: u.required_deposit - u.dep_on_hand,
    }))
    .sort((a, b) => b.shortfall - a.shortfall);

  // ---- Lease expiration pipeline (forward 12 months) ----
  const pipeline = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(AS_OF.getFullYear(), AS_OF.getMonth() + i, 1);
    pipeline.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: MONTHS[d.getMonth()].slice(0, 3) + " '" + String(d.getFullYear()).slice(2),
      monthDate: d,
      count: 0,
      leases: [],
      within30: false, within60: false, within90: false,
    });
  }
  const d30 = new Date(AS_OF); d30.setDate(d30.getDate() + 30);
  const d60 = new Date(AS_OF); d60.setDate(d60.getDate() + 60);
  const d90 = new Date(AS_OF); d90.setDate(d90.getDate() + 90);
  let expiredHoldover = 0;
  units.forEach((u) => {
    const le = parseDate(u.lease_end);
    if (!le) return;
    if (le < AS_OF) { expiredHoldover++; return; }
    const bIdx = pipeline.findIndex(
      (b) => b.monthDate.getFullYear() === le.getFullYear() && b.monthDate.getMonth() === le.getMonth()
    );
    if (bIdx >= 0) {
      pipeline[bIdx].count++;
      pipeline[bIdx].leases.push({ unit: u.unit, name: u.name, lease_end: u.lease_end, total_rent: u.total_rent });
      if (le <= d30) pipeline[bIdx].within30 = true;
      else if (le <= d60) pipeline[bIdx].within60 = true;
      else if (le <= d90) pipeline[bIdx].within90 = true;
    }
  });

  // ---- Certification expiration / recertification (derived) ----
  // The reports carry no explicit recertification date, so annual recert dates
  // are derived from the move-in anniversary (the standard USDA/HUD cycle).
  // This drives both the Certification Expiration pipeline and the recert panel.
  // `recertDatesAvailable` is false to flag that these are derived, not sourced.
  const recertDatesAvailable = false;
  const certPipeline = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(AS_OF.getFullYear(), AS_OF.getMonth() + i, 1);
    certPipeline.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: MONTHS[d.getMonth()].slice(0, 3) + " '" + String(d.getFullYear()).slice(2),
      monthDate: d,
      count: 0,
      leases: [],
      within30: false, within60: false, within90: false,
    });
  }
  const recerts = [];
  occupiedUnits.forEach((u) => {
    const mi = parseDate(u.move_in);
    if (!mi) return;
    // next anniversary of move-in on/after the as-of date
    let next = new Date(AS_OF.getFullYear(), mi.getMonth(), mi.getDate());
    if (next < AS_OF) next = new Date(AS_OF.getFullYear() + 1, mi.getMonth(), mi.getDate());
    const daysUntil = daysBetween(AS_OF, next);
    recerts.push({ unit: u.unit, name: u.name, move_in: u.move_in, nextRecert: next, daysUntil });
    const bIdx = certPipeline.findIndex(
      (b) => b.monthDate.getFullYear() === next.getFullYear() && b.monthDate.getMonth() === next.getMonth()
    );
    if (bIdx >= 0) {
      certPipeline[bIdx].count++;
      certPipeline[bIdx].leases.push({ unit: u.unit, name: u.name, lease_end: fmtDate(next), total_rent: u.total_rent });
      if (next <= d30) certPipeline[bIdx].within30 = true;
      else if (next <= d60) certPipeline[bIdx].within60 = true;
      else if (next <= d90) certPipeline[bIdx].within90 = true;
    }
  });
  recerts.sort((a, b) => a.nextRecert - b.nextRecert);
  const recertsUpcoming = recerts.filter((r) => r.daysUntil >= 0 && r.daysUntil <= 90);

  // ---- Pending move-ins ----
  const pendingMoveIns = units
    .map((u) => ({ ...u, mi: parseDate(u.move_in) }))
    .filter((u) => u.mi && u.mi > AS_OF)
    .sort((a, b) => a.mi - b.mi)
    .map((u) => ({ unit: u.unit, name: u.name, move_in: u.move_in }));

  // ---- Pending move-outs (#8) ----
  // Requires move-out notice dates, which are not present in the rent roll
  // (all move-out fields are blank). Flagged so the UI can mark it.
  const moveOutDatesAvailable = units.some((u) => parseDate(u.move_out));
  const pendingMoveOuts = units
    .map((u) => ({ ...u, mo: parseDate(u.move_out) }))
    .filter((u) => u.mo && u.mo >= AS_OF)
    .sort((a, b) => a.mo - b.mo)
    .map((u) => ({ unit: u.unit, name: u.name, move_out: u.move_out }));

  return {
    // income
    residentIncome, subsidyIncome, miscIncome, totalIncome,
    // expenses
    expenseByCat, expenseAccounts, totalExpenses,
    capexAccounts, totalCapex,
    // balances
    cash, rfr, ti, payables,
    // occupancy
    totalUnits, occupied, vacant, occupancyRate, occDelta, priorOccRate,
    moveInsThisPeriod, moveOutsThisPeriod,
    units, vacantDetail, pendingMoveIns, pendingCount: pendingUnits.length,
    // occupancy comparisons (#1) — require historical snapshots not in the data
    occ3moAvg: null, occYoY: null, occHistoryAvailable: false,
    // delinquency
    delinquentUnits, totalDelinquent, delinquencyRate, currentRentDelinquent,
    monthlyRentRoll, propHasSubsidy,
    // deposits
    depositDeficiencies,
    // leases (retained) + certification / recertification (#5)
    pipeline, expiredHoldover, d30, d60, d90,
    certPipeline, recerts, recertsUpcoming, recertDatesAvailable,
    // move-outs (#8)
    pendingMoveOuts, moveOutDatesAvailable,
    // misc
    bankDeposits: prop.bank_deposits || [],
    // open work orders — no source file present in data set
    workOrders: null,
  };
}

// Aggregate portfolio metrics across all properties.
export function computePortfolio(allMetrics) {
  const list = Object.values(allMetrics);
  const sum = (f) => list.reduce((s, m) => s + (f(m) || 0), 0);
  const totalUnits = sum((m) => m.totalUnits);
  const occupied = sum((m) => m.occupied);
  return {
    totalUnits,
    occupied,
    vacant: sum((m) => m.vacant),
    occupancyRate: totalUnits ? (occupied / totalUnits) * 100 : 0,
    totalIncome: sum((m) => m.totalIncome),
    totalExpenses: sum((m) => m.totalExpenses),
    totalCapex: sum((m) => m.totalCapex),
    cash: sum((m) => m.cash),
    rfr: sum((m) => m.rfr),
    ti: sum((m) => m.ti),
    payables: sum((m) => m.payables),
    totalDelinquent: sum((m) => m.totalDelinquent),
    currentRentDelinquent: sum((m) => m.currentRentDelinquent),
    monthlyRentRoll: sum((m) => m.monthlyRentRoll),
    delinquencyRate: sum((m) => m.monthlyRentRoll)
      ? (sum((m) => m.currentRentDelinquent) / sum((m) => m.monthlyRentRoll)) * 100 : 0,
    residentIncome: sum((m) => m.residentIncome),
    subsidyIncome: sum((m) => m.subsidyIncome),
    miscIncome: sum((m) => m.miscIncome),
  };
}
