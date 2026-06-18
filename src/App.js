import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import {
  fmtUSD, fmtUSDk, fmtPct, fmtNum, fmtDate,
  computeMetrics, computePortfolio, acct, EXPENSE_COLORS, AS_OF,
} from './lib/helpers';
import DrillModal from './components/DrillModal';

const PROP_ORDER = ['eagleview', 'elk_valley', 'east_west', 'tidioute'];
const INCOME_COLORS = { resident: '#fbbf24', subsidy: '#60a5fa', misc: '#2dd4bf' };

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState('portfolio'); // 'portfolio' | property id
  const [view, setView] = useState('owner'); // 'owner' | 'operational'
  const [drill, setDrill] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('gw-theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('gw-theme', theme);
  }, [theme]);

  useEffect(() => {
    fetch(process.env.PUBLIC_URL + '/data.json')
      .then((r) => { if (!r.ok) throw new Error('Failed to load data'); return r.json(); })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const allMetrics = useMemo(() => {
    if (!data) return null;
    const out = {};
    PROP_ORDER.forEach((id) => { if (data[id]) out[id] = computeMetrics(data[id]); });
    return out;
  }, [data]);

  const portfolio = useMemo(() => allMetrics ? computePortfolio(allMetrics) : null, [allMetrics]);

  if (error) {
    return <div className="loading"><div className="loading-text">{error}</div></div>;
  }
  if (!data || !allMetrics) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <div className="loading-text">Loading portfolio data…</div>
      </div>
    );
  }

  const isPortfolio = selected === 'portfolio';
  const prop = isPortfolio ? null : data[selected];
  const metrics = isPortfolio ? null : allMetrics[selected];

  return (
    <div className="app">
      <Header theme={theme} setTheme={setTheme} />
      <SubBar
        data={data} selected={selected} setSelected={setSelected}
        view={view} setView={setView} isPortfolio={isPortfolio}
      />
      <div className="main">
        {isPortfolio ? (
          <PortfolioView
            data={data} allMetrics={allMetrics} portfolio={portfolio}
            onSelect={setSelected} setDrill={setDrill}
          />
        ) : view === 'owner' ? (
          <OwnerView prop={prop} m={metrics} setDrill={setDrill} />
        ) : (
          <OperationalView prop={prop} m={metrics} setDrill={setDrill} />
        )}
      </div>
      <DrillModal drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

// ── Header ──────────────────────────────────────────────────
function Header({ theme, setTheme }) {
  const isDark = theme === 'dark';
  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo">
          <div className="logo-mark">GW</div>
          <div className="logo-text">
            <div className="logo-name">Gateway Management Services</div>
            <div className="logo-sub">Portfolio Performance Dashboard</div>
          </div>
        </div>
        <div className="header-meta">
          <div className="last-updated">
            Reporting period <strong>May 2026</strong><br />
            Data as of <strong>{fmtDate(AS_OF)}</strong>
          </div>
          <a className="header-link" href={`${process.env.PUBLIC_URL}/validation.html`} title="View data validation summary">Validation ↗</a>
          <span className="period-badge">USDA RD · HUD</span>
          <button
            className="theme-toggle"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle color theme"
          >
            {isDark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

// ── Sub bar (property tabs + view toggle) ───────────────────
function SubBar({ data, selected, setSelected, view, setView, isPortfolio }) {
  return (
    <div className="subbar">
      <div className="subbar-inner">
        <div className="prop-tabs">
          <button className={`prop-tab ${selected === 'portfolio' ? 'active' : ''}`} onClick={() => setSelected('portfolio')}>
            Portfolio
          </button>
          {PROP_ORDER.map((id) => data[id] && (
            <button key={id} className={`prop-tab ${selected === id ? 'active' : ''}`} onClick={() => setSelected(id)}>
              {data[id].name}
            </button>
          ))}
        </div>
        {!isPortfolio && (
          <div className="view-toggle">
            <button className={`view-btn ${view === 'owner' ? 'active' : ''}`} onClick={() => setView('owner')}>Owner</button>
            <button className={`view-btn ${view === 'operational' ? 'active' : ''}`} onClick={() => setView('operational')}>Operational</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared KPI card ─────────────────────────────────────────
function KpiCard({ label, icon, value, valueSmall, sub, breakdown, accent, variant, onClick }) {
  return (
    <div className={`kpi-card ${variant || ''}`} onClick={onClick}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        {icon && <span className="kpi-icon">{icon}</span>}
      </div>
      {value === null || value === undefined ? (
        <div className="data-na">Data not available</div>
      ) : (
        <>
          <div className={`kpi-value ${valueSmall ? 'small' : ''}`}>{value}</div>
          {sub && <div className="kpi-sub">{sub}</div>}
          {breakdown && (
            <div className="kpi-breakdown">
              {breakdown.map((b, i) => (
                <div key={i} className="kpi-bd-row">
                  <span className="kpi-bd-label">
                    {b.color && <span className="kpi-bd-dot" style={{ background: b.color }} />}{b.label}
                  </span>
                  <span className="kpi-bd-val">{b.value}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {accent && <div className={`kpi-accent ${accent}`} />}
    </div>
  );
}

// ── Chart tooltip ───────────────────────────────────────────
function ChartTip({ active, payload, label, money }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: 'var(--navy-950)', border: '1px solid var(--navy-600)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      {label && <div style={{ color: 'var(--slate-300)', fontWeight: 600, marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || p.payload.fill, display: 'flex', justifyContent: 'space-between', gap: 14 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 700 }}>{money ? fmtUSD(p.value) : fmtNum(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// OWNER VIEW
// ═══════════════════════════════════════════════════════════
function OwnerView({ prop, m, setDrill }) {
  const occUp = m.occDelta >= 0;
  const incomePie = [
    { name: 'Resident Rent', key: 'resident', value: m.residentIncome, fill: INCOME_COLORS.resident },
    { name: 'Rental Assistance', key: 'subsidy', value: m.subsidyIncome, fill: INCOME_COLORS.subsidy },
    { name: 'Miscellaneous', key: 'misc', value: m.miscIncome, fill: INCOME_COLORS.misc },
  ].filter((d) => d.value > 0);

  const ieCombined = [
    { name: 'May 2026', Income: m.totalIncome, Expenses: m.totalExpenses, Capex: m.totalCapex },
  ];

  const expenseData = Object.entries(m.expenseByCat)
    .map(([cat, amt]) => ({ name: cat, value: amt, fill: EXPENSE_COLORS[cat] || EXPENSE_COLORS.Other }))
    .sort((a, b) => b.value - a.value);

  const openGL = (num) => {
    const a = acct(prop, num);
    setDrill({ type: 'gl', eyebrow: 'General Ledger', title: a ? `${num} · ${a.name}` : num,
      sub: 'Account transaction detail for the period', payload: { account: a } });
  };

  return (
    <>
      <div className="view-heading">
        <h1>{prop.name} — Owner Summary</h1>
        <p>Financial position and performance for the May 2026 reporting period</p>
      </div>

      <div className="section-title">Performance & Income</div>
      <div className="kpi-grid kpi-grid-4" style={{ marginTop: 14 }}>
        <KpiCard
          label="Occupancy Rate" accent={occUp ? 'green' : 'red'}
          value={fmtPct(m.occupancyRate)}
          sub={<><span className={occUp ? 'up' : 'down'}>{occUp ? '▲' : '▼'} {fmtPct(Math.abs(m.occDelta))}</span> vs. prior month · {m.occupied}/{m.totalUnits} units</>}
          onClick={() => setDrill({ type: 'occupancy', eyebrow: 'Occupancy', title: `${prop.name} — Occupancy`,
            sub: `${m.occupied} of ${m.totalUnits} units occupied`, payload: { ...m, pending: m.pendingCount } })}
        />
        <KpiCard
          label="Total Income" accent="green"
          value={fmtUSD(m.totalIncome)}
          breakdown={[
            { label: 'Resident Rent', value: fmtUSD(m.residentIncome), color: INCOME_COLORS.resident },
            { label: 'Rental Assistance', value: fmtUSD(m.subsidyIncome), color: INCOME_COLORS.subsidy },
            { label: 'Miscellaneous', value: fmtUSD(m.miscIncome), color: INCOME_COLORS.misc },
          ]}
          onClick={() => setDrill({ type: 'income', eyebrow: 'Income', title: `${prop.name} — Income Detail`,
            sub: 'Bank deposit transactions for the period',
            payload: { residentIncome: m.residentIncome, subsidyIncome: m.subsidyIncome, miscIncome: m.miscIncome, totalIncome: m.totalIncome, deposits: m.bankDeposits } })}
        />
        <KpiCard
          label="Delinquency Rate" variant={m.delinquencyRate > 5 ? 'warning' : ''}
          accent={m.delinquencyRate > 5 ? 'red' : undefined}
          value={fmtPct(m.delinquencyRate)}
          sub={<>{fmtUSD(m.totalDelinquent)} of {fmtUSD(m.monthlyRentRoll)} rent roll · {m.delinquentUnits.length} units</>}
          onClick={() => setDrill({ type: 'delinquency-card', eyebrow: 'Delinquency', title: `${prop.name} — Delinquency`,
            sub: 'Outstanding resident & subsidy balances', payload: m })}
        />
        <KpiCard
          label="Capital Expenditures" variant="capex"
          value={fmtUSD(m.totalCapex)}
          sub={m.totalCapex > 0 ? `${m.capexAccounts.length} capital project${m.capexAccounts.length !== 1 ? 's' : ''} (9xxx)` : 'No capital activity this period'}
          onClick={() => setDrill({ type: 'capex', eyebrow: 'Capital', title: `${prop.name} — Capital Expenditures`,
            sub: 'GL entries to 9xxx capital accounts',
            payload: { total: m.totalCapex, accounts: m.capexAccounts.map((a) => ({ ...a, transactions: acct(prop, a.num)?.transactions })) } })}
        />
      </div>

      <div className="section-title" style={{ marginTop: 24 }}>Balances & Reserves</div>
      <div className="kpi-grid kpi-grid-4" style={{ marginTop: 14 }}>
        <KpiCard label="Operating Cash" accent="blue" value={fmtUSD(m.cash)} valueSmall
          sub="GL 1116-1000 · Cash in Bank" onClick={() => openGL('1116-1000')} />
        <KpiCard label="Reserve for Replacement" valueSmall
          value={m.rfr !== null ? fmtUSD(m.rfr) : null}
          sub="GL 1183-1000" onClick={() => openGL('1183-1000')} />
        <KpiCard label="Tax & Insurance Reserve" valueSmall
          value={m.ti !== null ? fmtUSD(m.ti) : null}
          sub="GL 1180-1000" onClick={() => openGL('1180-1000')} />
        <KpiCard label="Open Payables" valueSmall variant={m.payables > 10000 ? 'warning' : ''}
          value={m.payables !== null ? fmtUSD(m.payables) : null}
          sub="GL 2110-0000 · Accounts Payable" onClick={() => openGL('2110-0000')} />
      </div>

      <div className="section-title" style={{ marginTop: 28 }}>Income, Expenses & Capital</div>
      <div className="charts-row" style={{ marginTop: 14 }}>
        <div className="chart-card">
          <div className="chart-title">Income vs. Expenses</div>
          <div className="chart-sub">May 2026 · operating</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ieCombined} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--navy-700)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--slate-400)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--slate-400)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtUSDk} />
              <Tooltip content={<ChartTip money />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="Income" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={64} />
              <Bar dataKey="Expenses" fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={64} />
              <Bar dataKey="Capex" fill="#fbbf24" radius={[4, 4, 0, 0]} maxBarSize={64} />
            </BarChart>
          </ResponsiveContainer>
          <div className="legend" style={{ flexDirection: 'row', gap: 16, justifyContent: 'center' }}>
            <span className="legend-left"><span className="legend-dot" style={{ background: '#22c55e' }} />Income {fmtUSDk(m.totalIncome)}</span>
            <span className="legend-left"><span className="legend-dot" style={{ background: '#f87171' }} />Expenses {fmtUSDk(m.totalExpenses)}</span>
            <span className="legend-left"><span className="legend-dot" style={{ background: '#fbbf24' }} />Capex {fmtUSDk(m.totalCapex)}</span>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-title">Income Breakdown</div>
          <div className="chart-sub">Total {fmtUSD(m.totalIncome)}</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={incomePie} dataKey="value" nameKey="name" cx="50%" cy="50%"
                innerRadius={55} outerRadius={80} paddingAngle={2} stroke="none">
                {incomePie.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip content={<ChartTip money />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="legend">
            {incomePie.map((d) => (
              <div key={d.key} className="legend-item">
                <span className="legend-left"><span className="legend-dot" style={{ background: d.fill }} />{d.name}</span>
                <span className="legend-val">{fmtUSD(d.value)} · {fmtPct(m.totalIncome ? (d.value / m.totalIncome) * 100 : 0)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card" onClick={() => setDrill({ type: 'expenses', eyebrow: 'Expenses', title: `${prop.name} — Operating Expenses`, sub: 'Categorized expense detail', payload: { total: m.totalExpenses, byCat: m.expenseByCat, accounts: m.expenseAccounts } })} style={{ cursor: 'pointer' }}>
          <div className="chart-title">Expense Categories</div>
          <div className="chart-sub">Total {fmtUSD(m.totalExpenses)} · click for detail</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={expenseData} layout="vertical" margin={{ left: 8, right: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--navy-700)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--slate-400)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtUSDk} />
              <YAxis type="category" dataKey="name" tick={{ fill: 'var(--slate-300)', fontSize: 11 }} axisLine={false} tickLine={false} width={92} />
              <Tooltip content={<ChartTip money />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {expenseData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                <LabelList dataKey="value" position="right" formatter={fmtUSDk} fill="var(--slate-400)" fontSize={10} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// OPERATIONAL VIEW
// ═══════════════════════════════════════════════════════════
function OperationalView({ prop, m, setDrill }) {
  const pipelineData = m.pipeline.map((b) => {
    let fill = '#475569';
    if (b.within30) fill = '#ef4444';
    else if (b.within60) fill = '#f59e0b';
    else if (b.within90) fill = '#fbbf24';
    else if (b.count > 0) fill = '#60a5fa';
    return { ...b, fill };
  });

  const next90 = m.pipeline.filter((b) => b.within30 || b.within60 || b.within90)
    .reduce((s, b) => s + b.count, 0);

  return (
    <>
      <div className="view-heading">
        <h1>{prop.name} — Operations</h1>
        <p>Occupancy, delinquency, deposits and lease activity · May 2026</p>
      </div>

      {/* Operational KPI cards */}
      <div className="kpi-grid kpi-grid-5" style={{ marginTop: 4 }}>
        <KpiCard label="Occupancy" value={`${m.occupied}/${m.totalUnits}`} valueSmall
          sub={`${fmtPct(m.occupancyRate)} occupied · ${m.vacant} vacant`}
          onClick={() => setDrill({ type: 'occupancy', eyebrow: 'Occupancy', title: `${prop.name} — Occupancy`, sub: `${m.occupied} of ${m.totalUnits} occupied`, payload: { ...m, pending: m.pendingCount } })} />
        <KpiCard label="Operating Cash" value={fmtUSD(m.cash)} valueSmall accent="blue"
          sub="GL 1116-1000" onClick={() => { const a = acct(prop, '1116-1000'); setDrill({ type: 'gl', eyebrow: 'General Ledger', title: `1116-1000 · ${a?.name || ''}`, sub: 'Cash account transactions', payload: { account: a } }); }} />
        <KpiCard label="Open Payables" value={m.payables != null ? fmtUSD(m.payables) : null} valueSmall
          variant={m.payables > 10000 ? 'warning' : ''}
          sub="GL 2110-0000" onClick={() => { const a = acct(prop, '2110-0000'); setDrill({ type: 'gl', eyebrow: 'Accounts Payable', title: `2110-0000 · ${a?.name || ''}`, sub: 'Open AP invoice detail', payload: { account: a } }); }} />
        <KpiCard label="Open Work Orders"
          value={m.workOrders === null ? null : fmtNum(m.workOrders)}
          sub={m.workOrders === null ? undefined : 'oldest open order'} />
        <KpiCard label="Misc. Income (MTD)" value={fmtUSD(m.miscIncome)} valueSmall
          variant={m.miscIncome === 0 ? 'warning' : ''}
          sub={m.miscIncome === 0 ? <span className="warn">Zero posted mid-month</span> : 'Laundry & other (53xx)'}
          onClick={() => { const a = acct(prop, '5311-0000'); setDrill({ type: 'gl', eyebrow: 'Misc. Income', title: `5311-0000 · ${a?.name || 'Laundry Income'}`, sub: 'Miscellaneous income postings', payload: { account: a } }); }} />
      </div>

      {/* Occupancy + Pending move-ins / Alerts */}
      <div className="two-col" style={{ marginTop: 20 }}>
        <div>
          <div className="section-title" style={{ marginBottom: 10 }}>Occupancy Summary</div>
          <div className="kpi-grid kpi-grid-2">
            <KpiCard label="Vacant Units" value={fmtNum(m.vacant)}
              variant={m.vacantDetail.some((u) => u.daysVacant > 90) ? 'warning' : ''}
              sub={m.vacantDetail.some((u) => u.daysVacant > 90) ? <span className="warn">{m.vacantDetail.filter((u) => u.daysVacant > 90).length} over 90 days</span> : 'No long-term vacancies'}
              onClick={() => setDrill({ type: 'occupancy', eyebrow: 'Vacancy', title: `${prop.name} — Vacant Units`, sub: 'Days-vacant detail', payload: { ...m, pending: m.pendingCount } })} />
            <KpiCard label="Pending Move-Ins" value={fmtNum(m.pendingMoveIns.length)}
              sub={m.pendingMoveIns.length ? 'Scheduled future move-ins' : 'None scheduled'} />
          </div>
          {m.pendingMoveIns.length > 0 && (
            <div className="table-card" style={{ marginTop: 16 }}>
              <div className="table-header"><span className="table-title">Pending Move-Ins</span><span className="table-count">{m.pendingMoveIns.length}</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Unit</th><th>Resident</th><th>Scheduled Move-In</th></tr></thead>
                  <tbody>
                    {m.pendingMoveIns.map((p, i) => (
                      <tr key={i}><td className="strong">{p.unit}</td><td>{p.name || '—'}</td><td className="mono">{fmtDate(p.move_in)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="section-title" style={{ marginBottom: 10 }}>Operational Alerts</div>
          <AlertList m={m} prop={prop} setDrill={setDrill} />
        </div>
      </div>

      {/* Delinquency table */}
      <div className="section-title" style={{ marginTop: 24 }}>Delinquency Detail</div>
      <div className="table-card" style={{ marginTop: 10 }}>
        <div className="table-header">
          <span className="table-title">Delinquent Units</span>
          <span className="table-count">{m.delinquentUnits.length} units · {fmtUSD(m.totalDelinquent)}</span>
        </div>
        <div className="table-wrap">
          {m.delinquentUnits.length === 0 ? <div className="empty-state"><span className="ei">✓</span>No delinquent balances.</div> : (
            <table>
              <thead><tr>
                <th>Unit</th><th>Resident</th><th className="right">Resident Bal.</th><th className="right">Subsidy Bal.</th>
                <th className="right">Total</th><th>Aging</th><th className="right">Late</th>
              </tr></thead>
              <tbody>
                {m.delinquentUnits.map((u) => (
                  <tr key={u.unit} className={`clickable ${u.late >= 5 ? 'flag-red' : u.subsidyAnomaly ? 'flag-amber' : ''}`}
                    onClick={() => setDrill({ type: 'tenant', eyebrow: 'Resident Ledger', title: `Unit ${u.unit} · ${u.name || '—'}`, sub: 'Delinquency ledger detail', payload: { unit: u } })}>
                    <td className="strong">{u.unit}</td>
                    <td>{u.name || '—'}{u.subsidyAnomaly && <span className="badge badge-amber" style={{ marginLeft: 6 }}>subsidy</span>}</td>
                    <td className="right mono">{fmtUSD(u.resident_balance)}</td>
                    <td className="right mono">{fmtUSD(u.subsidy_balance)}</td>
                    <td className="right mono strong">{fmtUSD(u.total)}</td>
                    <td><span className={`badge ${u.bucket === '90+' ? 'badge-red' : u.bucket === 'Current' ? 'badge-gray' : 'badge-amber'}`}>{u.bucket}</span></td>
                    <td className="right mono">{u.late}{u.late >= 5 && <span className="badge badge-red" style={{ marginLeft: 6 }}>5+</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Deposit deficiency + Lease pipeline */}
      <div className="two-col" style={{ marginTop: 8 }}>
        <div>
          <div className="section-title" style={{ marginBottom: 10 }}>Deposit Deficiencies</div>
          <div className="table-card" style={{ marginTop: 0 }}>
            <div className="table-header">
              <span className="table-title">Below Required Deposit</span>
              <span className="table-count">{m.depositDeficiencies.length} units</span>
            </div>
            <div className="table-wrap">
              {m.depositDeficiencies.length === 0 ? <div className="empty-state"><span className="ei">✓</span>All units meet required deposit.</div> : (
                <table>
                  <thead><tr><th>Unit</th><th>Resident</th><th className="right">Required</th><th className="right">On Hand</th><th className="right">Shortfall</th></tr></thead>
                  <tbody>
                    {m.depositDeficiencies.map((d) => (
                      <tr key={d.unit}>
                        <td className="strong">{d.unit}</td>
                        <td>{d.name || '—'}</td>
                        <td className="right mono">{fmtUSD(d.required)}</td>
                        <td className="right mono">{fmtUSD(d.onHand)}</td>
                        <td className="right mono" style={{ color: 'var(--amber-400)', fontWeight: 600 }}>{fmtUSD(d.shortfall)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="section-title" style={{ marginBottom: 10 }}>Lease Expiration Pipeline · Next 12 Months</div>
          <div className="chart-card">
            <div className="chart-sub" style={{ marginBottom: 14 }}>
              <span className="badge badge-red" style={{ marginRight: 6 }}>{'≤'}30d</span>
              <span className="badge badge-amber" style={{ marginRight: 6 }}>{'≤'}60d</span>
              <span className="badge" style={{ background: 'rgba(251,191,36,0.16)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.35)', marginRight: 6 }}>{'≤'}90d</span>
              <span style={{ color: 'var(--slate-400)' }}>· {next90} within 90 days · {m.expiredHoldover} holdover</span>
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={pipelineData} barCategoryGap="22%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--navy-700)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--slate-400)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--slate-400)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="count" name="Leases Expiring" radius={[4, 4, 0, 0]} maxBarSize={40}
                  onClick={(d) => d && d.count > 0 && setDrill({ type: 'leases', eyebrow: 'Lease Pipeline', title: `Leases Expiring — ${d.label}`, sub: 'Click-through from pipeline', payload: { windowLabel: d.label, leases: d.leases } })}
                  style={{ cursor: 'pointer' }}>
                  {pipelineData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  <LabelList dataKey="count" position="top" formatter={(v) => v || ''} fill="var(--slate-300)" fontSize={10} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}

function AlertList({ m, prop, setDrill }) {
  const alerts = [];
  m.delinquentUnits.filter((u) => u.late >= 5).forEach((u) => alerts.push({
    sev: 'red', text: <>Unit <strong>{u.unit}</strong> · {u.name} — {u.late} late payments</>,
    value: fmtUSD(u.total), onClick: () => setDrill({ type: 'tenant', eyebrow: 'Resident Ledger', title: `Unit ${u.unit} · ${u.name}`, sub: 'High late-payment count', payload: { unit: u } }),
  }));
  m.vacantDetail.filter((u) => u.daysVacant > 90).forEach((u) => alerts.push({
    sev: 'amber', text: <>Unit <strong>{u.unit}</strong> vacant {u.daysVacant} days</>, value: '90+ days',
    onClick: () => setDrill({ type: 'occupancy', eyebrow: 'Vacancy', title: `${prop.name} — Vacant Units`, sub: 'Long-term vacancy', payload: { ...m, pending: m.pendingCount } }),
  }));
  m.delinquentUnits.filter((u) => u.subsidyAnomaly).forEach((u) => alerts.push({
    sev: 'amber', text: <>Unit <strong>{u.unit}</strong> shows subsidy balance (non-subsidy property)</>, value: fmtUSD(u.subsidy_balance),
    onClick: () => setDrill({ type: 'tenant', eyebrow: 'Resident Ledger', title: `Unit ${u.unit} · ${u.name}`, sub: 'Subsidy balance anomaly', payload: { unit: u } }),
  }));
  if (m.payables > 10000) alerts.push({
    sev: 'amber', text: <>Open payables elevated</>, value: fmtUSD(m.payables),
    onClick: () => { const a = acct(prop, '2110-0000'); setDrill({ type: 'gl', eyebrow: 'Accounts Payable', title: `2110-0000 · ${a?.name || ''}`, sub: 'Open AP detail', payload: { account: a } }); },
  });
  if (m.miscIncome === 0) alerts.push({ sev: 'amber', text: <>No miscellaneous income posted this period</>, value: '$0' });

  if (alerts.length === 0) {
    return <div className="table-card"><div className="empty-state"><span className="ei">✓</span>No active operational alerts. All clear.</div></div>;
  }
  return (
    <div className="alert-list">
      {alerts.map((a, i) => (
        <div key={i} className={`alert-item ${a.sev}`} onClick={a.onClick}>
          <span className={`alert-dot ${a.sev}`} />
          <span className="alert-text">{a.text}</span>
          <span className="alert-value">{a.value}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PORTFOLIO VIEW
// ═══════════════════════════════════════════════════════════
function PortfolioView({ data, allMetrics, portfolio, onSelect }) {
  const p = portfolio;
  const incomeByProp = PROP_ORDER.filter((id) => allMetrics[id]).map((id) => ({
    name: data[id].short,
    Resident: allMetrics[id].residentIncome,
    Subsidy: allMetrics[id].subsidyIncome,
    Misc: allMetrics[id].miscIncome,
  }));
  const cashByProp = PROP_ORDER.filter((id) => allMetrics[id]).map((id) => ({
    name: data[id].short, Cash: allMetrics[id].cash,
  }));

  return (
    <>
      <div className="view-heading">
        <h1>Portfolio Summary</h1>
        <p>Aggregated performance across {Object.keys(allMetrics).length} managed properties · May 2026</p>
      </div>

      <div className="totals-row">
        <div className="total-item"><div className="total-label">Total Units</div><div className="total-value">{fmtNum(p.totalUnits)}</div></div>
        <div className="total-item"><div className="total-label">Occupancy</div><div className="total-value gold">{fmtPct(p.occupancyRate)}</div></div>
        <div className="total-item"><div className="total-label">Total Income</div><div className="total-value">{fmtUSD(p.totalIncome)}</div></div>
        <div className="total-item"><div className="total-label">Operating Cash</div><div className="total-value">{fmtUSD(p.cash)}</div></div>
        <div className="total-item"><div className="total-label">Open Payables</div><div className="total-value">{fmtUSD(p.payables)}</div></div>
        <div className="total-item"><div className="total-label">Delinquency</div><div className="total-value gold">{fmtPct(p.delinquencyRate)}</div></div>
      </div>

      <div className="section-title" style={{ marginTop: 24 }}>Properties</div>
      <div className="portfolio-grid" style={{ marginTop: 14 }}>
        {PROP_ORDER.filter((id) => allMetrics[id]).map((id) => {
          const m = allMetrics[id];
          const longVac = m.vacantDetail.filter((u) => u.daysVacant > 90).length;
          const chronicLate = m.delinquentUnits.filter((u) => u.late >= 5).length;
          return (
            <div key={id} className="pf-card" onClick={() => onSelect(id)}>
              <div className="pf-card-head">
                <div>
                  <div className="pf-card-name">{data[id].name}</div>
                  <div className="pf-card-meta">{m.totalUnits} units · {m.propHasSubsidy ? 'Subsidized (USDA/HUD)' : 'Conventional'}</div>
                </div>
                <div className="pf-occ-ring">
                  <div className="pf-occ-val">{fmtPct(m.occupancyRate)}</div>
                  <div className="pf-occ-label">Occupied</div>
                </div>
              </div>
              <div className="pf-stats">
                <div><div className="pf-stat-label">Total Income</div><div className="pf-stat-value">{fmtUSD(m.totalIncome)}</div></div>
                <div><div className="pf-stat-label">Operating Cash</div><div className="pf-stat-value">{fmtUSD(m.cash)}</div></div>
                <div><div className="pf-stat-label">Delinquency</div><div className={`pf-stat-value ${m.delinquencyRate > 5 ? 'alert' : ''}`}>{fmtPct(m.delinquencyRate)}</div></div>
                <div><div className="pf-stat-label">Open Payables</div><div className="pf-stat-value">{m.payables != null ? fmtUSD(m.payables) : '—'}</div></div>
                <div><div className="pf-stat-label">Reserves (RfR + T&I)</div><div className="pf-stat-value">{fmtUSD((m.rfr || 0) + (m.ti || 0))}</div></div>
                <div><div className="pf-stat-label">Capital Spend</div><div className="pf-stat-value">{fmtUSD(m.totalCapex)}</div></div>
              </div>
              {(longVac > 0 || chronicLate > 0) && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {longVac > 0 && <span className="badge badge-amber">{longVac} vacant 90+ days</span>}
                  {chronicLate > 0 && <span className="badge badge-red">{chronicLate} chronic late</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="two-col" style={{ marginTop: 28 }}>
        <div className="chart-card">
          <div className="chart-title">Income Composition by Property</div>
          <div className="chart-sub">Resident rent · rental assistance · miscellaneous</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={incomeByProp} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--navy-700)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--slate-400)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--slate-400)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtUSDk} />
              <Tooltip content={<ChartTip money />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="Resident" stackId="a" fill={INCOME_COLORS.resident} maxBarSize={54} />
              <Bar dataKey="Subsidy" stackId="a" fill={INCOME_COLORS.subsidy} maxBarSize={54} />
              <Bar dataKey="Misc" stackId="a" fill={INCOME_COLORS.misc} radius={[4, 4, 0, 0]} maxBarSize={54} />
            </BarChart>
          </ResponsiveContainer>
          <div className="legend" style={{ flexDirection: 'row', gap: 16, justifyContent: 'center' }}>
            <span className="legend-left"><span className="legend-dot" style={{ background: INCOME_COLORS.resident }} />Resident</span>
            <span className="legend-left"><span className="legend-dot" style={{ background: INCOME_COLORS.subsidy }} />Subsidy</span>
            <span className="legend-left"><span className="legend-dot" style={{ background: INCOME_COLORS.misc }} />Misc</span>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-title">Operating Cash by Property</div>
          <div className="chart-sub">GL 1116-1000 ending balances</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={cashByProp} barCategoryGap="34%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--navy-700)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--slate-400)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--slate-400)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtUSDk} />
              <Tooltip content={<ChartTip money />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="Cash" fill="#60a5fa" radius={[4, 4, 0, 0]} maxBarSize={64}>
                <LabelList dataKey="Cash" position="top" formatter={fmtUSDk} fill="var(--slate-400)" fontSize={10} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
