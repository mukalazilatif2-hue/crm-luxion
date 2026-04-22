// ================================================================
// Luxion Operations System — Frontend Application
// Owner: Latif Mukalazi | Luxion Solutions Limited, Kampala Uganda
// Vanilla JS. Talks to Node/Express backend via REST API.
// Falls back to localStorage if backend is unreachable.
// ================================================================
'use strict';

// ── Config ──────────────────────────────────────────────────
// Read API URL from localStorage (set in Settings page) or default
function getApiUrl() {
  return (localStorage.getItem('luxion_api_url') || '').replace(/\/$/, '');
}

// ── In-memory cache (mirrors what the backend holds) ────────
let appData = {
  leads:     [],
  invoices:  [],
  projects:  [],
  catalogue: [],
  settings:  { markup: 40 }
};

// Track pipeline chart instance so we can destroy/recreate it
let pipelineChartInstance = null;

// Quote builder state
let quoteLines = []; // [{ itemId, qty }]

// Filter state
let currentLeadStageFilter    = 'all';
let currentInvFilter          = 'all';
let currentProjFilter         = 'all';
let currentCatalogueFilter    = 'all';
let currentPage               = 'dashboard';

// ── API Helper ───────────────────────────────────────────────
async function api(method, path, body) {
  const base = getApiUrl();
  if (!base) {
    // No backend configured — fall back to localStorage
    return null;
  }
  showLoader(true);
  try {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(base + path, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (e) {
    console.warn('API error:', e.message);
    showToast('⚠️ Backend error: ' + e.message);
    return null;
  } finally {
    showLoader(false);
  }
}

function showLoader(on) {
  document.getElementById('apiLoader').classList.toggle('active', on);
}

// ── LocalStorage persistence (offline / no-backend fallback) ─
function saveLocal() {
  try { localStorage.setItem('luxion_crm_v2', JSON.stringify(appData)); } catch(e) {}
}

function loadLocal() {
  try {
    const d = localStorage.getItem('luxion_crm_v2');
    if (d) appData = { ...appData, ...JSON.parse(d) };
  } catch(e) {}
}

// ── Normalise rows from backend (snake_case → camelCase) ─────
function normLead(r) {
  return {
    id:       r.id,
    name:     r.name || '',
    biz:      r.biz || '',
    phone:    r.phone || '',
    email:    r.email || '',
    service:  r.service || '',
    value:    parseInt(r.value) || 0,
    stage:    r.stage || 'New',
    priority: r.priority || 'Medium',
    source:   r.source || '',
    followup: r.followup ? r.followup.split('T')[0] : '',
    notes:    r.notes || '',
    date:     r.created_at ? r.created_at.split('T')[0] : ''
  };
}

function normInvoice(r) {
  return {
    id:      r.id,
    number:  r.number || '',
    client:  r.client || '',
    project: r.project || '',
    date:    r.invoice_date ? r.invoice_date.split('T')[0] : '',
    due:     r.due_date ? r.due_date.split('T')[0] : '',
    amount:  parseInt(r.amount) || 0,
    status:  r.status || 'Unpaid',
    notes:   r.notes || ''
  };
}

function normProject(r) {
  return {
    id:       r.id,
    name:     r.name || '',
    client:   r.client || '',
    type:     r.type || 'Website',
    status:   r.status || 'Discovery',
    assigned: r.assigned || '',
    value:    parseInt(r.value) || 0,
    start:    r.start_date ? r.start_date.split('T')[0] : '',
    end:      r.end_date   ? r.end_date.split('T')[0]   : '',
    notes:    r.notes || '',
    progress: parseInt(r.progress) || 0
  };
}

function normCatalogueItem(r) {
  return {
    id:       r.id,
    name:     r.name || '',
    category: r.category || 'General',
    unit:     r.unit || 'pcs',
    unitCost: parseInt(r.unit_cost) || 0,
    notes:    r.notes || '',
    updated:  r.updated_at ? r.updated_at.split('T')[0] : ''
  };
}

// ── Load all data (try backend, fall back to local) ──────────
async function loadAllData() {
  const base = getApiUrl();
  if (base) {
    const [leads, invoices, projects, catalogue, settings] = await Promise.all([
      api('GET', '/api/leads'),
      api('GET', '/api/invoices'),
      api('GET', '/api/projects'),
      api('GET', '/api/catalogue'),
      api('GET', '/api/settings')
    ]);
    if (leads)     appData.leads     = leads.map(normLead);
    if (invoices)  appData.invoices  = invoices.map(normInvoice);
    if (projects)  appData.projects  = projects.map(normProject);
    if (catalogue) appData.catalogue = catalogue.map(normCatalogueItem);
    if (settings) {
      appData.settings = {
        ...appData.settings,
        ...settings
      };
    }
    saveLocal();
  } else {
    // No backend: use localStorage (offline mode)
    loadLocal();
  }
}

// ── Navigation ───────────────────────────────────────────────
const pageTitles = {
  dashboard: ['Dashboard',        'Sales, projects, pricing, and profit in one place.'],
  leads:     ['Leads & Deals',    'Manage your sales pipeline'],
  pricing:   ['Pricing Engine',   'Calculate costs and protect your profit'],
  invoices:  ['Invoices',         'Track payments and outstanding balances'],
  projects:  ['Projects',         'Monitor delivery and execution'],
  settings:  ['Settings',         'Manage preferences and defaults']
};

const topbarCtaLabels = {
  dashboard: ['New Lead',   () => openLeadModal()],
  leads:     ['New Lead',   () => openLeadModal()],
  pricing:   ['Clear All',  () => clearPricing()],
  invoices:  ['New Invoice',() => openInvoiceModal()],
  projects:  ['New Project',() => openProjectModal()],
  settings:  ['Save',       () => saveSettings()]
};

function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');

  // Sidebar active state
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active',
      !!(n.getAttribute('onclick') && n.getAttribute('onclick').includes("'" + page + "'"))
    );
  });

  // Bottom nav active state
  document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));
  const bnav = document.getElementById('bnav-' + page);
  if (bnav) bnav.classList.add('active');

  const [title, sub] = pageTitles[page];
  document.getElementById('topbarTitle').textContent = title;
  document.getElementById('topbarSub').textContent = sub;
  const [ctaLabel] = topbarCtaLabels[page];
  document.getElementById('topbarCta').innerHTML =
    `<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>${ctaLabel}`;

  currentPage = page;
  closeSidebar();
  renderPage(page);
}

function topbarAction() {
  const [, fn] = topbarCtaLabels[currentPage];
  fn();
}

function renderPage(page) {
  if (page === 'dashboard') renderDashboard();
  else if (page === 'leads')   renderLeads();
  else if (page === 'pricing') initPricing();
  else if (page === 'invoices') renderInvoices();
  else if (page === 'projects') renderProjects();
}

// ── Sidebar ──────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('active');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

// ── Format helpers ───────────────────────────────────────────
function fmtUGX(n) {
  n = parseInt(n) || 0;
  if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return 'UGX ' + Math.round(n / 1000) + 'K';
  return 'UGX ' + n.toLocaleString();
}

function fmtUGXFull(n) {
  return 'UGX ' + (parseInt(n) || 0).toLocaleString();
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOverdue(due) {
  if (!due) return false;
  return new Date(due) < new Date();
}

function setSelect(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  for (let i = 0; i < el.options.length; i++) {
    if (el.options[i].value === val || el.options[i].text === val) {
      el.selectedIndex = i; return;
    }
  }
}

// ── Badge helpers ────────────────────────────────────────────
function stageBadge(s) {
  const map = {
    'New': 'badge-blue', 'Contacted': 'badge-navy', 'Meeting Scheduled': 'badge-gold',
    'Quoted': 'badge-amber', 'Negotiation': 'badge-amber', 'Won': 'badge-green', 'Lost': 'badge-red'
  };
  return `<span class="badge ${map[s] || 'badge-gray'}">${s}</span>`;
}

function priorityBadge(p) {
  const map = { 'Low': 'badge-gray', 'Medium': 'badge-blue', 'High': 'badge-amber', 'Strategic': 'badge-gold' };
  return `<span class="badge ${map[p] || 'badge-gray'}">${p}</span>`;
}

function invoiceBadge(s, due) {
  if (s === 'Paid')    return `<span class="badge badge-green">✓ Paid</span>`;
  if (s === 'Partial') return `<span class="badge badge-amber">≈ Partial</span>`;
  if (isOverdue(due))  return `<span class="badge badge-red">⚠ Overdue</span>`;
  return `<span class="badge badge-navy">Unpaid</span>`;
}

function projectStatusBadge(s) {
  const active = ['Discovery','Design','Development','Review','Site Survey','Quotation','Installation','Testing'];
  if (s === 'Completed')    return `<span class="badge badge-green">✓ ${s}</span>`;
  if (active.includes(s))   return `<span class="badge badge-blue">${s}</span>`;
  return `<span class="badge badge-gray">${s}</span>`;
}

function typeIcon(t) {
  if (t === 'CCTV')        return { icon: '📷', bg: 'rgba(220,38,38,0.08)' };
  if (t === 'CRM / System') return { icon: '🖥️', bg: 'rgba(26,86,219,0.08)' };
  return { icon: '🌐', bg: 'rgba(5,150,105,0.08)' };
}

// ── Dashboard ────────────────────────────────────────────────
function renderDashboard() {
  // Financial highlights
  const totalInvoiced  = appData.invoices.reduce((s, i) => s + i.amount, 0);
  const collected      = appData.invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
  const outstanding    = appData.invoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + i.amount, 0);
  document.getElementById('statTotalInvoiced').textContent = fmtUGX(totalInvoiced);
  document.getElementById('statOutstanding').textContent   = fmtUGX(outstanding);
  document.getElementById('statCollected').textContent     = fmtUGX(collected);

  // Stats grid
  const activeProjects  = appData.projects.filter(p => p.status !== 'Completed').length;
  const pendingInvoices = appData.invoices.filter(i => i.status !== 'Paid').length;
  const wonDeals        = appData.leads.filter(l => l.stage === 'Won').length;
  const pipelineValue   = appData.leads.filter(l => !['Won','Lost'].includes(l.stage))
                                        .reduce((s, l) => s + l.value, 0);
  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Active Projects</div>
      <div class="stat-value">${activeProjects}</div>
      <div class="stat-sub">${appData.projects.filter(p => p.status !== 'Completed' && p.end && isOverdue(p.end)).length} delayed</div>
    </div>
    <div class="stat-card amber-accent">
      <div class="stat-label">Pending Invoices</div>
      <div class="stat-value">${pendingInvoices}</div>
      <div class="stat-sub warning">${fmtUGX(outstanding)} outstanding</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Won Deals</div>
      <div class="stat-value">${wonDeals}</div>
      <div class="stat-sub positive">All time</div>
    </div>
    <div class="stat-card navy-accent">
      <div class="stat-label">Total Leads</div>
      <div class="stat-value">${appData.leads.length}</div>
      <div class="stat-sub">${fmtUGX(pipelineValue)} pipeline</div>
    </div>
  `;

  // Decision alert
  const unpaidInvoices = appData.invoices.filter(i => i.status !== 'Paid');
  const unpaidTotal    = unpaidInvoices.reduce((s, i) => s + i.amount, 0);
  const overdueInvoices = unpaidInvoices.filter(i => isOverdue(i.due));
  const alertEl = document.getElementById('dashboardAlert');
  if (overdueInvoices.length > 0) {
    const overdueTotal = overdueInvoices.reduce((s, i) => s + i.amount, 0);
    alertEl.innerHTML = `
      <div class="decision-alert alert-danger">
        <div class="alert-icon">🔴</div>
        <div class="alert-body">
          <strong>Action required: <span class="alert-number">${overdueInvoices.length} invoice${overdueInvoices.length > 1 ? 's' : ''} overdue</span></strong>
          <span>You have <span class="alert-number">${fmtUGX(overdueTotal)}</span> in overdue payments.</span>
        </div>
        <button class="btn btn-sm" style="background:var(--red);color:white;flex-shrink:0" onclick="navigate('invoices')">View Overdue</button>
      </div>`;
  } else if (unpaidInvoices.length > 0) {
    alertEl.innerHTML = `
      <div class="decision-alert alert-warning">
        <div class="alert-icon">🟡</div>
        <div class="alert-body">
          <strong>You have <span class="alert-number">${fmtUGX(unpaidTotal)}</span> still unpaid across <span class="alert-number">${unpaidInvoices.length} invoice${unpaidInvoices.length > 1 ? 's' : ''}</span></strong>
          <span>Follow up on outstanding invoices to keep cash flow healthy.</span>
        </div>
        <button class="btn btn-sm btn-outline" style="flex-shrink:0" onclick="navigate('invoices')">View Invoices</button>
      </div>`;
  } else {
    alertEl.innerHTML = `
      <div class="decision-alert alert-success">
        <div class="alert-icon">✅</div>
        <div class="alert-body">
          <strong>All invoices are cleared. Cash flow is healthy.</strong>
          <span>No outstanding payments. Focus on growing the pipeline.</span>
        </div>
      </div>`;
  }

  // Recent leads table
  document.getElementById('recentLeadsTable').innerHTML =
    appData.leads.slice(0, 5).map(l => `
      <tr>
        <td><div class="fw-600" style="font-size:13px">${l.name}</div><div style="font-size:11px;color:var(--text-muted)">${l.biz}</div></td>
        <td><span class="badge badge-navy" style="font-size:10px">${l.service}</span></td>
        <td class="font-mono fw-600" style="font-size:12px">${fmtUGX(l.value)}</td>
        <td>${stageBadge(l.stage)}</td>
      </tr>`).join('') ||
    '<tr><td colspan="4" style="color:var(--text-muted);font-size:13px;padding:16px">No leads yet. Add your first lead!</td></tr>';

  // Active projects widget
  const ap = appData.projects.filter(p => p.status !== 'Completed').slice(0, 3);
  document.getElementById('dashboardProjects').innerHTML = ap.map(p => {
    const ti = typeIcon(p.type);
    return `
      <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border)">
        <div class="project-type-icon" style="background:${ti.bg};width:36px;height:36px;font-size:16px">${ti.icon}</div>
        <div style="flex:1">
          <div class="fw-600" style="font-size:13px">${p.name}</div>
          <div style="font-size:11px;color:var(--text-muted)">${p.client}</div>
          <div class="progress-bar" style="margin-top:8px">
            <div class="progress-fill" style="width:${p.progress}%"></div>
          </div>
        </div>
        <div>${projectStatusBadge(p.status)}</div>
      </div>`;
  }).join('') ||
  '<div class="empty-state" style="padding:24px"><div class="empty-state-icon">📂</div><div class="empty-state-title">No active projects</div></div>';

  // Pipeline chart (Chart.js donut)
  renderPipelineChart();

  // Follow-ups
  const upcoming = appData.leads
    .filter(l => l.followup && new Date(l.followup) >= new Date())
    .sort((a, b) => new Date(a.followup) - new Date(b.followup))
    .slice(0, 4);
  document.getElementById('followUpsActivity').innerHTML = upcoming.map(l => `
    <div class="activity-item">
      <div class="activity-dot" style="background:var(--blue)"></div>
      <div class="activity-text">
        <div class="activity-title">${l.name}</div>
        <div class="activity-time">${l.service} · ${fmtDate(l.followup)}</div>
      </div>
    </div>`).join('') ||
    '<div style="color:var(--text-muted);font-size:13px">No upcoming follow-ups</div>';

  // Invoice status widget
  const paid    = appData.invoices.filter(i => i.status === 'Paid').length;
  const unpaid  = appData.invoices.filter(i => i.status === 'Unpaid').length;
  const partial = appData.invoices.filter(i => i.status === 'Partial').length;
  document.getElementById('invoiceStatusWidget').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:13px">Paid</span><span class="badge badge-green">${paid}</span></div>
      <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:13px">Partial</span><span class="badge badge-amber">${partial}</span></div>
      <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:13px">Unpaid</span><span class="badge badge-navy">${unpaid}</span></div>
    </div>`;
}

// ── Pipeline Chart (Chart.js) ────────────────────────────────
function renderPipelineChart() {
  const stages = ['New', 'Contacted', 'Quoted', 'Negotiation', 'Won'];
  const counts = stages.map(s => appData.leads.filter(l => l.stage === s).length);
  const total  = counts.reduce((a, b) => a + b, 0);

  const canvas = document.getElementById('pipelineChart');
  if (!canvas) return;

  // Destroy old instance to avoid "Canvas already in use" error
  if (pipelineChartInstance) {
    pipelineChartInstance.destroy();
    pipelineChartInstance = null;
  }

  // If no data, show empty state text
  if (total === 0) {
    canvas.parentElement.innerHTML = '<div class="empty-state" style="padding:32px"><div class="empty-state-icon">📊</div><div class="empty-state-title">No leads yet</div><div class="empty-state-sub">Add leads to see pipeline stages</div></div>';
    return;
  }

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94A3B8' : '#4A5568';

  pipelineChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: stages,
      datasets: [{
        data: counts,
        backgroundColor: [
          'rgba(26,86,219,0.85)',   // New — blue
          'rgba(13,27,42,0.75)',    // Contacted — navy
          'rgba(217,119,6,0.85)',   // Quoted — amber
          'rgba(201,168,76,0.85)',  // Negotiation — gold
          'rgba(5,150,105,0.85)'    // Won — green
        ],
        borderColor: isDark ? '#111D30' : '#ffffff',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: textColor,
            font: { family: "'DM Sans', sans-serif", size: 11, weight: '600' },
            padding: 12,
            boxWidth: 10,
            boxHeight: 10,
            generateLabels(chart) {
              const data = chart.data;
              return data.labels.map((label, i) => ({
                text: `${label}  ${counts[i]}`,
                fillStyle: data.datasets[0].backgroundColor[i],
                hidden: false,
                index: i
              }));
            }
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.raw} lead${ctx.raw !== 1 ? 's' : ''}`
          }
        }
      }
    }
  });
}

// ── Leads ────────────────────────────────────────────────────
function renderLeads() {
  const search = (document.getElementById('leadSearch')?.value || '').toLowerCase();
  let filtered = appData.leads.filter(l => {
    const ms = !search || l.name.toLowerCase().includes(search) || l.biz.toLowerCase().includes(search);
    const mf = currentLeadStageFilter === 'all' || l.stage === currentLeadStageFilter;
    return ms && mf;
  });
  document.getElementById('leadCount').textContent = `${filtered.length} leads`;

  // Desktop table
  document.getElementById('leadsTableBody').innerHTML = filtered.map(l => `
    <tr>
      <td>
        <div class="fw-600" style="font-size:13px">${l.name}</div>
        <div style="font-size:11px;color:var(--text-muted)">${l.biz}</div>
      </td>
      <td><span class="badge badge-navy" style="font-size:10px">${l.service}</span></td>
      <td class="font-mono fw-600" style="font-size:12px">${fmtUGX(l.value)}</td>
      <td>${stageBadge(l.stage)}</td>
      <td>${priorityBadge(l.priority)}</td>
      <td style="font-size:12px">${l.followup ? (isOverdue(l.followup) ? '<span class="overdue-indicator"></span>' : '') + fmtDate(l.followup) : '—'}</td>
      <td>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="editLead(${l.id})">Edit</button>
          <button class="create-quote-btn" onclick="createQuoteFromLead(${l.id})">⚡ Quote</button>
          <button class="btn btn-ghost btn-sm" onclick="deleteLead(${l.id})" style="color:var(--red)">Del</button>
        </div>
      </td>
    </tr>`).join('') ||
    '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-title">No leads found</div></div></td></tr>';

  // Mobile cards
  document.getElementById('leadCardsContainer').innerHTML = filtered.map(l => `
    <div class="lead-card">
      <div class="lead-card-header">
        <div>
          <div class="lead-card-name">${l.name}</div>
          <div class="lead-card-biz">${l.biz}</div>
        </div>
        ${stageBadge(l.stage)}
      </div>
      <div class="lead-card-body">
        <div class="lead-card-field"><label>Service</label><span>${l.service}</span></div>
        <div class="lead-card-field"><label>Value</label><span class="font-mono fw-600">${fmtUGX(l.value)}</span></div>
        <div class="lead-card-field"><label>Priority</label><span>${l.priority}</span></div>
        <div class="lead-card-field"><label>Follow-up</label><span>${l.followup ? fmtDate(l.followup) : '—'}</span></div>
      </div>
      ${l.phone ? `<div style="margin-top:8px"><a href="tel:${l.phone}" class="btn btn-outline btn-sm" style="text-decoration:none">📞 ${l.phone}</a></div>` : ''}
      <div class="lead-card-actions">
        <button class="btn btn-primary btn-sm" onclick="editLead(${l.id})" style="flex:1">Edit</button>
        <button class="create-quote-btn" onclick="createQuoteFromLead(${l.id})">⚡ Quote</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteLead(${l.id})" style="color:var(--red)">Del</button>
      </div>
    </div>`).join('') ||
    '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-title">No leads found</div></div>';
}

function filterLeads() { renderLeads(); }

function filterLeadStage(stage, el) {
  currentLeadStageFilter = stage;
  document.querySelectorAll('#page-leads .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderLeads();
}

function openLeadModal() {
  document.getElementById('editLeadId').value = '';
  document.getElementById('leadModalTitle').textContent = 'New Lead';
  ['leadName','leadBiz','leadPhone','leadEmail','leadNotes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('leadValue').value = '';
  document.getElementById('leadFollowup').value = '';
  document.getElementById('leadStage').selectedIndex    = 0;
  document.getElementById('leadPriority').selectedIndex = 1;
  document.getElementById('leadSource').selectedIndex   = 0;
  document.getElementById('leadModal').classList.add('active');
}

function editLead(id) {
  const l = appData.leads.find(x => x.id === id);
  if (!l) return;
  document.getElementById('editLeadId').value = id;
  document.getElementById('leadModalTitle').textContent = 'Edit Lead';
  document.getElementById('leadName').value    = l.name;
  document.getElementById('leadBiz').value     = l.biz;
  document.getElementById('leadPhone').value   = l.phone;
  document.getElementById('leadEmail').value   = l.email;
  document.getElementById('leadValue').value   = l.value;
  document.getElementById('leadFollowup').value = l.followup;
  document.getElementById('leadNotes').value   = l.notes;
  setSelect('leadService',  l.service);
  setSelect('leadStage',    l.stage);
  setSelect('leadPriority', l.priority);
  setSelect('leadSource',   l.source);
  document.getElementById('leadModal').classList.add('active');
}

async function saveLead() {
  const name = document.getElementById('leadName').value.trim();
  if (!name) { showToast('Please enter client name.'); return; }
  const editId = document.getElementById('editLeadId').value;

  const payload = {
    name,
    biz:      document.getElementById('leadBiz').value,
    phone:    document.getElementById('leadPhone').value,
    email:    document.getElementById('leadEmail').value,
    service:  document.getElementById('leadService').value,
    value:    parseInt(document.getElementById('leadValue').value) || 0,
    stage:    document.getElementById('leadStage').value,
    priority: document.getElementById('leadPriority').value,
    source:   document.getElementById('leadSource').value,
    followup: document.getElementById('leadFollowup').value || null,
    notes:    document.getElementById('leadNotes').value
  };

  if (editId) {
    const res = await api('PUT', `/api/leads/${editId}`, payload);
    if (res) {
      const idx = appData.leads.findIndex(x => x.id === parseInt(editId));
      if (idx >= 0) appData.leads[idx] = normLead(res);
    } else {
      // offline fallback
      payload.id = parseInt(editId);
      const idx = appData.leads.findIndex(x => x.id === parseInt(editId));
      if (idx >= 0) appData.leads[idx] = { ...appData.leads[idx], ...payload };
    }
    showToast('Lead updated.');
  } else {
    const res = await api('POST', '/api/leads', payload);
    if (res) {
      appData.leads.unshift(normLead(res));
    } else {
      payload.id = Date.now();
      appData.leads.unshift(payload);
    }
    showToast('New lead added.');
  }

  saveLocal();
  closeModal('leadModal');
  renderLeads();
  renderDashboard();
}

async function deleteLead(id) {
  if (!confirm('Delete this lead?')) return;
  await api('DELETE', `/api/leads/${id}`);
  appData.leads = appData.leads.filter(x => x.id !== id);
  saveLocal();
  renderLeads();
  showToast('Lead deleted.');
}

// ── Invoices ─────────────────────────────────────────────────
function renderInvoices() {
  let filtered = appData.invoices.filter(i => {
    if (currentInvFilter === 'all') return true;
    if (currentInvFilter === 'Overdue') return i.status !== 'Paid' && isOverdue(i.due);
    return i.status === currentInvFilter;
  });
  document.getElementById('invoiceCount').textContent = `${filtered.length} invoices`;

  document.getElementById('invoicesList').innerHTML = filtered.map(inv => {
    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const dueDate = inv.due ? new Date(inv.due) : null;
    if (dueDate) dueDate.setHours(0, 0, 0, 0);
    const isPaid   = inv.status === 'Paid';
    const overdue  = !isPaid && dueDate && dueDate < today;
    const diffDays = dueDate ? Math.round((dueDate - today) / 86400000) : null;
    const dueSoon  = !isPaid && !overdue && diffDays !== null && diffDays <= 3 && diffDays >= 0;

    let dueStrip = '';
    if (!isPaid && overdue) {
      const daysOver = Math.abs(diffDays);
      dueStrip = `<div class="overdue-strip">🔴 OVERDUE · ${daysOver} day${daysOver !== 1 ? 's' : ''} overdue</div>`;
    } else if (!isPaid && dueSoon) {
      dueStrip = `<div class="due-soon-strip">⏰ Due ${diffDays === 0 ? 'today' : 'in ' + diffDays + ' day' + (diffDays !== 1 ? 's' : '')}</div>`;
    } else if (!isPaid && diffDays !== null && diffDays > 3) {
      dueStrip = `<div class="due-future-strip">📅 Due in ${diffDays} days</div>`;
    }

    return `
      <div class="invoice-card${overdue ? ' is-overdue' : ''}">
        <div class="invoice-card-header">
          <div class="invoice-number">${inv.number}</div>
          ${invoiceBadge(inv.status, inv.due)}
        </div>
        ${dueStrip}
        <div class="invoice-card-details">
          <div class="invoice-detail-item"><div class="invoice-detail-label">Client</div><div class="invoice-detail-value">${inv.client}</div></div>
          <div class="invoice-detail-item"><div class="invoice-detail-label">Project</div><div class="invoice-detail-value">${inv.project}</div></div>
          <div class="invoice-detail-item"><div class="invoice-detail-label">Amount</div><div class="invoice-amount">${fmtUGX(inv.amount)}</div></div>
          <div class="invoice-detail-item"><div class="invoice-detail-label">Due</div><div class="invoice-detail-value" style="${overdue ? 'color:var(--red);font-weight:700' : ''}">${fmtDate(inv.due)}</div></div>
        </div>
        ${inv.notes ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">${inv.notes}</div>` : ''}
        <div class="invoice-card-footer">
          ${inv.status !== 'Paid' ? `<button class="btn btn-primary btn-sm" onclick="markInvoice(${inv.id},'Paid')">Mark Paid</button>` : ''}
          ${inv.status === 'Unpaid' ? `<button class="btn btn-outline btn-sm" onclick="markInvoice(${inv.id},'Partial')">Mark Partial</button>` : ''}
          ${!isPaid ? `<button class="reminder-btn" onclick="sendReminder(${inv.id})">📲 Reminder</button>` : ''}
          <button class="btn btn-outline btn-sm" onclick="editInvoice(${inv.id})">Edit</button>
          <button class="btn btn-outline btn-sm" onclick="downloadInvoicePDF(${inv.id})" style="color:var(--blue);border-color:var(--blue)">⬇ PDF</button>
          <button class="btn btn-ghost btn-sm" onclick="deleteInvoice(${inv.id})" style="color:var(--red)">Delete</button>
        </div>
      </div>`;
  }).join('') ||
  '<div class="empty-state"><div class="empty-state-icon">📄</div><div class="empty-state-title">No invoices found</div></div>';
}

function filterInvoice(f, el) {
  currentInvFilter = f;
  document.querySelectorAll('#page-invoices .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderInvoices();
}

function openInvoiceModal() {
  document.getElementById('editInvoiceId').value = '';
  document.getElementById('invoiceModalTitle').textContent = 'New Invoice';
  ['invClient','invProject','invAmount','invNotes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('invDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('invDue').value  = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
  document.getElementById('invStatus').selectedIndex = 0;
  document.getElementById('invoiceModal').classList.add('active');
}

function editInvoice(id) {
  const inv = appData.invoices.find(x => x.id === id);
  if (!inv) return;
  document.getElementById('editInvoiceId').value = id;
  document.getElementById('invoiceModalTitle').textContent = 'Edit Invoice';
  document.getElementById('invClient').value  = inv.client;
  document.getElementById('invProject').value = inv.project;
  document.getElementById('invDate').value    = inv.date;
  document.getElementById('invDue').value     = inv.due;
  document.getElementById('invAmount').value  = inv.amount;
  document.getElementById('invNotes').value   = inv.notes;
  setSelect('invStatus', inv.status);
  document.getElementById('invoiceModal').classList.add('active');
}

async function saveInvoice() {
  const client = document.getElementById('invClient').value.trim();
  if (!client) { showToast('Please enter client name.'); return; }
  const editId = document.getElementById('editInvoiceId').value;

  const payload = {
    client,
    project:      document.getElementById('invProject').value,
    invoice_date: document.getElementById('invDate').value,
    due_date:     document.getElementById('invDue').value,
    amount:       parseInt(document.getElementById('invAmount').value) || 0,
    status:       document.getElementById('invStatus').value,
    notes:        document.getElementById('invNotes').value
  };

  if (editId) {
    const res = await api('PUT', `/api/invoices/${editId}`, payload);
    if (res) {
      const idx = appData.invoices.findIndex(x => x.id === parseInt(editId));
      if (idx >= 0) appData.invoices[idx] = normInvoice(res);
    } else {
      const inv = appData.invoices.find(x => x.id === parseInt(editId));
      if (inv) { Object.assign(inv, { ...payload, date: payload.invoice_date, due: payload.due_date }); }
    }
    showToast('Invoice updated.');
  } else {
    const res = await api('POST', '/api/invoices', payload);
    if (res) {
      appData.invoices.unshift(normInvoice(res));
    } else {
      // Generate number offline
      const n = appData.invoices.length + 1;
      const year = new Date().getFullYear();
      payload.id     = Date.now();
      payload.number = `INV-${year}-${String(n).padStart(3, '0')}`;
      payload.date   = payload.invoice_date;
      payload.due    = payload.due_date;
      appData.invoices.unshift(payload);
    }
    showToast('Invoice created.');
  }

  saveLocal();
  closeModal('invoiceModal');
  renderInvoices();
}

async function markInvoice(id, status) {
  const res = await api('PATCH', `/api/invoices/${id}/status`, { status });
  const inv = appData.invoices.find(x => x.id === id);
  if (inv) inv.status = status;
  saveLocal();
  renderInvoices();
  showToast(`Invoice marked as ${status}.`);
}

async function deleteInvoice(id) {
  if (!confirm('Delete this invoice?')) return;
  await api('DELETE', `/api/invoices/${id}`);
  appData.invoices = appData.invoices.filter(x => x.id !== id);
  saveLocal();
  renderInvoices();
  showToast('Invoice deleted.');
}

function sendReminder(invId) {
  const inv = appData.invoices.find(x => x.id === invId);
  if (!inv) return;
  showToast(`📲 Reminder noted for ${inv.client} — ${inv.number}`);
}

// ── Download Invoice PDF (jsPDF — in-browser, no API needed) ─
function downloadInvoicePDF(id) {
  const inv = appData.invoices.find(x => x.id === id);
  if (!inv) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const navy  = [13, 27, 42];
  const blue  = [26, 86, 219];
  const green = [5, 150, 105];
  const red   = [220, 38, 38];
  const amber = [217, 119, 6];
  const gray  = [100, 116, 139];
  const light = [241, 245, 249];

  const W = 210; // page width mm

  // ── Header bar ──
  doc.setFillColor(...navy);
  doc.rect(0, 0, W, 38, 'F');

  // Logo mark (gold square)
  doc.setFillColor(201, 168, 76);
  doc.roundedRect(14, 9, 16, 16, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('LS', 22, 20, { align: 'center' });

  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Luxion Solutions Limited', 35, 17);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 195, 210);
  doc.text('Kampala, Uganda  |  hello@luxionsolutions.com  |  +256 704 000 000', 35, 23);
  doc.text('Owner: Latif Mukalazi', 35, 29);

  // INVOICE label
  doc.setTextColor(201, 168, 76);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('INVOICE', W - 14, 22, { align: 'right' });

  // ── Invoice meta box ──
  doc.setFillColor(...light);
  doc.roundedRect(14, 44, W - 28, 28, 3, 3, 'F');

  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(inv.number, 20, 53);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...gray);
  doc.text('Invoice Number', 20, 58);

  // Status badge (coloured)
  const isInvPaid    = inv.status === 'Paid';
  const isInvOverdue = !isInvPaid && isOverdue(inv.due);
  const isInvPartial = inv.status === 'Partial';
  let badgeColor = isInvPaid ? green : isInvOverdue ? red : isInvPartial ? amber : navy;
  let badgeLabel = isInvPaid ? '✓ PAID' : isInvOverdue ? '⚠ OVERDUE' : isInvPartial ? '≈ PARTIAL' : 'UNPAID';
  doc.setFillColor(...badgeColor);
  doc.roundedRect(W - 56, 46, 42, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(badgeLabel, W - 35, 52.5, { align: 'center' });

  // Dates
  const col2 = 80, col3 = 130;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...navy);
  doc.text('Issue Date', col2, 53);
  doc.text('Due Date', col3, 53);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(fmtDate(inv.date), col2, 59);
  doc.text(fmtDate(inv.due),  col3, 59);

  // ── Bill To ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text('BILL TO', 14, 82);
  doc.setFillColor(...navy);
  doc.rect(14, 83.5, 22, 0.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...navy);
  doc.text(inv.client, 14, 91);

  // ── Line items table ──
  const tableTop = 100;
  // Table header
  doc.setFillColor(...navy);
  doc.rect(14, tableTop, W - 28, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DESCRIPTION', 18, tableTop + 5.5);
  doc.text('AMOUNT (UGX)', W - 16, tableTop + 5.5, { align: 'right' });

  // Single row: project/service
  doc.setFillColor(248, 250, 252);
  doc.rect(14, tableTop + 8, W - 28, 12, 'F');
  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(inv.project || 'Professional Services', 18, tableTop + 15.5);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtUGXFull(inv.amount), W - 16, tableTop + 15.5, { align: 'right' });

  // Sub-line: notes
  if (inv.notes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    const noteLines = doc.splitTextToSize(inv.notes, W - 50);
    doc.text(noteLines, 18, tableTop + 23);
  }

  // ── Total box ──
  const totalBoxY = tableTop + (inv.notes ? 36 : 24);
  doc.setFillColor(...navy);
  doc.roundedRect(W - 80, totalBoxY, 66, 18, 3, 3, 'F');
  doc.setTextColor(201, 168, 76);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TOTAL DUE', W - 47, totalBoxY + 6.5, { align: 'center' });
  doc.setFontSize(13);
  doc.text(fmtUGXFull(inv.amount), W - 47, totalBoxY + 14, { align: 'center' });

  // ── Payment status note ──
  if (!isInvPaid) {
    const noteY = totalBoxY + 26;
    doc.setFillColor(...(isInvOverdue ? [255, 228, 228] : [254, 243, 199]));
    doc.roundedRect(14, noteY, W - 28, 10, 2, 2, 'F');
    doc.setTextColor(...(isInvOverdue ? red : amber));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    const noteText = isInvOverdue
      ? '⚠  This invoice is overdue. Please arrange payment immediately.'
      : '📅  Payment is due on ' + fmtDate(inv.due) + '. Please pay promptly.';
    doc.text(noteText, W / 2, noteY + 6.5, { align: 'center' });
  }

  // ── Footer ──
  doc.setFillColor(...light);
  doc.rect(0, 277, W, 20, 'F');
  doc.setTextColor(...gray);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Luxion Solutions Limited  ·  Kampala, Uganda  ·  hello@luxionsolutions.com', W / 2, 284, { align: 'center' });
  doc.text(`Generated on ${new Date().toLocaleDateString('en-UG')}  ·  Owner: Latif Mukalazi`, W / 2, 290, { align: 'center' });

  doc.save(`${inv.number}-Luxion.pdf`);
  showToast(`📄 ${inv.number} downloaded as PDF`);
}

// ── Projects ─────────────────────────────────────────────────
function renderProjects() {
  let filtered = appData.projects.filter(p => {
    if (currentProjFilter === 'all')    return true;
    if (currentProjFilter === 'active') return p.status !== 'Completed';
    return p.type === currentProjFilter || p.status === currentProjFilter;
  });
  document.getElementById('projectCount').textContent = `${filtered.length} projects`;

  document.getElementById('projectsList').innerHTML = filtered.map(p => {
    const ti      = typeIcon(p.type);
    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const endDate = p.end ? new Date(p.end) : null;
    if (endDate) endDate.setHours(0, 0, 0, 0);
    const delayed  = p.status !== 'Completed' && endDate && endDate < today;
    const diffDays = endDate ? Math.round((endDate - today) / 86400000) : null;
    const dueSoon  = !delayed && p.status !== 'Completed' && diffDays !== null && diffDays <= 3 && diffDays >= 0;

    let urgencyBadge = '';
    if (delayed) {
      const daysOver = endDate ? Math.abs(Math.round((endDate - today) / 86400000)) : '';
      urgencyBadge = `<span class="badge badge-delayed">⚠ Delayed${daysOver ? ' · ' + daysOver + 'd' : ''}</span>`;
    } else if (dueSoon) {
      urgencyBadge = `<span class="badge badge-due-soon">⏰ Due ${diffDays === 0 ? 'Today' : 'in ' + diffDays + 'd'}</span>`;
    } else {
      urgencyBadge = projectStatusBadge(p.status);
    }

    const contractValue   = p.value || 0;
    const estimatedCost   = Math.round(contractValue * 0.55);
    const estimatedProfit = contractValue - estimatedCost;
    const profitColor     = estimatedProfit >= 0 ? 'profit-positive' : 'profit-negative';
    const clientInvoiced  = appData.invoices.filter(i => i.client === p.client).reduce((s, i) => s + i.amount, 0);

    return `
      <div class="project-card">
        <div class="project-type-icon" style="background:${ti.bg}">${ti.icon}</div>
        <div class="project-card-info">
          <div class="flex-between">
            <div class="project-card-name">${p.name}</div>
            <div class="flex gap-8" style="flex-shrink:0">${urgencyBadge}</div>
          </div>
          <div class="project-card-client">${p.client} · ${p.type}</div>
          <div class="project-meta">
            <div class="project-meta-item">👤 ${p.assigned || '—'}</div>
            <div class="project-meta-item">📅 ${fmtDate(p.start)} → ${fmtDate(p.end)}</div>
            <div class="project-meta-item font-mono fw-600" style="color:var(--blue)">${fmtUGX(p.value)}</div>
          </div>
          ${p.notes ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px">${p.notes}</div>` : ''}
          <div class="progress-bar" style="margin-top:10px">
            <div class="progress-fill" style="width:${p.progress}%"></div>
          </div>
          <div class="progress-pct-label">${p.progress}% complete</div>
          <div class="project-profit-strip">
            <div class="project-profit-item"><label>Contract</label><span class="font-mono">${fmtUGX(contractValue)}</span></div>
            <div class="project-profit-item"><label>Est. Cost</label><span class="font-mono">${fmtUGX(estimatedCost)}</span></div>
            <div class="project-profit-item"><label>Est. Profit</label><span class="${profitColor}">${fmtUGX(estimatedProfit)}</span></div>
            <div class="project-profit-item"><label>Invoiced</label><span class="font-mono" style="color:var(--blue)">${fmtUGX(clientInvoiced)}</span></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
            <button class="btn btn-outline btn-sm" onclick="editProject(${p.id})">Edit</button>
            <button class="btn btn-ghost btn-sm" onclick="deleteProject(${p.id})" style="color:var(--red)">Delete</button>
          </div>
        </div>
      </div>`;
  }).join('') ||
  '<div class="empty-state"><div class="empty-state-icon">📁</div><div class="empty-state-title">No projects found</div></div>';
}

function filterProject(f, el) {
  currentProjFilter = f;
  document.querySelectorAll('#page-projects .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderProjects();
}

function openProjectModal() {
  document.getElementById('editProjectId').value = '';
  document.getElementById('projectModalTitle').textContent = 'New Project';
  ['projName','projClient','projAssigned','projNotes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('projValue').value    = '';
  document.getElementById('projProgress').value = '0';
  document.getElementById('projStart').value    = new Date().toISOString().split('T')[0];
  document.getElementById('projEnd').value      = '';
  document.getElementById('projType').selectedIndex = 0;
  updateProjStatuses();
  document.getElementById('projectModal').classList.add('active');
}

function editProject(id) {
  const p = appData.projects.find(x => x.id === id);
  if (!p) return;
  document.getElementById('editProjectId').value    = id;
  document.getElementById('projectModalTitle').textContent = 'Edit Project';
  document.getElementById('projName').value     = p.name;
  document.getElementById('projClient').value   = p.client;
  document.getElementById('projAssigned').value = p.assigned;
  document.getElementById('projValue').value    = p.value;
  document.getElementById('projStart').value    = p.start;
  document.getElementById('projEnd').value      = p.end;
  document.getElementById('projProgress').value = p.progress;
  document.getElementById('projNotes').value    = p.notes;
  setSelect('projType', p.type);
  updateProjStatuses(p.status);
  document.getElementById('projectModal').classList.add('active');
}

function updateProjStatuses(selectedStatus) {
  const type    = document.getElementById('projType').value;
  const digital = ['Discovery','Design','Development','Review','Completed'];
  const cctv    = ['Site Survey','Quotation','Installation','Testing','Completed'];
  const opts    = type === 'CCTV' ? cctv : digital;
  const sel     = document.getElementById('projStatus');
  sel.innerHTML = opts.map(o => `<option ${o === selectedStatus ? 'selected' : ''}>${o}</option>`).join('');
}

async function saveProject() {
  const name = document.getElementById('projName').value.trim();
  if (!name) { showToast('Please enter project name.'); return; }
  const editId = document.getElementById('editProjectId').value;

  const payload = {
    name,
    client:     document.getElementById('projClient').value,
    type:       document.getElementById('projType').value,
    status:     document.getElementById('projStatus').value,
    assigned:   document.getElementById('projAssigned').value,
    value:      parseInt(document.getElementById('projValue').value) || 0,
    start_date: document.getElementById('projStart').value,
    end_date:   document.getElementById('projEnd').value,
    progress:   parseInt(document.getElementById('projProgress').value) || 0,
    notes:      document.getElementById('projNotes').value
  };

  if (editId) {
    const res = await api('PUT', `/api/projects/${editId}`, payload);
    if (res) {
      const idx = appData.projects.findIndex(x => x.id === parseInt(editId));
      if (idx >= 0) appData.projects[idx] = normProject(res);
    } else {
      const proj = appData.projects.find(x => x.id === parseInt(editId));
      if (proj) Object.assign(proj, { ...payload, start: payload.start_date, end: payload.end_date });
    }
    showToast('Project updated.');
  } else {
    const res = await api('POST', '/api/projects', payload);
    if (res) {
      appData.projects.unshift(normProject(res));
    } else {
      payload.id    = Date.now();
      payload.start = payload.start_date;
      payload.end   = payload.end_date;
      appData.projects.unshift(payload);
    }
    showToast('Project created.');
  }

  saveLocal();
  closeModal('projectModal');
  renderProjects();
}

async function deleteProject(id) {
  if (!confirm('Delete this project?')) return;
  await api('DELETE', `/api/projects/${id}`);
  appData.projects = appData.projects.filter(x => x.id !== id);
  saveLocal();
  renderProjects();
  showToast('Project deleted.');
}

// ── Pricing / Catalogue ──────────────────────────────────────
function initPricing() {
  renderCatalogue();
  renderQuoteItemPicker();
  renderQuoteLines();
  recalcQuote();
}

function switchPricingTab(tab) {
  document.getElementById('ptab-catalogue').classList.toggle('active', tab === 'catalogue');
  document.getElementById('ptab-quote').classList.toggle('active', tab === 'quote');
  document.getElementById('pricing-catalogue').style.display = tab === 'catalogue' ? '' : 'none';
  document.getElementById('pricing-quote').style.display     = tab === 'quote'     ? '' : 'none';
  if (tab === 'catalogue') renderCatalogue();
  if (tab === 'quote') { renderQuoteItemPicker(); renderQuoteLines(); recalcQuote(); }
}

function renderCatalogue() {
  const items = appData.catalogue.filter(i =>
    currentCatalogueFilter === 'all' || i.category === currentCatalogueFilter
  );
  document.getElementById('catalogueTableBody').innerHTML = items.map(item => `
    <tr>
      <td>
        <div class="fw-600" style="font-size:13px">${item.name}</div>
        ${item.notes ? `<div style="font-size:11px;color:var(--text-muted)">${item.notes}</div>` : ''}
      </td>
      <td><span class="cat-dot cat-dot-${item.category}"></span>${item.category}</td>
      <td style="font-size:12px;color:var(--text-muted)">${item.unit}</td>
      <td class="font-mono fw-600" style="font-size:13px;color:var(--blue)">${fmtUGXFull(item.unitCost)}</td>
      <td>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="editCatalogueItem(${item.id})">Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="deleteCatalogueItem(${item.id})" style="color:var(--red)">Del</button>
        </div>
      </td>
    </tr>`).join('') ||
  '<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-title">No items found</div></div></td></tr>';
}

function filterCatalogue(cat, el) {
  currentCatalogueFilter = cat;
  document.querySelectorAll('#catalogueFilterBar .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderCatalogue();
}

function openCatalogueItemModal() {
  document.getElementById('editCatId').value = '';
  document.getElementById('catModalTitle').textContent = 'Add Catalogue Item';
  document.getElementById('catName').value     = '';
  document.getElementById('catUnitCost').value = '';
  document.getElementById('catNotes').value    = '';
  document.getElementById('catCategory').selectedIndex = 0;
  document.getElementById('catUnit').selectedIndex     = 0;
  document.getElementById('catalogueItemModal').classList.add('active');
}

function editCatalogueItem(id) {
  const item = appData.catalogue.find(x => x.id === id);
  if (!item) return;
  document.getElementById('editCatId').value     = id;
  document.getElementById('catModalTitle').textContent = 'Edit Item';
  document.getElementById('catName').value     = item.name;
  document.getElementById('catUnitCost').value = item.unitCost;
  document.getElementById('catNotes').value    = item.notes || '';
  setSelect('catCategory', item.category);
  setSelect('catUnit',     item.unit);
  document.getElementById('catalogueItemModal').classList.add('active');
}

async function saveCatalogueItem() {
  const name = document.getElementById('catName').value.trim();
  const cost = parseInt(document.getElementById('catUnitCost').value);
  if (!name)          { showToast('Please enter item name.'); return; }
  if (!cost || cost <= 0) { showToast('Please enter a valid unit cost.'); return; }
  const editId = document.getElementById('editCatId').value;

  const payload = {
    name,
    category:  document.getElementById('catCategory').value,
    unit:      document.getElementById('catUnit').value,
    unit_cost: cost,
    notes:     document.getElementById('catNotes').value
  };

  if (editId) {
    const res = await api('PUT', `/api/catalogue/${editId}`, payload);
    if (res) {
      const idx = appData.catalogue.findIndex(x => x.id === parseInt(editId));
      if (idx >= 0) appData.catalogue[idx] = normCatalogueItem(res);
    } else {
      const item = appData.catalogue.find(x => x.id === parseInt(editId));
      if (item) Object.assign(item, { name, category: payload.category, unit: payload.unit, unitCost: cost, notes: payload.notes });
    }
    showToast('Item updated.');
  } else {
    const res = await api('POST', '/api/catalogue', payload);
    if (res) {
      appData.catalogue.push(normCatalogueItem(res));
    } else {
      appData.catalogue.push({ id: Date.now(), name, category: payload.category, unit: payload.unit, unitCost: cost, notes: payload.notes, updated: new Date().toISOString().split('T')[0] });
    }
    showToast('Item added to catalogue.');
  }

  saveLocal();
  closeModal('catalogueItemModal');
  renderCatalogue();
  renderQuoteItemPicker();
}

async function deleteCatalogueItem(id) {
  if (!confirm('Delete this item from catalogue?')) return;
  await api('DELETE', `/api/catalogue/${id}`);
  appData.catalogue = appData.catalogue.filter(x => x.id !== id);
  quoteLines        = quoteLines.filter(l => l.itemId !== id);
  saveLocal();
  renderCatalogue();
  renderQuoteItemPicker();
  renderQuoteLines();
  recalcQuote();
  showToast('Item deleted.');
}

// ── Quote Builder ────────────────────────────────────────────
function filterQuoteItems() { renderQuoteItemPicker(); }

function renderQuoteItemPicker() {
  const el = document.getElementById('quoteItemPicker');
  if (!el) return;
  const search     = (document.getElementById('quoteSearch')?.value || '').toLowerCase();
  const typeFilter = document.getElementById('quoteType')?.value || 'all';
  const items = appData.catalogue.filter(i => {
    const ms = !search || i.name.toLowerCase().includes(search) || i.category.toLowerCase().includes(search);
    const mt = typeFilter === 'all' || i.category === typeFilter;
    return ms && mt;
  });
  const inQ = new Set(quoteLines.map(l => l.itemId));
  el.innerHTML = items.map(item => `
    <div class="picker-item-card ${inQ.has(item.id) ? 'in-quote' : ''}" onclick="addToQuote(${item.id})">
      <div class="picker-item-cat">${item.category}</div>
      <div class="picker-item-name">${item.name}</div>
      <div class="picker-item-price">${fmtUGXFull(item.unitCost)} / ${item.unit}</div>
      ${inQ.has(item.id) ? '<div class="picker-item-added">✓</div>' : ''}
    </div>`).join('') ||
    '<div style="color:var(--text-muted);font-size:13px;padding:8px">No items found</div>';
}

function addToQuote(itemId) {
  const exists = quoteLines.find(l => l.itemId === itemId);
  if (exists) { exists.qty += 1; }
  else { quoteLines.push({ itemId, qty: 1 }); }
  renderQuoteItemPicker(); renderQuoteLines(); recalcQuote();
}

function removeFromQuote(itemId) {
  quoteLines = quoteLines.filter(l => l.itemId !== itemId);
  renderQuoteItemPicker(); renderQuoteLines(); recalcQuote();
}

function updateQty(itemId, delta) {
  const line = quoteLines.find(l => l.itemId === itemId);
  if (!line) return;
  line.qty = Math.max(0, line.qty + delta);
  if (line.qty === 0) { removeFromQuote(itemId); return; }
  renderQuoteLines(); recalcQuote();
}

function setQtyDirect(itemId, val) {
  const line = quoteLines.find(l => l.itemId === itemId);
  if (!line) return;
  const n = parseInt(val) || 0;
  if (n <= 0) { removeFromQuote(itemId); return; }
  line.qty = n; recalcQuote();
}

function renderQuoteLines() {
  const container = document.getElementById('quoteLineItems');
  if (!container) return;
  document.getElementById('quoteLineCount').textContent = quoteLines.length + ' items';
  if (quoteLines.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:32px"><div class="empty-state-icon">🛒</div><div class="empty-state-title">No items added yet</div><div class="empty-state-sub">Click items above to add them to the quote</div></div>`;
    return;
  }
  container.innerHTML = quoteLines.map(line => {
    const item = appData.catalogue.find(x => x.id === line.itemId);
    if (!item) return '';
    const lineTotal = item.unitCost * line.qty;
    return `
      <div class="quote-line-item">
        <div class="quote-line-name">
          <strong>${item.name}</strong>
          <span><span class="cat-dot cat-dot-${item.category}"></span>${item.category} · ${fmtUGXFull(item.unitCost)} / ${item.unit}</span>
        </div>
        <div class="qty-control">
          <button class="qty-btn" onclick="updateQty(${item.id},-1)">−</button>
          <input type="number" class="qty-value" value="${line.qty}" min="1" onchange="setQtyDirect(${item.id},this.value)">
          <button class="qty-btn" onclick="updateQty(${item.id},1)">+</button>
        </div>
        <div class="quote-line-total">${fmtUGXFull(lineTotal)}</div>
        <button class="btn btn-ghost btn-icon" onclick="removeFromQuote(${item.id})" style="color:var(--text-muted);flex-shrink:0">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
  }).join('');
}

function recalcQuote() {
  const totalCost = quoteLines.reduce((s, line) => {
    const item = appData.catalogue.find(x => x.id === line.itemId);
    return s + (item ? item.unitCost * line.qty : 0);
  }, 0);
  const markup  = parseFloat(document.getElementById('qMarkupInput')?.value) || 40;
  const selling = totalCost * (1 + markup / 100);
  const minSafe = totalCost * 1.1;
  const profit  = selling - totalCost;
  const margin  = selling > 0 ? (profit / selling) * 100 : 0;
  const client  = document.getElementById('quoteClient')?.value || '';

  const safe = id => document.getElementById(id);
  if (safe('quoteSummaryClient')) safe('quoteSummaryClient').textContent = client ? `📋 ${client}` : '';
  if (safe('qSumTotal'))   safe('qSumTotal').textContent   = fmtUGXFull(totalCost);
  if (safe('qSumSelling')) safe('qSumSelling').textContent = fmtUGXFull(selling);
  if (safe('qSumMinSafe')) safe('qSumMinSafe').textContent = fmtUGXFull(minSafe);
  if (safe('qSumProfit'))  safe('qSumProfit').textContent  = fmtUGXFull(profit);
  if (safe('qMarginPct'))  safe('qMarginPct').textContent  = margin.toFixed(1) + '%';
  if (safe('qMarginBar'))  safe('qMarginBar').style.width  = Math.min(margin, 100) + '%';
  if (safe('qPricingWarning')) safe('qPricingWarning').classList.toggle('show', selling < minSafe && totalCost > 0);

  const badge = safe('profitStatusBadge');
  if (badge) {
    if (totalCost === 0) {
      badge.style.display = 'none';
    } else {
      badge.style.display = 'flex';
      if (margin >= 40)      { badge.className = 'profit-status-badge safe'; badge.innerHTML = '✅ SAFE PROFIT'; }
      else if (margin >= 20) { badge.className = 'profit-status-badge low';  badge.innerHTML = '⚠️ LOW PROFIT'; }
      else                   { badge.className = 'profit-status-badge risky';badge.innerHTML = '🔴 RISKY PRICE'; }
    }
  }

  const cats = {};
  quoteLines.forEach(line => {
    const item = appData.catalogue.find(x => x.id === line.itemId);
    if (!item) return;
    cats[item.category] = (cats[item.category] || 0) + item.unitCost * line.qty;
  });
  if (safe('quoteSummaryLines')) {
    safe('quoteSummaryLines').innerHTML = Object.entries(cats).map(([cat, sum]) => `
      <div class="pricing-row-sum">
        <span class="sum-label"><span class="cat-dot cat-dot-${cat}" style="display:inline-block"></span>${cat}</span>
        <span class="sum-value font-mono" style="font-size:12px">${fmtUGXFull(sum)}</span>
      </div>`).join('');
  }
}

function clearQuote() {
  quoteLines = [];
  const qc = document.getElementById('quoteClient');
  if (qc) qc.value = '';
  renderQuoteItemPicker(); renderQuoteLines(); recalcQuote();
  showToast('Quote cleared.');
}

async function saveQuoteAsInvoice() {
  if (quoteLines.length === 0) { showToast('Add items to the quote first.'); return; }
  const client  = (document.getElementById('quoteClient')?.value || '').trim() || 'Unknown Client';
  const markup  = parseFloat(document.getElementById('qMarkupInput')?.value) || 40;
  const totalCost = quoteLines.reduce((s, line) => {
    const item = appData.catalogue.find(x => x.id === line.itemId);
    return s + (item ? item.unitCost * line.qty : 0);
  }, 0);
  const selling = Math.round(totalCost * (1 + markup / 100));
  const today   = new Date().toISOString().split('T')[0];
  const due     = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
  const lines   = quoteLines.map(l => {
    const item = appData.catalogue.find(x => x.id === l.itemId);
    return item ? `${l.qty}x ${item.name}` : '';
  }).filter(Boolean).join(', ');
  const projectDesc = lines.length > 80 ? lines.substring(0, 80) + '…' : lines;
  const notesText   = `From Quote Builder. ${quoteLines.length} items. Cost: ${fmtUGXFull(totalCost)}.`;

  const payload = {
    client,
    project:      projectDesc,
    invoice_date: today,
    due_date:     due,
    amount:       selling,
    status:       'Unpaid',
    notes:        notesText
  };

  const res = await api('POST', '/api/invoices', payload);
  if (res) {
    appData.invoices.unshift(normInvoice(res));
    showToast(`Invoice ${res.number} created — ${fmtUGX(selling)}`);
  } else {
    const n       = appData.invoices.length + 1;
    const year    = new Date().getFullYear();
    const nextNum = `INV-${year}-${String(n).padStart(3, '0')}`;
    appData.invoices.unshift({ id: Date.now(), number: nextNum, client, project: projectDesc, date: today, due, amount: selling, status: 'Unpaid', notes: notesText });
    showToast(`Invoice ${nextNum} created — ${fmtUGX(selling)}`);
  }

  saveLocal();
  navigate('invoices');
}

// Compat stubs
function clearPricing() { clearQuote(); }
function savePricingToProject() { saveQuoteAsInvoice(); }

// ── Create Quote from Lead ───────────────────────────────────
function createQuoteFromLead(leadId) {
  const lead = appData.leads.find(x => x.id === leadId);
  if (!lead) return;
  navigate('pricing');
  setTimeout(() => {
    switchPricingTab('quote');
    setTimeout(() => {
      const clientEl = document.getElementById('quoteClient');
      if (clientEl) clientEl.value = lead.name + (lead.biz ? ' — ' + lead.biz : '');
      const typeEl = document.getElementById('quoteType');
      if (typeEl) {
        if (lead.service.includes('CCTV'))                                   typeEl.value = 'CCTV';
        else if (lead.service.includes('Website') || lead.service.includes('Digital')) typeEl.value = 'Digital';
        else if (lead.service.includes('CRM'))                               typeEl.value = 'Digital';
        else                                                                  typeEl.value = 'all';
        filterQuoteItems();
      }
      recalcQuote();
      showToast(`Quote builder opened for ${lead.name}`);
    }, 100);
  }, 150);
}

// ── Settings ─────────────────────────────────────────────────
async function saveSettings() {
  const apiUrl = document.getElementById('settingApiUrl')?.value.trim() || '';
  const companyName = document.getElementById('settingCompany')?.value.trim() || '';

  if (apiUrl) {
    localStorage.setItem('luxion_api_url', apiUrl);
  }

  const payload = {
    companyName
  };

  const res = await api('PUT', '/api/settings', payload);

  if (res) {
    appData.settings = {
      ...appData.settings,
      ...payload
    };
    showToast('✅ Settings saved and synced.');
    await loadAllData();
    renderPage(currentPage);
  } else {
    appData.settings = {
      ...appData.settings,
      ...payload
    };
    saveLocal();
    showToast('⚠️ Settings saved locally only.');
  }
}

// ── Modals ───────────────────────────────────────────────────
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('active');
  });
});

// ── Dark Mode ────────────────────────────────────────────────
function toggleDark() {
  const toggle = document.getElementById('darkToggle');
  toggle.classList.toggle('on');
  const isDark = toggle.classList.contains('on');
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  localStorage.setItem('luxion_dark', isDark ? '1' : '0');
  // Recreate chart with new theme colours
  if (currentPage === 'dashboard') renderPipelineChart();
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className   = 'toast';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity   = '0';
    toast.style.transform = 'translateX(30px)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Init ──────────────────────────────────────────────────────
(async function init() {
  // Restore dark mode preference
  if (localStorage.getItem('luxion_dark') === '1') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('darkToggle').classList.add('on');
  }

  // Restore saved API URL into settings field
  const savedUrl = localStorage.getItem('luxion_api_url') || '';
  const urlField = document.getElementById('settingApiUrl');
  if (urlField) urlField.value = savedUrl;

  // Load data
  await loadAllData();

  // Populate catalogue from localStorage if empty (no backend configured)
  if (appData.catalogue.length === 0) {
    appData.catalogue = [
      { id: 101, name: 'Hikvision 2MP Bullet Camera', category: 'CCTV', unit: 'pcs', unitCost: 120000, notes: 'DS-2CD2T20-I5, outdoor', updated: '2025-04-01' },
      { id: 102, name: 'Hikvision 5MP Dome Camera',   category: 'CCTV', unit: 'pcs', unitCost: 195000, notes: 'Indoor/outdoor',        updated: '2025-04-01' },
      { id: 103, name: 'DVR 4-Channel',                category: 'CCTV', unit: 'pcs', unitCost: 280000, notes: 'Hikvision DS-7204',     updated: '2025-04-01' },
      { id: 104, name: 'DVR 8-Channel',                category: 'CCTV', unit: 'pcs', unitCost: 420000, notes: 'Hikvision DS-7208',     updated: '2025-04-01' },
      { id: 105, name: 'DVR 16-Channel',               category: 'CCTV', unit: 'pcs', unitCost: 680000, notes: 'Hikvision DS-7216',     updated: '2025-04-01' },
      { id: 106, name: 'Hard Drive 1TB (Surveillance)',category: 'CCTV', unit: 'pcs', unitCost: 180000, notes: 'Seagate SkyHawk',       updated: '2025-04-01' },
      { id: 107, name: 'Hard Drive 2TB (Surveillance)',category: 'CCTV', unit: 'pcs', unitCost: 310000, notes: 'Seagate SkyHawk',       updated: '2025-04-01' },
      { id: 108, name: 'CCTV Cable (per metre)',        category: 'CCTV', unit: 'metres', unitCost: 2500, notes: 'RG59 coax + power',   updated: '2025-04-01' },
      { id: 109, name: 'BNC Connectors (pack of 10)',  category: 'CCTV', unit: 'pcs', unitCost: 15000,  notes: '',                     updated: '2025-04-01' },
      { id: 110, name: 'Power Supply Unit (9ch)',       category: 'CCTV', unit: 'pcs', unitCost: 55000,  notes: '',                     updated: '2025-04-01' },
      { id: 111, name: 'Mounting Bracket',              category: 'CCTV', unit: 'pcs', unitCost: 18000,  notes: '',                     updated: '2025-04-01' },
      { id: 112, name: 'CCTV Installation Labor (per camera)', category: 'Labor', unit: 'pcs', unitCost: 35000, notes: 'Per camera installed & configured', updated: '2025-04-01' },
      { id: 113, name: 'Site Survey',                   category: 'Labor',   unit: 'lot',   unitCost: 50000,  notes: '',                     updated: '2025-04-01' },
      { id: 114, name: 'Transport / Field Visit',       category: 'General', unit: 'lot',   unitCost: 80000,  notes: 'Within Kampala',       updated: '2025-04-01' },
      { id: 115, name: 'Domain (.ug)',                  category: 'Digital', unit: 'year',  unitCost: 80000,  notes: '',                     updated: '2025-04-01' },
      { id: 116, name: 'Web Hosting (Annual)',          category: 'Digital', unit: 'year',  unitCost: 350000, notes: 'cPanel shared',         updated: '2025-04-01' },
      { id: 117, name: 'Business Email (per account)', category: 'Digital', unit: 'year',  unitCost: 60000,  notes: 'Google Workspace',      updated: '2025-04-01' },
      { id: 118, name: 'Website Design & Development', category: 'Digital', unit: 'lot',   unitCost: 1800000,notes: 'Up to 5 pages',          updated: '2025-04-01' },
      { id: 119, name: 'CRM Development (custom)',     category: 'Digital', unit: 'lot',   unitCost: 5000000,notes: 'Includes 3 months support', updated: '2025-04-01' },
      { id: 120, name: 'SSL Certificate',              category: 'Digital', unit: 'year',  unitCost: 120000, notes: '',                     updated: '2025-04-01' }
    ];
    saveLocal();
  }

  updateProjStatuses();
  renderDashboard();
})();
