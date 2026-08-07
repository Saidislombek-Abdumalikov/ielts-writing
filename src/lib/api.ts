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
    let errorMessage = '';
    try {
      const errorData = await response.clone().json();
      errorMessage = typeof errorData.error === 'string'
        ? errorData.error
        : typeof errorData.message === 'string'
        ? errorData.message
        : '';
    } catch {
      try {
        const textData = await response.clone().text();
        if (textData && !textData.startsWith('<!DOCTYPE')) {
          errorMessage = textData;
        }
      } catch {}
    }

    if (!errorMessage) {
      if (response.status === 500) {
        errorMessage = 'Server Error (500): Unable to process request. Please check server logs or database credentials.';
      } else {
        errorMessage = `Request failed with status ${response.status}`;
      }
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

export const api = {
  get: (url: string) => fetchWithAuth(url, { method: 'GET' }),
  post: (url: string, body: any) => fetchWithAuth(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url: string, body: any) => fetchWithAuth(url, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (url: string) => fetchWithAuth(url, { method: 'DELETE' }),
};
