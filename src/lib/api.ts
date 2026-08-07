async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    ...options.headers as any,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const api = {
  get: (url: string) => fetchWithAuth(url, { method: 'GET' }),
  post: (url: string, body: any) => fetchWithAuth(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url: string, body: any) => fetchWithAuth(url, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (url: string) => fetchWithAuth(url, { method: 'DELETE' }),
};
