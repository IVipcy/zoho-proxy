const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fetch = require('node-fetch');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// トークンキャッシュ
let cachedToken = null;
let tokenExpiry = 0;

async function getZohoToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch('https://accounts.zoho.jp/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + 55 * 60 * 1000;
  return cachedToken;
}

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// ヘルスチェック
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Zoho CRM 商談作成
app.post('/api/deals', async (req, res) => {
  try {
    const { payload } = req.body;
    let token = await getZohoToken();
    let response = await fetch('https://www.zohoapis.jp/crm/v2/Deals', {
      method: 'POST',
      headers: { 'Authorization': `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [payload] }),
    });
    if (response.status === 401) {
      cachedToken = null;
      token = await getZohoToken();
      response = await fetch('https://www.zohoapis.jp/crm/v2/Deals', {
        method: 'POST',
        headers: { 'Authorization': `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [payload] }),
      });
    }
    const result = await response.json();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Zoho CRM 汎用モジュール送信
app.post('/api/custom', async (req, res) => {
  try {
    const { module, payload } = req.body;
    if (!module || !payload) {
      return res.status(400).json({ error: 'module and payload are required' });
    }
    let token = await getZohoToken();
    const url = `https://www.zohoapis.jp/crm/v2/${module}`;
    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [payload] }),
    });
    if (response.status === 401) {
      cachedToken = null;
      token = await getZohoToken();
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [payload] }),
      });
    }
    const result = await response.json();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Whisper 文字起こし
app.post('/api/whisper', upload.single('file'), async (req, res) => {
  try {
    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append('file', blob, req.file.originalname || 'recording.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'ja');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: formData,
    });
    const result = await response.json();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Claude 自動入力
app.post('/api/claude', async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });
    const result = await response.json();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
