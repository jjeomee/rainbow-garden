// api/match.js — Vercel 서버리스 함수
// API 키는 Vercel 환경변수 ANTHROPIC_API_KEY 에 저장

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) { res.status(500).json({ error: 'API 키 미설정' }); return; }

  const { kongImage, dogs } = req.body;
  if (!kongImage || !dogs?.length) {
    res.status(400).json({ error: '요청 데이터 부족' }); return;
  }

  try {
    const callClaude = async (messages, maxTokens = 30) => {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: maxTokens,
          messages
        })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error.message);
      return data.content?.[0]?.text?.trim() || '';
    };

    // Step 1: 콩이 품종 분석
    const kongBreed = await callClaude([{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: kongImage.mime, data: kongImage.data } },
        { type: 'text', text: '이 강아지 품종을 한국어로 10자 이내로만 답해주세요. 예: 말티즈' }
      ]
    }]);

    // Step 2: 동일 품종 우선
    const fw = kongBreed.slice(0, 3);
    const same = fw ? dogs.filter(d => d.breed && d.breed.includes(fw)) : [];
    const pool = same.length >= 1 ? same : dogs;

    if (pool.length === 1) {
      res.json({ name: pool[0].name, breed: kongBreed });
      return;
    }

    // Step 3: 외모 비교
    const content = [
      { type: 'image', source: { type: 'base64', media_type: kongImage.mime, data: kongImage.data } },
      { type: 'text', text: `위 강아지(품종:${kongBreed})와 가장 닮은 강아지 번호만 숫자 하나로:` }
    ];
    pool.forEach((d, i) => {
      content.push({ type: 'text', text: `${i+1}번 ${d.name}(${d.breed})` });
      if (d.photo) {
        content.push({ type: 'image', source: { type: 'base64', media_type: d.photo.mime, data: d.photo.data } });
      }
    });

    const answer = await callClaude([{ role: 'user', content }], 5);
    const idx = Math.max(0, Math.min(parseInt(answer) - 1, pool.length - 1));
    res.json({ name: pool[idx].name, breed: kongBreed });

  } catch (e) {
    console.error('match error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
