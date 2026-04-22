// routes/leads.js — CRUD for leads/deals
'use strict';
const express = require('express');
const router  = express.Router();
const db = require('./db');

// GET /api/leads — list all, optional ?stage= filter
router.get('/', async (req, res) => {
  try {
    const { stage } = req.query;
    let query  = 'SELECT * FROM leads ORDER BY created_at DESC';
    let params = [];
    if (stage) {
      query  = 'SELECT * FROM leads WHERE stage = $1 ORDER BY created_at DESC';
      params = [stage];
    }
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /leads:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leads/:id — single lead
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads — create new lead
router.post('/', async (req, res) => {
  const { name, biz, phone, email, service, value, stage, priority, source, followup, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await db.query(
      `INSERT INTO leads (name, biz, phone, email, service, value, stage, priority, source, followup, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [name, biz||'', phone||'', email||'', service||'Website',
       parseInt(value)||0, stage||'New', priority||'Medium',
       source||'Direct', followup||null, notes||'']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/leads/:id — update lead
router.put('/:id', async (req, res) => {
  const { name, biz, phone, email, service, value, stage, priority, source, followup, notes } = req.body;
  try {
    const result = await db.query(
      `UPDATE leads SET
        name=$1, biz=$2, phone=$3, email=$4, service=$5, value=$6,
        stage=$7, priority=$8, source=$9, followup=$10, notes=$11,
        updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [name, biz||'', phone||'', email||'', service,
       parseInt(value)||0, stage, priority, source, followup||null,
       notes||'', req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/leads/:id — delete lead
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM leads WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
