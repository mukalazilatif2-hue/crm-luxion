// routes/catalogue.js — CRUD for price catalogue items
'use strict';
const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/catalogue — list all items, optional ?category= filter
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    let query  = 'SELECT * FROM catalogue_items ORDER BY category, name';
    let params = [];
    if (category && category !== 'all') {
      query  = 'SELECT * FROM catalogue_items WHERE category = $1 ORDER BY name';
      params = [category];
    }
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/catalogue/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM catalogue_items WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/catalogue — create item
router.post('/', async (req, res) => {
  const { name, category, unit, unit_cost } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'name and category are required' });
  try {
    const result = await db.query(
      `INSERT INTO catalogue_items (name, category, unit, unit_cost)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, category, unit||'unit', parseInt(unit_cost)||0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/catalogue/:id — update item
router.put('/:id', async (req, res) => {
  const { name, category, unit, unit_cost } = req.body;
  try {
    const result = await db.query(
      `UPDATE catalogue_items SET name=$1, category=$2, unit=$3, unit_cost=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [name, category, unit||'unit', parseInt(unit_cost)||0, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/catalogue/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM catalogue_items WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
