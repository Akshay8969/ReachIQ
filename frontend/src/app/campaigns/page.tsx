'use client';
import { useEffect, useState } from 'react';
import { campaignsApi } from '@/lib/api';
import Link from 'next/link';

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('en-IN');
}

const channelIcon: Record<string, string> = { whatsapp: '💬', sms: '📱', email: '📧', rcs: '✨' };

function statusBadge(status: string) {
  const map: Record<string, string> = { running: 'badge-success', completed: 'badge-info', draft: 'badge-warning', failed: 'badge-danger' };
  return <span className={`badge ${map[status] || 'badge-neutral'}`}><span className={`status-dot ${status === 'running' ? 'live' : status}`} />{status}</span>;
}

function pct(num: number, den: number) {
  if (!den) return '—';
  return `${Math.round((num / den) * 100)}%`;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    campaignsApi.list().then(d => { setCampaigns(d.campaigns); setLoading(false); });
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Campaigns</h1>
            <p className="page-subtitle">All your marketing campaigns in one place</p>
          </div>
          <Link href="/campaigns/new" className="btn btn-primary">
            ✨ New Campaign
          </Link>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-overlay"><div className="spinner" /></div>
        ) : campaigns.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div className="empty-title">No campaigns yet</div>
            <div className="empty-subtitle">Create your first AI-powered campaign to reach your shoppers</div>
            <Link href="/campaigns/new" className="btn btn-primary" style={{ marginTop: 16 }}>Create Campaign</Link>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Channel</th>
                <th>Segment</th>
                <th>Sent</th>
                <th>Delivered</th>
                <th>Opened</th>
                <th>Clicked</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c: any) => (
                <tr key={c.id} onClick={() => window.location.href = `/campaigns/${c.id}`}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{c.name}</div>
                  </td>
                  <td>
                    <span className={`channel-chip ${c.channel}`}>
                      {channelIcon[c.channel]} {c.channel}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{c.segment_name || 'All'}</td>
                  <td>{fmt(c.sent_count)}</td>
                  <td>
                    <span style={{ color: c.delivered_count > 0 ? 'var(--emerald)' : 'var(--text-muted)' }}>
                      {pct(c.delivered_count, c.sent_count)}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--amber)' }}>{pct(c.opened_count, c.delivered_count)}</span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--sky)' }}>{pct(c.clicked_count, c.delivered_count)}</span>
                  </td>
                  <td>{statusBadge(c.status)}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    {c.launched_at ? new Date(c.launched_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
