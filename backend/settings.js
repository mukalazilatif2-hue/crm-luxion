const express = require('express');
const router = express.Router();
const db = require('./db');

// GET settings
router.get('/', async (_req, res) => {
  try {
    const result = await db.query('SELECT key, value FROM settings');
    const settings = {};

    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });

    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// SAVE settings
router.put('/', async (req, res) => {
  try {
    const entries = Object.entries(req.body);

    for (const [key, value] of entries) {
      await db.query(
        `
        INSERT INTO settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key)
        DO UPDATE SET value = EXCLUDED.value
        `,
        [key, value]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;
