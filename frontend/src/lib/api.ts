const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('reachiq_token');
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as any) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { headers, ...options });

  if (res.status === 401) {
    // Token expired or invalid — clear it and redirect to login
    if (typeof window !== 'undefined') {
      localStorage.removeItem('reachiq_token');
      localStorage.removeItem('reachiq_user');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Auth
export const authApi = {
  register: (data: { company_name: string; email: string; password: string }) =>
    apiRequest<any>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    apiRequest<any>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => apiRequest<any>('/auth/me'),
};

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
    const token = getToken();
    const form = new FormData();
    form.append('file', file);
    return fetch(`${API_BASE}/customers/import`, {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(r => r.json());
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
  streamUrl: (id: string) => {
    const token = getToken();
    return `${API_BASE}/campaigns/${id}/stream${token ? `?token=${token}` : ''}`;
  },
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
