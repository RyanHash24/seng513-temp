const { Pool } = require('pg');
const pool = new Pool();
const express = require('express');
const app = express();
const PORT = 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/db-health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ database: 'connected' });
  } catch (error) {
    console.error('Database connection failed:', error);
    res.status(503).json({ database: 'unavailable' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

