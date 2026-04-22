// routes/invoices.js — CRUD for invoices
'use strict';
const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/invoices — list all, optional ?status= filter
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let query  = 'SELECT * FROM invoices ORDER BY created_at DESC';
    let params = [];
    if (status && status !== 'all') {
      if (status === 'Overdue') {
        query  = "SELECT * FROM invoices WHERE status != 'Paid' AND due_date < NOW() ORDER BY due_date ASC";
      } else {
        query  = 'SELECT * FROM invoices WHERE status = $1 ORDER BY created_at DESC';
        params = [status];
      }
    }
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoices/:id — single invoice
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices — create invoice
router.post('/', async (req, res) => {
  const { number, client, project, invoice_date, due_date, amount, status, notes } = req.body;
  if (!client) return res.status(400).json({ error: 'client is required' });
  try {
    // Auto-generate invoice number if not provided
    let invNumber = number;
    if (!invNumber) {
      const countRes = await db.query('SELECT COUNT(*) FROM invoices');
      const n = parseInt(countRes.rows[0].count) + 1;
      const year = new Date().getFullYear();
      invNumber = `INV-${year}-${String(n).padStart(3, '0')}`;
    }
    const result = await db.query(
      `INSERT INTO invoices (number, client, project, invoice_date, due_date, amount, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [invNumber, client, project||'', invoice_date||new Date().toISOString().split('T')[0],
       due_date||null, parseInt(amount)||0, status||'Unpaid', notes||'']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/invoices/:id — update invoice
router.put('/:id', async (req, res) => {
  const { client, project, invoice_date, due_date, amount, status, notes } = req.body;
  try {
    const result = await db.query(
      `UPDATE invoices SET
        client=$1, project=$2, invoice_date=$3, due_date=$4,
        amount=$5, status=$6, notes=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [client, project||'', invoice_date, due_date||null,
       parseInt(amount)||0, status, notes||'', req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/invoices/:id/status — quick status update (mark paid, partial)
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });
  try {
    const result = await db.query(
      'UPDATE invoices SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/invoices/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM invoices WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
