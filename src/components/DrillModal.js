import React, { useEffect } from 'react';
import { fmtUSD, fmtDate, fmtPct, fmtNum } from '../lib/helpers';

// Generic slide-in drill-down panel. `drill` is { type, title, sub, payload }.
export default function DrillModal({ drill, onClose }) {
  // Only lock page scroll and bind Escape while a drill-down is actually open.
  useEffect(() => {
    if (!drill) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [drill, onClose]);

  if (!drill) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow">{drill.eyebrow || 'Drill-down'}</div>
            <div className="modal-title">{drill.title}</div>
            {drill.sub && <div className="modal-sub">{drill.sub}</div>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{renderContent(drill)}</div>
      </div>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="modal-stat-box">
      <div className="modal-stat-label">{label}</div>
      <div className="modal-stat-val">{value}</div>
    </div>
  );
}

function renderContent(drill) {
  const { type, payload } = drill;

  switch (type) {
    case 'gl': {
      const a = payload.account;
      if (!a) return <Empty msg="No general ledger detail available for this account." />;
      const txns = a.transactions || [];
      const totalDebit = txns.reduce((s, t) => s + (t.debit || 0), 0);
      const totalCredit = txns.reduce((s, t) => s + (t.credit || 0), 0);
      return (
        <>
          <div className="modal-summary">
            <StatBox label="Balance Forward" value={fmtUSD(a.balance_forward)} />
            <StatBox label="Ending Balance" value={fmtUSD(a.ending_balance)} />
            <StatBox label="Total Debits" value={fmtUSD(totalDebit)} />
            <StatBox label="Total Credits" value={fmtUSD(totalCredit)} />
          </div>
          <div className="modal-section-label">Transaction Detail · {txns.length} entries</div>
          {txns.length === 0 ? <Empty msg="No transactions posted this period." /> : (
            <table>
              <thead><tr>
                <th>Date</th><th>Description</th><th>Jnl</th>
                <th className="right">Debit</th><th className="right">Credit</th><th className="right">Balance</th>
              </tr></thead>
              <tbody>
                {txns.map((t, i) => (
                  <tr key={i}>
                    <td className="mono">{fmtDate(t.date)}</td>
                    <td style={{ whiteSpace: 'normal', maxWidth: 220 }}>{t.memo || '—'}</td>
                    <td><span className="badge badge-gray">{t.jnl || '—'}</span></td>
                    <td className="right mono">{t.debit ? fmtUSD(t.debit) : '—'}</td>
                    <td className="right mono">{t.credit ? fmtUSD(t.credit) : '—'}</td>
                    <td className="right mono strong">{t.balance != null ? fmtUSD(t.balance) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      );
    }

    case 'income': {
      const { residentIncome, subsidyIncome, miscIncome, totalIncome, deposits } = payload;
      return (
        <>
          <div className="modal-summary">
            <StatBox label="Resident Rent" value={fmtUSD(residentIncome)} />
            <StatBox label="Rental Assistance" value={fmtUSD(subsidyIncome)} />
            <StatBox label="Miscellaneous" value={fmtUSD(miscIncome)} />
            <StatBox label="Total Income" value={fmtUSD(totalIncome)} />
          </div>
          <div className="modal-section-label">Bank Deposit Detail</div>
          {(!deposits || deposits.length === 0) ? (
            <Empty msg="No bank deposit detail available for this property." />
          ) : deposits.map((dep, i) => (
            <div key={i} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold-400)', marginBottom: 8 }}>
                {dep.header}
              </div>
              {dep.items.length === 0 ? <Empty msg="No line items." /> : (
                <table>
                  <thead><tr><th>Description</th><th className="right">Amount</th></tr></thead>
                  <tbody>
                    {dep.items.map((it, j) => (
                      <tr key={j}>
                        <td style={{ whiteSpace: 'normal' }}>{it.description}</td>
                        <td className="right mono">{fmtUSD(it.amount)}</td>
                      </tr>
                    ))}
                    {dep.total ? (
                      <tr><td className="strong">Deposit Total</td><td className="right mono strong">{fmtUSD(dep.total)}</td></tr>
                    ) : null}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </>
      );
    }

    case 'tenant': {
      const u = payload.unit;
      return (
        <>
          <div className="modal-summary">
            <StatBox label="Unit" value={u.unit} />
            <StatBox label="Total Balance" value={fmtUSD(u.total)} />
            <StatBox label="Resident Balance" value={fmtUSD(u.resident_balance)} />
            <StatBox label="Subsidy Balance" value={fmtUSD(u.subsidy_balance)} />
          </div>
          <div className="modal-section-label">Ledger Detail · {u.rows.length} line items</div>
          <table>
            <thead><tr>
              <th>Code</th><th className="right">Current</th><th className="right">30</th>
              <th className="right">60</th><th className="right">90+</th><th className="right">Net</th>
            </tr></thead>
            <tbody>
              {u.rows.map((r, i) => (
                <tr key={i}>
                  <td><span className="badge badge-gray">{r.code || '—'}</span></td>
                  <td className="right mono">{fmtUSD(r.current)}</td>
                  <td className="right mono">{fmtUSD(r.days_30)}</td>
                  <td className="right mono">{fmtUSD(r.days_60)}</td>
                  <td className="right mono">{fmtUSD(r.days_90)}</td>
                  <td className="right mono strong">{fmtUSD(r.net_balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 18 }} className="modal-section-label">Account Flags</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className={`badge ${u.late >= 5 ? 'badge-red' : 'badge-gray'}`}>{u.late} late payments</span>
            <span className={`badge ${u.nsf > 0 ? 'badge-amber' : 'badge-gray'}`}>{u.nsf} NSF</span>
            <span className="badge badge-blue">{u.bucket} aging</span>
            {u.subsidyAnomaly && <span className="badge badge-amber">Subsidy balance anomaly</span>}
          </div>
        </>
      );
    }

    case 'leases': {
      const leases = payload.leases || [];
      return (
        <>
          <div className="modal-summary">
            <StatBox label="Window" value={payload.windowLabel} />
            <StatBox label="Leases Expiring" value={fmtNum(leases.length)} />
          </div>
          <div className="modal-section-label">Expiring Leases</div>
          {leases.length === 0 ? <Empty msg="No leases expiring in this window." /> : (
            <table>
              <thead><tr><th>Unit</th><th>Resident</th><th>Lease End</th><th className="right">Monthly Rent</th></tr></thead>
              <tbody>
                {leases.map((l, i) => (
                  <tr key={i}>
                    <td className="strong">{l.unit}</td>
                    <td>{l.name || '—'}</td>
                    <td className="mono">{fmtDate(l.lease_end)}</td>
                    <td className="right mono">{fmtUSD(l.total_rent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      );
    }

    case 'expenses': {
      const accts = payload.accounts || [];
      const byCat = payload.byCat || {};
      return (
        <>
          <div className="modal-summary">
            <StatBox label="Total Operating Expenses" value={fmtUSD(payload.total)} />
            <StatBox label="Expense Accounts" value={fmtNum(accts.length)} />
          </div>
          <div className="modal-section-label">By Category</div>
          <table style={{ marginBottom: 22 }}>
            <thead><tr><th>Category</th><th className="right">Amount</th><th className="right">% of Total</th></tr></thead>
            <tbody>
              {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                <tr key={cat}>
                  <td className="strong">{cat}</td>
                  <td className="right mono">{fmtUSD(amt)}</td>
                  <td className="right mono">{fmtPct(payload.total ? (amt / payload.total) * 100 : 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="modal-section-label">Account Detail</div>
          <table>
            <thead><tr><th>Account</th><th>Name</th><th>Category</th><th className="right">Amount</th></tr></thead>
            <tbody>
              {accts.sort((a, b) => b.amount - a.amount).map((a) => (
                <tr key={a.num}>
                  <td className="mono">{a.num}</td>
                  <td style={{ whiteSpace: 'normal' }}>{a.name}</td>
                  <td><span className="badge badge-gray">{a.cat}</span></td>
                  <td className="right mono">{fmtUSD(a.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    }

    case 'capex': {
      const accts = payload.accounts || [];
      return (
        <>
          <div className="modal-summary">
            <StatBox label="Total Capital Expenditures" value={fmtUSD(payload.total)} />
            <StatBox label="Projects / Accounts" value={fmtNum(accts.length)} />
          </div>
          <div className="modal-section-label">Capital Project Detail (9xxx accounts)</div>
          {accts.length === 0 ? <Empty msg="No capital expenditures posted this period." /> : accts.map((a) => (
            <div key={a.num} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--white)' }}>{a.num} · {a.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold-400)' }}>{fmtUSD(a.amount)}</span>
              </div>
              {a.transactions && a.transactions.length > 0 && (
                <table>
                  <thead><tr><th>Date</th><th>Description</th><th className="right">Amount</th></tr></thead>
                  <tbody>
                    {a.transactions.map((t, i) => (
                      <tr key={i}>
                        <td className="mono">{fmtDate(t.date)}</td>
                        <td style={{ whiteSpace: 'normal' }}>{t.memo || '—'}</td>
                        <td className="right mono">{fmtUSD(t.debit - t.credit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </>
      );
    }

    case 'occupancy': {
      const { totalUnits, occupied, vacant, vacantDetail, occupancyRate } = payload;
      return (
        <>
          <div className="modal-summary">
            <StatBox label="Occupancy" value={fmtPct(occupancyRate)} />
            <StatBox label="Total Units" value={fmtNum(totalUnits)} />
            <StatBox label="Occupied" value={fmtNum(occupied)} />
            <StatBox label="Vacant" value={fmtNum(vacant)} />
          </div>
          <div className="modal-section-label">Vacant Units · Days Vacant</div>
          {(!vacantDetail || vacantDetail.length === 0) ? (
            <Empty msg="No vacant units — property is fully occupied." />
          ) : (
            <table>
              <thead><tr><th>Unit</th><th>Floorplan</th><th>Move-Out</th><th className="right">Days Vacant</th></tr></thead>
              <tbody>
                {vacantDetail.map((u) => (
                  <tr key={u.unit} className={u.daysVacant > 90 ? 'flag-amber' : ''}>
                    <td className="strong">{u.unit}</td>
                    <td>{u.floorplan || '—'}</td>
                    <td className="mono">{u.move_out ? fmtDate(u.move_out) : '—'}</td>
                    <td className="right mono">
                      {u.daysVacant != null ? u.daysVacant : '—'}
                      {u.daysVacant > 90 && <span className="badge badge-amber" style={{ marginLeft: 6 }}>90+</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      );
    }

    case 'deposits-card': {
      const defs = payload.deficiencies || [];
      return (
        <>
          <div className="modal-summary">
            <StatBox label="Units Short" value={fmtNum(defs.length)} />
            <StatBox label="Total Shortfall" value={fmtUSD(defs.reduce((s, d) => s + d.shortfall, 0))} />
          </div>
          <div className="modal-section-label">Deposit Deficiencies</div>
          {defs.length === 0 ? <Empty msg="All units meet required deposit." /> : (
            <table>
              <thead><tr><th>Unit</th><th>Resident</th><th className="right">Required</th><th className="right">On Hand</th><th className="right">Shortfall</th></tr></thead>
              <tbody>
                {defs.map((d) => (
                  <tr key={d.unit}>
                    <td className="strong">{d.unit}</td>
                    <td>{d.name || '—'}</td>
                    <td className="right mono">{fmtUSD(d.required)}</td>
                    <td className="right mono">{fmtUSD(d.onHand)}</td>
                    <td className="right mono" style={{ color: 'var(--amber-400)' }}>{fmtUSD(d.shortfall)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      );
    }

    case 'delinquency-card': {
      const list = payload.delinquentUnits || [];
      return (
        <>
          <div className="modal-summary">
            <StatBox label="Delinquent Units" value={fmtNum(list.length)} />
            <StatBox label="Total Delinquent" value={fmtUSD(payload.totalDelinquent)} />
            <StatBox label="Monthly Rent Roll" value={fmtUSD(payload.monthlyRentRoll)} />
            <StatBox label="Delinquency Rate" value={fmtPct(payload.delinquencyRate)} />
          </div>
          <div className="modal-section-label">Delinquent Units</div>
          <table>
            <thead><tr><th>Unit</th><th>Resident</th><th className="right">Total</th><th>Aging</th><th className="right">Late</th></tr></thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.unit} className={u.late >= 5 ? 'flag-red' : ''}>
                  <td className="strong">{u.unit}</td>
                  <td>{u.name || '—'}</td>
                  <td className="right mono">{fmtUSD(u.total)}</td>
                  <td><span className={`badge ${u.bucket === '90+' ? 'badge-red' : u.bucket === 'Current' ? 'badge-gray' : 'badge-amber'}`}>{u.bucket}</span></td>
                  <td className="right mono">{u.late}{u.late >= 5 && <span className="badge badge-red" style={{ marginLeft: 6 }}></span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    }

    default:
      return <Empty msg="No detail available." />;
  }
}

function Empty({ msg }) {
  return <div className="empty-state">{msg}</div>;
}
