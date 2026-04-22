// server.js — Luxion CRM Backend
// Owner: Latif Mukalazi | Luxion Solutions Limited, Kampala Uganda
'use strict';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const pool    = require('./db');

// Route modules
const leadsRouter = require('./leads');
const invoicesRouter = require('./invoices');
const projectsRouter = require('./projects');
const catalogueRouter = require('./catalogue');
const settingsRouter = require('./settings');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────
app.use(express.json());

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// ── Health check ────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', system: 'Luxion Operations System', owner: 'Latif Mukalazi' });
});

// ── API routes ──────────────────────────────────────────────
app.use('/api/leads',     leadsRouter);
app.use('/api/invoices',  invoicesRouter);
app.use('/api/projects',  projectsRouter);
app.use('/api/catalogue', catalogueRouter);
app.use('/api/settings', settingsRouter);

// ── Global error handler ────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Luxion CRM backend running on port ${PORT}`);
});
