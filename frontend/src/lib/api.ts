const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Customers
export const customersApi = {
  list: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return apiRequest<any>(`/customers${qs ? '?' + qs : ''}`);
  },
  stats: () => apiRequest<any>('/customers/stats'),
  get: (id: string) => apiRequest<any>(`/customers/${id}`),
  create: (data: any) => apiRequest<any>('/customers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => apiRequest<any>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiRequest<any>(`/customers/${id}`, { method: 'DELETE' }),
  importCsv: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${API_BASE}/customers/import`, { method: 'POST', body: form }).then(r => r.json());
  },
};

// Segments
export const segmentsApi = {
  list: () => apiRequest<any>('/segments'),
  get: (id: string) => apiRequest<any>(`/segments/${id}`),
  create: (data: any) => apiRequest<any>('/segments', { method: 'POST', body: JSON.stringify(data) }),
  preview: (filter_sql: string) => apiRequest<any>('/segments/preview', { method: 'POST', body: JSON.stringify({ filter_sql }) }),
  delete: (id: string) => apiRequest<any>(`/segments/${id}`, { method: 'DELETE' }),
};

// Campaigns
export const campaignsApi = {
  list: () => apiRequest<any>('/campaigns'),
  overview: () => apiRequest<any>('/campaigns/overview'),
  get: (id: string) => apiRequest<any>(`/campaigns/${id}`),
  create: (data: any) => apiRequest<any>('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  launch: (id: string) => apiRequest<any>(`/campaigns/${id}/launch`, { method: 'POST' }),
  streamUrl: (id: string) => `${API_BASE}/campaigns/${id}/stream`,
};

// AI
export const aiApi = {
  chat: (message: string, history: any[] = []) =>
    apiRequest<any>('/ai/chat', { method: 'POST', body: JSON.stringify({ message, history }) }),
  segment: (description: string) =>
    apiRequest<any>('/ai/segment', { method: 'POST', body: JSON.stringify({ description }) }),
  draft: (segment_description: string, channel: string, campaign_goal: string) =>
    apiRequest<any>('/ai/draft', { method: 'POST', body: JSON.stringify({ segment_description, channel, campaign_goal }) }),
};
