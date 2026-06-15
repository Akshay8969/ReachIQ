'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { campaignsApi } from '@/lib/api';

const channelIcon: Record<string, string> = { whatsapp: '💬', sms: '📱', email: '📧', rcs: '✨' };

function pct(num: number, den: number) {
  if (!den) return 0;
  return Math.round((num / den) * 100);
}

function fmt(n: number) {
  return (n || 0).toLocaleString('en-IN');
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    campaignsApi.get(id).then(d => { setCampaign(d); setLoading(false); });
  }, [id]);

  // SSE for live updates
  useEffect(() => {
    if (!id) return;
    const url = campaignsApi.streamUrl(id);
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setCampaign((prev: any) => ({ ...prev, ...data }));
      } catch {}
    };

    return () => { es.close(); };
  }, [id]);

  if (loading || !campaign) {
    return <div className="loading-overlay"><div className="spinner" /></div>;
  }

  const deliveryRate = pct(campaign.delivered_count, campaign.sent_count);
  const openRate = pct(campaign.opened_count, campaign.delivered_count);
  const clickRate = pct(campaign.clicked_count, campaign.delivered_count);
  const failRate = pct(campaign.failed_count, campaign.sent_count);

  const stats = [
    { label: 'Sent', value: fmt(campaign.sent_count), color: 'var(--text-primary)', icon: '📤' },
    { label: 'Delivered', value: fmt(campaign.delivered_count), rate: `${deliveryRate}%`, color: 'var(--emerald)', icon: '✅' },
    { label: 'Failed', value: fmt(campaign.failed_count), rate: `${failRate}%`, color: 'var(--rose)', icon: '❌' },
    { label: 'Opened', value: fmt(campaign.opened_count), rate: `${openRate}%`, color: 'var(--amber)', icon: '👁️' },
    { label: 'Read', value: fmt(campaign.read_count || 0), color: 'var(--sky)', icon: '📖' },
    { label: 'Clicked', value: fmt(campaign.clicked_count), rate: `${clickRate}%`, color: 'var(--violet)', icon: '🖱️' },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
              <button onClick={() => router.push('/campaigns')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                ← Campaigns
              </button>
            </div>
            <h1 className="page-title">{campaign.name}</h1>
            <div className="flex items-center gap-2" style={{ marginTop: 6 }}>
              <span className={`channel-chip ${campaign.channel}`}>
                {channelIcon[campaign.channel]} {campaign.channel}
              </span>
              <span className={`badge ${campaign.status === 'running' ? 'badge-success' : campaign.status === 'completed' ? 'badge-info' : campaign.status === 'draft' ? 'badge-warning' : 'badge-danger'}`}>
                <span className={`status-dot ${campaign.status === 'running' ? 'live' : campaign.status}`} />
                {campaign.status}
              </span>
              {campaign.status === 'running' && (
                <span style={{ fontSize: 12, color: 'var(--emerald)' }}>
                  🔴 Live — updates every second
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {stats.slice(0, 6).map(s => (
          <div key={s.label} className="kpi-card" style={{ '--kpi-color': s.color, '--kpi-bg': `${s.color}22` } as any}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>{s.icon}</span>
              {s.rate && <span style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.rate}</span>}
            </div>
            <div className="kpi-value" style={{ fontSize: 28, color: s.color }}>{s.value}</div>
            <div className="kpi-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Funnel */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <div className="card-title">Engagement Funnel</div>
            <div className="card-subtitle">
              {campaign.status === 'running' ? '🔴 Updating live...' : 'Final results'}
            </div>
          </div>
          <div className="card-body">
            {[
              { label: 'Sent', value: campaign.sent_count, max: campaign.sent_count, color: 'var(--accent)' },
              { label: 'Delivered', value: campaign.delivered_count, max: campaign.sent_count, color: 'var(--emerald)' },
              { label: 'Opened', value: campaign.opened_count, max: campaign.sent_count, color: 'var(--amber)' },
              { label: 'Clicked', value: campaign.clicked_count, max: campaign.sent_count, color: 'var(--violet)' },
            ].map(row => (
              <div key={row.label} style={{ marginBottom: 16 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{row.label}</span>
                  <span style={{ fontSize: 13, color: row.color, fontWeight: 600 }}>
                    {fmt(row.value)} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 11 }}>({pct(row.value, campaign.sent_count)}%)</span>
                  </span>
                </div>
                <div className="progress-bar-wrap">
                  <div
                    className="progress-bar"
                    style={{
                      width: `${pct(row.value, row.max)}%`,
                      background: row.color,
                      transition: 'width 0.8s ease',
                    }}
                  />
                </div>
              </div>
            ))}

            {campaign.failed_count > 0 && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--rose-dim)', borderRadius: 8, border: '1px solid rgba(244,63,94,0.2)', fontSize: 12 }}>
                ❌ <strong style={{ color: 'var(--rose)' }}>{fmt(campaign.failed_count)}</strong>
                <span style={{ color: 'var(--text-secondary)', marginLeft: 4 }}>messages failed to deliver</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>CAMPAIGN DETAILS</div>
            <div className="stat-row"><span className="stat-label">Segment</span><span className="stat-value" style={{ fontSize: 13 }}>{campaign.segment_name || 'All Customers'}</span></div>
            <div className="stat-row">
              <span className="stat-label">Launched</span>
              <span className="stat-value" style={{ fontSize: 13 }}>
                {campaign.launched_at ? new Date(campaign.launched_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
              </span>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>MESSAGE</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)', background: 'var(--bg-base)', padding: 12, borderRadius: 8 }}>
              {campaign.message_template}
            </div>
          </div>

          <div className="ai-suggest-box">
            <div className="ai-suggest-label">AI Insight</div>
            <div className="ai-suggest-text" style={{ fontSize: 12 }}>
              {deliveryRate > 80
                ? `Great delivery rate of ${deliveryRate}%! ${clickRate > 20 ? 'Exceptional CTR too — this campaign is a winner.' : 'Consider A/B testing your CTA to boost clicks.'}`
                : `Delivery rate is ${deliveryRate}%. Consider checking recipient data quality — invalid phone/email numbers can hurt delivery.`
              }
            </div>
          </div>
        </div>
      </div>

      {/* Communication Logs */}
      {campaign.logs?.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <div className="card-title">Communication Log</div>
            <div className="card-subtitle">Last 50 messages</div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Recipient</th>
                  <th>Status</th>
                  <th>Sent At</th>
                </tr>
              </thead>
              <tbody>
                {campaign.logs.slice(0, 20).map((log: any) => (
                  <tr key={log.id}>
                    <td>{log.customer_name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{log.recipient}</td>
                    <td>
                      <span className={`badge ${
                        log.status === 'clicked' ? 'badge-violet' :
                        log.status === 'opened' || log.status === 'read' ? 'badge-warning' :
                        log.status === 'delivered' ? 'badge-success' :
                        log.status === 'failed' ? 'badge-danger' : 'badge-neutral'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {log.sent_at ? new Date(log.sent_at).toLocaleTimeString('en-IN') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
