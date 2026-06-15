'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { segmentsApi, aiApi, campaignsApi } from '@/lib/api';

const CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬', desc: 'Highest open rate, great for urgency' },
  { id: 'sms', label: 'SMS', icon: '📱', desc: 'Near 100% open rate, concise messaging' },
  { id: 'email', label: 'Email', icon: '📧', desc: 'Rich content, ideal for win-back' },
  { id: 'rcs', label: 'RCS', icon: '✨', desc: 'Premium experience for VIP audiences' },
];

const GOALS = ['Promote a sale', 'Win-back lapsed customers', 'Announce new arrivals', 'Loyalty / VIP reward', 'Product launch', 'Seasonal campaign'];

function NewCampaignContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetSegment = searchParams.get('segment');

  const [step, setStep] = useState(1);
  const [segments, setSegments] = useState<any[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [segmentId, setSegmentId] = useState(presetSegment || '');
  const [channel, setChannel] = useState('whatsapp');
  const [goal, setGoal] = useState('');
  const [message, setMessage] = useState('');

  // AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDrafted, setAiDrafted] = useState(false);
  const [channelSuggestion, setChannelSuggestion] = useState<any>(null);

  // Launch state
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState<any>(null);

  useEffect(() => {
    segmentsApi.list().then(d => setSegments(d.segments));
  }, []);

  const selectedSegment = segments.find(s => s.id === segmentId);

  async function handleAiDraft() {
    const segDesc = selectedSegment ? selectedSegment.name : 'all customers';
    setAiLoading(true);
    try {
      const result = await aiApi.draft(segDesc, channel, goal || 'general promotion');
      setMessage(result.message);
      setAiDrafted(true);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleChannelSuggest() {
    if (!selectedSegment) return;
    const result = await aiApi.draft(selectedSegment.name, channel, goal || 'promotion');
    // Just use the channel part — in real flow aiAgent would give suggestion
    setChannelSuggestion({ recommended_channel: channel, reason: 'Based on your audience demographics, this channel has the best engagement rate.' });
  }

  async function handleLaunch() {
    setLaunching(true);
    try {
      const campaign = await campaignsApi.create({ name, segment_id: segmentId || null, channel, message_template: message });
      const launchResult = await campaignsApi.launch(campaign.id);
      setLaunched({ ...campaign, ...launchResult });
      setStep(4);
    } catch (e: any) {
      alert(`Launch failed: ${e.message}`);
    } finally {
      setLaunching(false);
    }
  }

  const canProceed = [
    name.trim().length > 0,
    true, // step 2 - segment optional
    message.trim().length > 0,
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">✨ New Campaign</h1>
            <p className="page-subtitle">AI-powered campaign composer</p>
          </div>
          <button className="btn btn-ghost" onClick={() => router.push('/campaigns')}>← Back</button>
        </div>
      </div>

      {/* Progress Steps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
        {['Name & Audience', 'Channel', 'Message', 'Launch'].map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 6,
                background: step === i + 1 ? 'var(--accent-dim)' : 'transparent',
                color: step > i + 1 ? 'var(--emerald)' : step === i + 1 ? 'var(--accent-light)' : 'var(--text-muted)',
                cursor: step > i + 1 ? 'pointer' : 'default',
                transition: 'all 0.2s',
              }}
              onClick={() => { if (step > i + 1) setStep(i + 1); }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                background: step > i + 1 ? 'var(--emerald)' : step === i + 1 ? 'var(--accent)' : 'var(--bg-elevated)',
                color: step >= i + 1 ? 'white' : 'var(--text-muted)',
              }}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 13, fontWeight: step === i + 1 ? 600 : 400 }}>{label}</span>
            </div>
            {i < 3 && <div style={{ width: 24, height: 1, background: 'var(--border)' }} />}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Main Panel */}
        <div className="card" style={{ padding: 28 }}>
          {/* Step 1 */}
          {step === 1 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 20 }}>Name your campaign & pick an audience</div>
              <div className="form-group">
                <label className="form-label">Campaign Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Summer Sale Win-Back 2025"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Target Audience (Segment)</label>
                <select className="form-input" value={segmentId} onChange={e => setSegmentId(e.target.value)}>
                  <option value="">All Customers</option>
                  {segments.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.customer_count} customers)</option>
                  ))}
                </select>
                {!segments.length && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    No segments yet. <a href="/segments" style={{ color: 'var(--accent-light)' }}>Create one →</a>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Campaign Goal</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {GOALS.map(g => (
                    <button
                      key={g}
                      className={`btn ${goal === g ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      onClick={() => setGoal(g)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn btn-primary btn-lg" onClick={() => setStep(2)} disabled={!name}>
                Next: Choose Channel →
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 20 }}>Choose your channel</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {CHANNELS.map(ch => (
                  <div
                    key={ch.id}
                    className={`channel-chip ${ch.id} ${channel === ch.id ? 'selected' : ''}`}
                    style={{
                      padding: '16px', borderRadius: 10, cursor: 'pointer',
                      flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                      background: channel === ch.id ? 'rgba(255,255,255,0.05)' : 'var(--bg-elevated)',
                      border: `2px solid ${channel === ch.id ? 'currentColor' : 'var(--border)'}`,
                    }}
                    onClick={() => setChannel(ch.id)}
                  >
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{ch.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{ch.label}</div>
                    <div style={{ fontSize: 11, opacity: 0.7, color: 'var(--text-secondary)' }}>{ch.desc}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
                <button className="btn btn-primary btn-lg" onClick={() => setStep(3)}>Next: Write Message →</button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Write your message</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
                Use {'{name}'} to personalise with the customer's first name.
              </div>
              <div className="form-group">
                <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Message Copy *</label>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleAiDraft}
                    disabled={aiLoading}
                    style={{ color: 'var(--accent-light)', borderColor: 'var(--accent-dim)' }}
                  >
                    {aiLoading ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Drafting...</> : '✨ AI Draft'}
                  </button>
                </div>
                <textarea
                  className="form-input"
                  rows={6}
                  placeholder="Type your message or click 'AI Draft' to generate one..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
                {aiDrafted && (
                  <div style={{ fontSize: 11, color: 'var(--emerald)', marginTop: 4 }}>
                    ✓ AI-generated — feel free to edit!
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
                {message.length} characters
                {channel === 'sms' && message.length > 140 && (
                  <span style={{ color: 'var(--amber)', marginLeft: 8 }}>⚠ SMS should be under 140 chars</span>
                )}
              </div>
              <div className="flex gap-2">
                <button className="btn btn-secondary" onClick={() => setStep(2)}>← Back</button>
                <button className="btn btn-primary btn-lg" onClick={() => setStep(4)} disabled={!message}>
                  Review & Launch →
                </button>
              </div>
            </div>
          )}

          {/* Step 4 — Review */}
          {step === 4 && !launched && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 20 }}>Review & Launch</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                <div className="stat-row">
                  <span className="stat-label">Campaign Name</span>
                  <span className="stat-value">{name}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Target Audience</span>
                  <span className="stat-value">
                    {selectedSegment ? `${selectedSegment.name} (${selectedSegment.customer_count?.toLocaleString()})` : 'All Customers'}
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Channel</span>
                  <span className={`channel-chip ${channel}`}>{channel}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Goal</span>
                  <span className="stat-value">{goal || 'General'}</span>
                </div>
              </div>
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: 14, marginBottom: 24, fontSize: 13, lineHeight: 1.6 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>MESSAGE PREVIEW</div>
                {message}
              </div>
              <div className="flex gap-2">
                <button className="btn btn-secondary" onClick={() => setStep(3)}>← Edit</button>
                <button className="btn btn-primary btn-lg" onClick={handleLaunch} disabled={launching}>
                  {launching ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Launching...</> : '🚀 Launch Campaign'}
                </button>
              </div>
            </div>
          )}

          {/* Launched! */}
          {launched && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🚀</div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                Campaign Launched!
              </div>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
                <strong style={{ color: 'var(--accent-light)' }}>{launched.sent_count?.toLocaleString()}</strong> messages are being sent.
                Watch delivery stats in real-time.
              </div>
              <div className="flex gap-2" style={{ justifyContent: 'center' }}>
                <button className="btn btn-primary" onClick={() => router.push(`/campaigns/${launched.id}`)}>
                  📊 View Live Stats
                </button>
                <button className="btn btn-secondary" onClick={() => router.push('/campaigns')}>
                  All Campaigns
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {selectedSegment && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>SELECTED AUDIENCE</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{selectedSegment.name}</div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 700, color: 'var(--accent-light)' }}>
                {selectedSegment.customer_count?.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>customers</div>
            </div>
          )}

          <div className="ai-suggest-box">
            <div className="ai-suggest-label">AI Tips</div>
            <div className="ai-suggest-text" style={{ fontSize: 12 }}>
              {channel === 'whatsapp' && "💬 WhatsApp messages get 75%+ open rates. Keep it conversational and include a clear CTA."}
              {channel === 'sms' && "📱 SMS best practice: Start with brand name, keep under 140 chars, one clear action."}
              {channel === 'email' && "📧 Email works great for win-back. A compelling subject line is 50% of your click rate."}
              {channel === 'rcs' && "✨ RCS allows rich cards with images. Perfect for VIP audiences expecting premium experiences."}
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>CHANNEL PERFORMANCE</div>
            {[
              { ch: 'whatsapp', delivery: 89, open: 72 },
              { ch: 'sms', delivery: 95, open: 45 },
              { ch: 'email', delivery: 82, open: 28 },
              { ch: 'rcs', delivery: 85, open: 65 },
            ].map(row => (
              <div key={row.ch} style={{ marginBottom: 10 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                  <span className={`channel-chip ${row.ch}`} style={{ fontSize: 11 }}>{row.ch}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.delivery}% delivery · {row.open}% open</span>
                </div>
                <div className="progress-bar-wrap">
                  <div className="progress-bar" style={{ width: `${row.open}%`, background: channel === row.ch ? 'var(--accent)' : 'var(--bg-hover)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewCampaignPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewCampaignContent />
    </Suspense>
  );
}
