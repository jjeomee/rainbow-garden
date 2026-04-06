// api/match.js — Vercel 서버리스 함수
const https = require('https');

function claudeRequest(apiKey, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { reject(new Error('JSON 파싱 실패: ' + body.slice(0,100))); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) { res.status(500).json({ error: 'API 키 미설정' }); return; }

  const { kongImage, dogs } = req.body || {};
  if (!kongImage || !dogs?.length) {
    res.status(400).json({ error: '요청 데이터 부족' }); return;
  }

  const callClaude = async (messages, maxTokens = 30) => {
    const result = await claudeRequest(API_KEY, {
      model: 'claude-haiku-4-5',
      max_tokens: maxTokens,
      messages
    });
    if (result.error) throw new Error(result.error.message);
    return result.content?.[0]?.text?.trim() || '';
  };

  try {
    // Step 1: 콩이 품종 분석
    const kongBreed = await callClaude([{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: kongImage.mime, data: kongImage.data } },
        { type: 'text', text: '이 강아지 품종을 한국어로 10자 이내로만 답하세요. 예: 말티즈' }
      ]
    }]);
    console.log('품종 분석:', kongBreed);

    // Step 2: 동일 품종 우선
    const fw = kongBreed.slice(0, 3);
    const same = fw ? dogs.filter(d => d.breed && d.breed.includes(fw)) : [];
    const pool = same.length >= 1 ? same : dogs;
    if (pool.length === 1) { res.json({ name: pool[0].name, breed: kongBreed }); return; }

    // Step 3: 외모 비교
    const content = [
      { type: 'image', source: { type: 'base64', media_type: kongImage.mime, data: kongImage.data } },
      { type: 'text', text: '위 강아지(품종:' + kongBreed + ')와 가장 닮은 강아지 번호만 숫자 하나로:' }
    ];
    pool.forEach((d, i) => {
      content.push({ type: 'text', text: (i+1) + '번 ' + d.name + '(' + d.breed + ')' });
      if (d.photo) content.push({ type: 'image', source: { type: 'base64', media_type: d.photo.mime, data: d.photo.data } });
    });

    const answer = await callClaude([{ role: 'user', content }], 5);
    const idx = Math.max(0, Math.min(parseInt(answer) - 1, pool.length - 1));
    console.log('매칭 결과:', pool[idx].name);
    res.json({ name: pool[idx].name, breed: kongBreed });

  } catch (e) {
    console.error('match error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
