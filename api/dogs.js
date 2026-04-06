// api/dogs.js — 강아지 명단 CRUD (Vercel KV)
import { kv } from '@vercel/kv';

const DOGS_KEY = 'rg_admin_dogs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    // GET: 강아지 목록 조회
    if (req.method === 'GET') {
      const dogs = await kv.get(DOGS_KEY) || [];
      res.status(200).json(dogs);
      return;
    }

    // POST: 강아지 등록 or 전체 덮어쓰기
    if (req.method === 'POST') {
      const { action, dog, dogs } = req.body;

      if (action === 'save_all') {
        // 전체 목록 저장 (수정/삭제 후)
        await kv.set(DOGS_KEY, dogs);
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'add') {
        const list = await kv.get(DOGS_KEY) || [];
        list.push(dog);
        await kv.set(DOGS_KEY, list);
        res.status(200).json({ ok: true, dog });
        return;
      }

      if (action === 'update') {
        const list = await kv.get(DOGS_KEY) || [];
        const idx = list.findIndex(d => d.id === dog.id);
        if (idx >= 0) list[idx] = dog;
        await kv.set(DOGS_KEY, list);
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'delete') {
        const { id } = req.body;
        const list = await kv.get(DOGS_KEY) || [];
        const filtered = list.filter(d => d.id !== id);
        await kv.set(DOGS_KEY, filtered);
        res.status(200).json({ ok: true });
        return;
      }

      res.status(400).json({ error: 'Unknown action' });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('dogs api error:', e);
    res.status(500).json({ error: e.message });
  }
}
