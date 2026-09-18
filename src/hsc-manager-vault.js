/**
 * Manager vault logins. PIN 6310.
 * Passwords live in KV (hsc-mgr-vault:logins), never in the public HTML.
 */

const PIN = '6310';
const KEY = 'hsc-mgr-vault:logins';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function vaultAuthed(request) {
  const url = new URL(request.url);
  const sent = request.headers.get('x-vault-pin') || url.searchParams.get('pin') || '';
  return String(sent).trim() === PIN;
}

function cleanLogin(raw, prev) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const id = String(src.id || prev?.id || ('login-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)));
  return {
    id,
    name: String(src.name || prev?.name || '').trim(),
    url: String(src.url || prev?.url || '').trim(),
    username: String(src.username || prev?.username || '').trim(),
    password: String(src.password != null ? src.password : (prev?.password || '')),
    notes: String(src.notes || prev?.notes || '').trim(),
  };
}

async function readStore(env) {
  const data = (await env.PLANNER_DATA.get(KEY, { type: 'json' })) || {};
  const logins = Array.isArray(data.logins) ? data.logins : [];
  return { logins };
}

async function writeStore(env, store) {
  await env.PLANNER_DATA.put(KEY, JSON.stringify({ logins: store.logins }));
}

export async function handleHscVaultLogins(request, env) {
  if (!vaultAuthed(request)) {
    return json({ success: false, error: 'PIN required.' }, 401);
  }

  if (request.method === 'GET') {
    const store = await readStore(env);
    return json({ success: true, logins: store.logins });
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ success: false, error: 'Invalid JSON.' }, 400);
    }
    const store = await readStore(env);
    const incoming = Array.isArray(body.logins) ? body.logins : (body.login ? [body.login] : []);
    if (!incoming.length) return json({ success: false, error: 'No logins to save.' }, 400);

    const byId = new Map(store.logins.map((row) => [row.id, row]));
    for (const row of incoming) {
      const prev = row.id ? byId.get(row.id) : null;
      const next = cleanLogin(row, prev);
      if (!next.name) return json({ success: false, error: 'Name is required.' }, 400);
      byId.set(next.id, next);
    }
    store.logins = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    await writeStore(env, store);
    return json({ success: true, logins: store.logins });
  }

  if (request.method === 'DELETE') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ success: false, error: 'Invalid JSON.' }, 400);
    }
    const id = String(body.id || '').trim();
    if (!id) return json({ success: false, error: 'Missing id.' }, 400);
    const store = await readStore(env);
    store.logins = store.logins.filter((row) => row.id !== id);
    await writeStore(env, store);
    return json({ success: true, logins: store.logins });
  }

  return json({ success: false, error: 'Method not allowed.' }, 405);
}
