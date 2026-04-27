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

// ── POST /api/workout ──────────────────────────────────────────────────────
app.post('/api/workout', async (req, res) => {
  const { systemPrompt, userMessage } = req.body;
  if (!systemPrompt || !userMessage) {
    return res.status(400).json({ error: 'Missing systemPrompt or userMessage' });
  }
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`
      },
      body: JSON.stringify({
        model: 'google/gemma-3-27b-it:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage  }
        ],
        max_tokens: 700,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('OpenRouter workout error:', err);
      return res.status(502).json({ error: 'OpenRouter error', details: err });
    }

    const data  = await response.json();
    const text  = data.choices?.[0]?.message?.content || '';
    const clean = text.replace(/```json|```/g, '').trim();
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
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`
      },
      body: JSON.stringify({
        model: 'google/gemma-3-27b-it:free',
        messages,
        max_tokens: 600,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('OpenRouter chat error:', err);
      return res.status(502).json({ error: 'OpenRouter error', details: err });
    }

    const data  = await response.json();
    const reply = data.choices?.[0]?.message?.content || null;
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
