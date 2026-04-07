// api/activity.js — Upstash Redis REST API 사용
const ACT_KEY = 'rg_activity';
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
      const acts = await kv_get(ACT_KEY) || [];
      res.status(200).json(acts); return;
    }
    if (req.method === 'POST') {
      const { action, dogId, type } = req.body;
      if (action === 'clear') {
        await kv_set(ACT_KEY, []);
        res.status(200).json({ ok: true }); return;
      }
      // 활동 추가
      const acts = await kv_get(ACT_KEY) || [];
      acts.push({ dogId, type, at: new Date().toISOString() });
      await kv_set(ACT_KEY, acts);
      // 강아지 카운트 업데이트
      const dogs = await kv_get(DOGS_KEY) || [];
      const dog = dogs.find(d => d.id === dogId);
      if (dog) {
        if (type === 'friend') dog.friendCount = (dog.friendCount || 0) + 1;
        if (type === 'adopt') { dog.adoptCount = (dog.adoptCount || 0) + 1; dog.status = 'adopted'; }
        await kv_set(DOGS_KEY, dogs);
      }
      res.status(200).json({ ok: true }); return;
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('activity error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
