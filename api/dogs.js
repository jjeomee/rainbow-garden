// api/dogs.js — Upstash Redis REST API 사용
const DOGS_KEY = 'rg_admin_dogs';

async function kv_get(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const res = await fetch(`${url}/get/${key}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (!data.result) return null;
  try { return JSON.parse(data.result); } catch(e) { return data.result; }
}

async function kv_set(key, value) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  await fetch(`${url}/set/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(value))
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    if (req.method === 'GET') {
      const dogs = await kv_get(DOGS_KEY) || [];
      res.status(200).json(dogs);
      return;
    }
    if (req.method === 'POST') {
      const { action, dog, dogs, id } = req.body;
      if (action === 'save_all') {
        await kv_set(DOGS_KEY, dogs);
        res.status(200).json({ ok: true }); return;
      }
      if (action === 'add') {
        const list = await kv_get(DOGS_KEY) || [];
        list.push(dog);
        await kv_set(DOGS_KEY, list);
        res.status(200).json({ ok: true }); return;
      }
      if (action === 'update') {
        const list = await kv_get(DOGS_KEY) || [];
        const idx = list.findIndex(d => d.id === dog.id);
        if (idx >= 0) list[idx] = dog;
        await kv_set(DOGS_KEY, list);
        res.status(200).json({ ok: true }); return;
      }
      if (action === 'delete') {
        const list = await kv_get(DOGS_KEY) || [];
        await kv_set(DOGS_KEY, list.filter(d => d.id !== id));
        res.status(200).json({ ok: true }); return;
      }
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('dogs error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
