'use client';
import { useEffect, useState } from 'react';
import { campaignsApi, customersApi } from '@/lib/api';
import Link from 'next/link';

interface KPI {
  total_customers: number;
  total_revenue: number;
  avg_spend: number;
  new_this_month: number;
  lapsed_count: number;
}

interface CampaignOverview {
  stats: {
    total_campaigns: number;
    total_sent: number;
    delivery_rate: number;
    click_rate: number;
  };
  recentCampaigns: any[];
  channelBreakdown: any[];
}

const channelIcon: Record<string, string> = { whatsapp: '💬', sms: '📱', email: '📧', rcs: '✨' };
const channelColor: Record<string, string> = { whatsapp: '#25d366', sms: 'var(--amber)', email: 'var(--sky)', rcs: 'var(--violet)' };

function statusBadge(status: string) {
  const map: Record<string, string> = { running: 'badge-success', completed: 'badge-info', draft: 'badge-warning', failed: 'badge-danger' };
  return <span className={`badge ${map[status] || 'badge-neutral'}`}><span className={`status-dot ${status === 'running' ? 'live' : status}`} />{status}</span>;
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n.toFixed(0)}`;
}

export default function DashboardPage() {
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [overview, setOverview] = useState<CampaignOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([customersApi.stats(), campaignsApi.overview()])
      .then(([stats, camp]) => {
        setKpi(stats);
        setOverview(camp);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Good morning, StyleHub 👋</h1>
            <p className="page-subtitle">Here's what's happening with your shoppers today.</p>
          </div>
          <Link href="/campaigns/new" className="btn btn-primary btn-lg">
            ✨ New Campaign
          </Link>
        </div>
      </div>

      {/* KPI Row */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ '--kpi-color': 'var(--accent)', '--kpi-bg': 'var(--accent-dim)' } as any}>
          <div className="kpi-icon">👥</div>
          <div className="kpi-value">{fmt(kpi?.total_customers)}</div>
          <div className="kpi-label">Total Customers</div>
          <div className="kpi-change up">+{fmt(kpi?.new_this_month)} this month</div>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': 'var(--emerald)', '--kpi-bg': 'var(--emerald-dim)' } as any}>
          <div className="kpi-icon">💰</div>
          <div className="kpi-value">{fmtCurrency(kpi?.total_revenue)}</div>
          <div className="kpi-label">Total Revenue</div>
          <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>avg {fmtCurrency(kpi?.avg_spend)} / customer</div>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': 'var(--sky)', '--kpi-bg': 'var(--sky-dim)' } as any}>
          <div className="kpi-icon">📣</div>
          <div className="kpi-value">{fmt(overview?.stats?.total_campaigns)}</div>
          <div className="kpi-label">Campaigns</div>
          <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>{fmt(overview?.stats?.total_sent)} messages sent</div>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': 'var(--emerald)', '--kpi-bg': 'var(--emerald-dim)' } as any}>
          <div className="kpi-icon">✅</div>
          <div className="kpi-value">{overview?.stats?.delivery_rate ?? 0}%</div>
          <div className="kpi-label">Delivery Rate</div>
          <div className="kpi-change up">CTR {overview?.stats?.click_rate ?? 0}%</div>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': 'var(--amber)', '--kpi-bg': 'var(--amber-dim)' } as any}>
          <div className="kpi-icon">⚠️</div>
          <div className="kpi-value">{fmt(kpi?.lapsed_count)}</div>
          <div className="kpi-label">Lapsed Shoppers</div>
          <div className="kpi-change down">need re-engagement</div>
        </div>
      </div>

      {/* Two-col layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>

        {/* Recent Campaigns */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recent Campaigns</div>
              <div className="card-subtitle">Latest campaign activity</div>
            </div>
            <Link href="/campaigns" className="btn btn-ghost btn-sm">View all →</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {(!overview?.recentCampaigns?.length) ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <div className="empty-title">No campaigns yet</div>
                <div className="empty-subtitle">Launch your first campaign to start reaching shoppers</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Channel</th>
                    <th>Sent</th>
                    <th>Delivered</th>
                    <th>Clicked</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overview?.recentCampaigns?.map((c: any) => (
                    <tr key={c.id} onClick={() => window.location.href = `/campaigns/${c.id}`}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.segment_name || 'All customers'}</div>
                      </td>
                      <td>
                        <span className={`channel-chip ${c.channel}`}>
                          {channelIcon[c.channel]} {c.channel}
                        </span>
                      </td>
                      <td>{fmt(c.sent_count)}</td>
                      <td>
                        <span style={{ color: 'var(--emerald)' }}>
                          {c.sent_count > 0 ? `${Math.round((c.delivered_count / c.sent_count) * 100)}%` : '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--sky)' }}>
                          {c.delivered_count > 0 ? `${Math.round((c.clicked_count / c.delivered_count) * 100)}%` : '—'}
                        </span>
                      </td>
                      <td>{statusBadge(c.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Channel Breakdown */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Channels</div>
            </div>
            <div className="card-body">
              {overview?.channelBreakdown?.length ? overview.channelBreakdown.map((c: any) => (
                <div key={c.channel} style={{ marginBottom: 12 }}>
                  <div className="flex items-center justify-between mb-4" style={{ marginBottom: 6 }}>
                    <span className={`channel-chip ${c.channel}`}>{channelIcon[c.channel]} {c.channel}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.count} campaigns</span>
                  </div>
                </div>
              )) : <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data yet</div>}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Quick Actions</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/segments" className="btn btn-secondary w-full" style={{ justifyContent: 'flex-start' }}>
                🎯 Build Audience Segment
              </Link>
              <Link href="/customers" className="btn btn-secondary w-full" style={{ justifyContent: 'flex-start' }}>
                📥 Import Customers
              </Link>
              <Link href="/campaigns/new" className="btn btn-secondary w-full" style={{ justifyContent: 'flex-start' }}>
                ✨ AI Campaign Composer
              </Link>
            </div>
          </div>

          {/* AI Tip */}
          <div className="ai-suggest-box">
            <div className="ai-suggest-label">AI Insight</div>
            <div className="ai-suggest-text">
              {kpi?.lapsed_count && kpi.lapsed_count > 10
                ? `You have ${fmt(kpi.lapsed_count)} lapsed shoppers. A WhatsApp win-back campaign could recover 15–20% of them.`
                : `Your customer base looks healthy! Try segmenting your top spenders for a VIP loyalty campaign.`
              }
            </div>
            <Link href="/campaigns/new" className="btn btn-secondary btn-sm" style={{ marginTop: 10 }}>
              Create campaign →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
