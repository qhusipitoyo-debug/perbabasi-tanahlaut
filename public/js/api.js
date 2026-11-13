/**
 * Wrapper fetch ke backend dengan JWT Bearer otomatis.
 * Jika server membalas 401 → sesi dianggap berakhir, paksa logout.
 */
const TOKEN_KEY = 'ptl_token';
const USER_KEY = 'ptl_user';

export const authStore = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token) => localStorage.setItem(TOKEN_KEY, token),
  getUser: () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  },
  setUser: (user) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  clear: () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },
};

async function request(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  const token = authStore.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Tidak dapat terhubung ke server. Periksa koneksi Anda.');
  }

  if (res.status === 401 && path !== '/api/auth/login') {
    authStore.clear();
    window.dispatchEvent(new CustomEvent('ptl:unauthorized'));
    throw new Error('Sesi berakhir. Silakan login kembali.');
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!res.ok) throw new Error(`Permintaan gagal (HTTP ${res.status})`);
    return null;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Permintaan gagal (HTTP ${res.status})`);
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  /** Download file (CSV / backup DB) dengan token terlampir */
  async download(path, fallbackName) {
    const headers = {};
    const token = authStore.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(path, { headers });
    if (!res.ok) {
      let msg = `Unduhan gagal (HTTP ${res.status})`;
      try { msg = (await res.json()).error || msg; } catch { /* abaikan */ }
      throw new Error(msg);
    }
    const disposition = res.headers.get('content-disposition') || '';
    const match = /filename="?([^";]+)"?/.exec(disposition);
    const filename = match ? match[1] : fallbackName || 'unduhan';
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
