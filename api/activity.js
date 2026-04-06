// api/activity.js — 활동 내역 (Vercel KV)
import { kv } from '@vercel/kv';

const ACT_KEY = 'rg_activity';
const DOGS_KEY = 'rg_admin_dogs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    if (req.method === 'GET') {
      const acts = await kv.get(ACT_KEY) || [];
      res.status(200).json(acts);
      return;
    }

    if (req.method === 'POST') {
      const { action, dogId, type } = req.body;

      if (action === 'clear') {
        await kv.set(ACT_KEY, []);
        res.status(200).json({ ok: true });
        return;
      }

      // 활동 추가 + 강아지 카운트 업데이트
      const acts = await kv.get(ACT_KEY) || [];
      acts.push({ dogId, type, at: new Date().toISOString() });
      await kv.set(ACT_KEY, acts);

      // 강아지 카운트 업데이트
      const dogs = await kv.get(DOGS_KEY) || [];
      const dog = dogs.find(d => d.id === dogId);
      if (dog) {
        if (type === 'friend') dog.friendCount = (dog.friendCount || 0) + 1;
        if (type === 'adopt') { dog.adoptCount = (dog.adoptCount || 0) + 1; dog.status = 'adopted'; }
        await kv.set(DOGS_KEY, dogs);
      }

      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('activity api error:', e);
    res.status(500).json({ error: e.message });
  }
}
