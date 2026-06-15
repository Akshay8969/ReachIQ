'use client';
import { useEffect, useState } from 'react';
import { segmentsApi, aiApi } from '@/lib/api';
import Link from 'next/link';

export default function SegmentsPage() {
  const [segments, setSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');

  // AI mode state
  const [nlQuery, setNlQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [aiError, setAiError] = useState('');
  const [segmentName, setSegmentName] = useState('');

  // Manual mode state
  const [manualName, setManualName] = useState('');
  const [manualSql, setManualSql] = useState("SELECT * FROM customers WHERE total_spend > 5000");
  const [manualPreview, setManualPreview] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadSegments() {
    const data = await segmentsApi.list();
    setSegments(data.segments);
    setLoading(false);
  }

  useEffect(() => { loadSegments(); }, []);

  async function handleAiGenerate() {
    if (!nlQuery.trim()) return;
    setAiLoading(true);
    setAiError('');
    setAiResult(null);
    try {
      const result = await aiApi.segment(nlQuery);
      setAiResult(result);
      setSegmentName(nlQuery.slice(0, 40));
    } catch (e: any) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  }

  async function handlePreview() {
    setPreviewLoading(true);
    try {
      const result = await segmentsApi.preview(manualSql);
      setManualPreview(result);
    } catch (e: any) {
      setManualPreview({ error: e.message });
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSaveAi() {
    if (!segmentName || !aiResult?.sql) return;
    setSaving(true);
    try {
      await segmentsApi.create({ name: segmentName, description: nlQuery, filter_sql: aiResult.sql, created_by: 'ai' });
      setShowCreate(false);
      setAiResult(null);
      setNlQuery('');
      setSegmentName('');
      loadSegments();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveManual() {
    if (!manualName || !manualSql) return;
    setSaving(true);
    try {
      await segmentsApi.create({ name: manualName, filter_sql: manualSql, created_by: 'manual' });
      setShowCreate(false);
      setManualPreview(null);
      setManualName('');
      loadSegments();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this segment?')) return;
    await segmentsApi.delete(id);
    loadSegments();
  }

  const EXAMPLE_QUERIES = [
    "Women aged 25-40 who spent more than ₹5000",
    "Customers in Mumbai who haven't bought in 60 days",
    "VIP customers with 3 or more orders",
    "New customers who joined this month",
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Audience Segments</h1>
            <p className="page-subtitle">Create smart customer groups powered by AI or custom rules</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + New Segment
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {segments.map((seg: any) => (
            <div key={seg.id} className="card" style={{ padding: 20, cursor: 'default' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                <span className={`badge ${seg.created_by === 'ai' ? 'badge-accent' : 'badge-neutral'}`}>
                  {seg.created_by === 'ai' ? '🤖 AI' : '⚙️ Manual'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {new Date(seg.created_at).toLocaleDateString('en-IN')}
                </span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{seg.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
                {seg.description || 'Custom segment'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{
                    fontFamily: 'Space Grotesk, sans-serif', fontSize: 24, fontWeight: 700,
                    color: 'var(--accent-light)'
                  }}>
                    {seg.customer_count?.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>customers</span>
                </div>
                <div className="flex gap-2">
                  <Link href={`/campaigns/new?segment=${seg.id}`} className="btn btn-primary btn-sm">
                    📣 Campaign
                  </Link>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(seg.id)}>🗑️</button>
                </div>
              </div>

            </div>
          ))}

          {segments.length === 0 && (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <div className="empty-icon">🎯</div>
              <div className="empty-title">No segments yet</div>
              <div className="empty-subtitle">Create your first audience segment using AI or custom rules</div>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Create Segment</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button className={`btn ${mode === 'ai' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('ai')}>
                  🤖 AI Builder
                </button>
                <button className={`btn ${mode === 'manual' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('manual')}>
                  ⚙️ SQL Builder
                </button>
              </div>

              {mode === 'ai' ? (
                <div>
                  <div className="form-group">
                    <label className="form-label">Describe your audience in plain English</label>
                    <textarea
                      className="form-input"
                      placeholder="e.g. Women aged 25-40 who spent more than ₹5000 and haven't purchased in 30 days"
                      value={nlQuery}
                      onChange={e => setNlQuery(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Examples:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {EXAMPLE_QUERIES.map(q => (
                        <button key={q} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setNlQuery(q)}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button className="btn btn-primary" onClick={handleAiGenerate} disabled={!nlQuery || aiLoading}>
                    {aiLoading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Generating...</> : '✨ Generate Segment'}
                  </button>

                  {aiError && <div style={{ color: 'var(--rose)', fontSize: 12, marginTop: 8 }}>{aiError}</div>}

                  {aiResult && (
                    <div style={{ marginTop: 16 }}>
                      <div className="ai-suggest-box" style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 20 }}>🎯</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--accent-light)' }}>{aiResult.customer_count?.toLocaleString()}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>customers match your description</div>
                          </div>
                        </div>
                      </div>

                      {aiResult.preview?.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Preview (first 5):</div>
                          {aiResult.preview.map((c: any) => (
                            <div key={c.id} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                              <strong>{c.name}</strong> · {c.city} · ₹{c.total_spend?.toFixed(0)}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="form-group">
                        <label className="form-label">Segment Name</label>
                        <input className="form-input" value={segmentName} onChange={e => setSegmentName(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="form-group">
                    <label className="form-label">Segment Name</label>
                    <input className="form-input" placeholder="e.g. High Spenders" value={manualName} onChange={e => setManualName(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">SQL Filter</label>
                    <textarea
                      className="form-input"
                      style={{ fontFamily: 'monospace', fontSize: 12 }}
                      value={manualSql}
                      onChange={e => setManualSql(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={handlePreview} disabled={previewLoading}>
                    {previewLoading ? 'Running...' : '▶ Preview'}
                  </button>
                  {manualPreview && (
                    <div style={{ marginTop: 10 }}>
                      {manualPreview.error ? (
                        <div style={{ color: 'var(--rose)', fontSize: 12 }}>{manualPreview.error}</div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          <strong style={{ color: 'var(--accent-light)' }}>{manualPreview.total}</strong> customers match
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              {mode === 'ai' ? (
                <button className="btn btn-primary" onClick={handleSaveAi} disabled={!aiResult || !segmentName || saving}>
                  {saving ? 'Saving...' : 'Save Segment'}
                </button>
              ) : (
                <button className="btn btn-primary" onClick={handleSaveManual} disabled={!manualName || !manualSql || saving}>
                  {saving ? 'Saving...' : 'Save Segment'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
