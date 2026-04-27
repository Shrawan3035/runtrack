require('dotenv').config();
const express = require('express');
const path    = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_KEY) {
  console.warn('⚠️  OPENROUTER_API_KEY is not set. AI features will not work.');
}

// ── FALLBACK MODEL CHAIN ───────────────────────────────────────────────────
const MODELS = [
  'google/gemma-3-27b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'deepseek/deepseek-r1:free',
  'qwen/qwen3-8b:free',
  'openrouter/free'
];

async function callWithFallback(messages, maxTokens, temperature) {
  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_KEY}`
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature })
      });

      if (response.status === 429 || response.status === 404) {
        const err = await response.json();
        console.warn(`Model ${model} unavailable (${response.status}), trying next…`);
        continue;
      }

      if (!response.ok) {
        const err = await response.json();
        console.error(`Model ${model} error:`, err);
        continue;
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || null;
      if (!text) { console.warn(`Model ${model} returned empty response, trying next…`); continue; }
      console.log(`✓ Response from: ${model}`);
      return text;

    } catch (e) {
      console.warn(`Model ${model} threw an error: ${e.message}, trying next…`);
      continue;
    }
  }
  return null;
}

// ── POST /api/workout ──────────────────────────────────────────────────────
app.post('/api/workout', async (req, res) => {
  const { systemPrompt, userMessage } = req.body;
  if (!systemPrompt || !userMessage) {
    return res.status(400).json({ error: 'Missing systemPrompt or userMessage' });
  }
  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  }
    ];
    const text = await callWithFallback(messages, 700, 0.7);
    if (!text) {
      return res.status(502).json({ error: 'All AI models are currently unavailable. Please try again in a moment.' });
    }
    const clean   = text.replace(/```json|```/g, '').trim();
    const workout = JSON.parse(clean);
    res.json({ workout });
  } catch (e) {
    console.error('Workout generation failed:', e.message);
    res.status(500).json({ error: 'Failed to generate workout suggestion' });
  }
});

// ── POST /api/chat ─────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing or invalid messages array' });
  }
  try {
    const reply = await callWithFallback(messages, 600, 0.8);
    if (!reply) {
      return res.status(502).json({ error: 'All AI models are currently unavailable. Please try again in a moment.' });
    }
    res.json({ reply });
  } catch (e) {
    console.error('Chat request failed:', e.message);
    res.status(500).json({ error: 'Failed to get chat response' });
  }
});

// ── Catch-all: serve index.html for any unknown route ──────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🏃 RunTrack running on http://localhost:${PORT}`);
});
