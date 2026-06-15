'use client';
import { useEffect, useState, useRef } from 'react';
import { customersApi } from '@/lib/api';

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('en-IN');
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null || n === 0) return '₹0';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n.toFixed(0)}`;
}

const genderBadge: Record<string, string> = { male: 'badge-info', female: 'badge-accent', other: 'badge-neutral' };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const LIMIT = 20;

  async function load() {
    setLoading(true);
    try {
      const params: any = { page, limit: LIMIT };
      if (search) params.search = search;
      if (city) params.city = city;
      if (gender) params.gender = gender;
      const data = await customersApi.list(params);
      setCustomers(data.customers);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, search, city, gender]);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await customersApi.importCsv(file);
      setImportResult(result);
      load();
    } finally {
      setImporting(false);
    }
  }

  const pages = Math.ceil(total / LIMIT);
  const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Surat'];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Customers</h1>
            <p className="page-subtitle">{fmt(total)} shoppers in your database</p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? <><span className="spinner" style={{width:14,height:14}}/> Importing...</> : '📥 Import CSV'}
            </button>
            <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
          </div>
        </div>
      </div>

      {importResult && (
        <div style={{ background: 'var(--emerald-dim)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: 'var(--emerald)' }}>
          ✅ Imported {importResult.imported} customers, skipped {importResult.skipped} (duplicates/invalid)
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setImportResult(null)}>✕</button>
        </div>
      )}

      <div className="filter-row">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            placeholder="Search by name, email, city..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="select-input" value={city} onChange={e => { setCity(e.target.value); setPage(1); }}>
          <option value="">All Cities</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="select-input" value={gender} onChange={e => { setGender(e.target.value); setPage(1); }}>
          <option value="">All Genders</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </select>
        {(search || city || gender) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setCity(''); setGender(''); setPage(1); }}>
            Clear filters
          </button>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-overlay"><div className="spinner" /></div>
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <div className="empty-title">No customers found</div>
            <div className="empty-subtitle">Try adjusting your search filters</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Age / Gender</th>
                <th>City</th>
                <th>Orders</th>
                <th>Total Spend</th>
                <th>Last Order</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c: any) => {
                const tags = JSON.parse(c.tags || '[]') as string[];
                return (
                  <tr key={c.id} onClick={() => setSelected(c)}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.email}</div>
                    </td>
                    <td>
                      <span>{c.age || '—'} </span>
                      {c.gender && <span className={`badge ${genderBadge[c.gender] || 'badge-neutral'}`}>{c.gender}</span>}
                    </td>
                    <td>{c.city || '—'}</td>
                    <td>{c.total_orders || 0}</td>
                    <td style={{ color: c.total_spend > 5000 ? 'var(--emerald)' : 'var(--text-primary)' }}>
                      {fmtCurrency(c.total_spend)}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                      {c.last_order_date ? new Date(c.last_order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                    </td>
                    <td>
                      {tags.slice(0, 2).map(t => (
                        <span key={t} className="badge badge-neutral" style={{ marginRight: 2 }}>{t}</span>
                      ))}
                      {tags.length > 2 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{tags.length - 2}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {fmt(total)}
            </span>
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
              <span style={{ fontSize: 12, padding: '5px 8px', color: 'var(--text-secondary)' }}>Page {page} of {pages}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Customer Detail Drawer */}
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{selected.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{selected.email}</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid-2" style={{ marginBottom: 16 }}>
                <div className="mini-stat-card">
                  <div className="mini-stat-value">{selected.total_orders || 0}</div>
                  <div className="mini-stat-label">Orders</div>
                </div>
                <div className="mini-stat-card">
                  <div className="mini-stat-value" style={{ color: 'var(--emerald)' }}>{fmtCurrency(selected.total_spend)}</div>
                  <div className="mini-stat-label">Total Spend</div>
                </div>
              </div>
              <div className="stat-row"><span className="stat-label">Phone</span><span className="stat-value">{selected.phone || '—'}</span></div>
              <div className="stat-row"><span className="stat-label">Age</span><span className="stat-value">{selected.age || '—'}</span></div>
              <div className="stat-row"><span className="stat-label">City</span><span className="stat-value">{selected.city || '—'}</span></div>
              <div className="stat-row"><span className="stat-label">Last Order</span><span className="stat-value">{selected.last_order_date || '—'}</span></div>
              <div className="stat-row">
                <span className="stat-label">Tags</span>
                <span>
                  {(JSON.parse(selected.tags || '[]') as string[]).map((t: string) => (
                    <span key={t} className="badge badge-accent" style={{ marginRight: 3 }}>{t}</span>
                  ))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
