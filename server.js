require('dotenv').config();
const express = require('express');
const path    = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const GROQ_KEY = process.env.GROQ_API_KEY;

if (!GROQ_KEY) {
  console.warn('⚠️  GROQ_API_KEY is not set. AI features will not work.');
}

// Groq's fastest + most reliable free models
const MODEL = 'llama-3.3-70b-versatile';

async function callGroq(messages, maxTokens, temperature) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature })
  });

  if (!response.ok) {
    const err = await response.json();
    console.error('Groq API error:', err);
    return null;
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || null;
  if (!text) { console.warn('Groq returned empty response'); return null; }
  console.log(`✓ Response from Groq (${MODEL})`);
  return text;
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
    const text = await callGroq(messages, 700, 0.7);
    if (!text) {
      return res.status(502).json({ error: 'AI is currently unavailable. Please try again in a moment.' });
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
    const reply = await callGroq(messages, 600, 0.8);
    if (!reply) {
      return res.status(502).json({ error: 'AI is currently unavailable. Please try again in a moment.' });
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
