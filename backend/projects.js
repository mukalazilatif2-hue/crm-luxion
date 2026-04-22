// routes/projects.js — CRUD for projects
'use strict';
const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/projects — list all, optional ?type= or ?status= filter
router.get('/', async (req, res) => {
  try {
    const { type, status } = req.query;
    let query  = 'SELECT * FROM projects ORDER BY created_at DESC';
    let params = [];
    if (type && type !== 'all') {
      query  = 'SELECT * FROM projects WHERE type = $1 ORDER BY created_at DESC';
      params = [type];
    } else if (status && status !== 'all') {
      if (status === 'active') {
        query  = "SELECT * FROM projects WHERE status != 'Completed' ORDER BY created_at DESC";
      } else {
        query  = 'SELECT * FROM projects WHERE status = $1 ORDER BY created_at DESC';
        params = [status];
      }
    }
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects — create project
router.post('/', async (req, res) => {
  const { name, client, type, status, assigned, value, start_date, end_date, notes, progress } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await db.query(
      `INSERT INTO projects (name, client, type, status, assigned, value, start_date, end_date, notes, progress)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, client||'', type||'Website', status||'Discovery',
       assigned||'', parseInt(value)||0,
       start_date||null, end_date||null, notes||'', parseInt(progress)||0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id — update project
router.put('/:id', async (req, res) => {
  const { name, client, type, status, assigned, value, start_date, end_date, notes, progress } = req.body;
  try {
    const result = await db.query(
      `UPDATE projects SET
        name=$1, client=$2, type=$3, status=$4, assigned=$5,
        value=$6, start_date=$7, end_date=$8, notes=$9, progress=$10,
        updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [name, client||'', type, status, assigned||'',
       parseInt(value)||0, start_date||null, end_date||null,
       notes||'', parseInt(progress)||0, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
