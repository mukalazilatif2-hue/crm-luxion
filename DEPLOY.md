# DEPLOY.md — Luxion CRM Quick Deploy Cheat Sheet
**Owner:** Latif Mukalazi | Luxion Solutions Limited, Kampala

---

## 1. SUPABASE (Database) — supabase.com

```
1. supabase.com → New Project → set strong password → save it
2. SQL Editor → New Query → paste schema below → Run
3. Project Settings → Database → Connection String → URI → copy it
```

**SQL to paste** (creates all tables, zero data):
```sql
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, biz TEXT DEFAULT '',
  phone TEXT DEFAULT '', email TEXT DEFAULT '', service TEXT DEFAULT 'Website',
  value INTEGER DEFAULT 0, stage TEXT DEFAULT 'New', priority TEXT DEFAULT 'Medium',
  source TEXT DEFAULT 'Direct', followup DATE, notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY, number TEXT NOT NULL, client TEXT NOT NULL,
  project TEXT DEFAULT '', invoice_date DATE DEFAULT CURRENT_DATE, due_date DATE,
  amount INTEGER DEFAULT 0, status TEXT DEFAULT 'Unpaid', notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, client TEXT DEFAULT '',
  type TEXT DEFAULT 'Website', status TEXT DEFAULT 'Discovery', assigned TEXT DEFAULT '',
  value INTEGER DEFAULT 0, start_date DATE, end_date DATE, notes TEXT DEFAULT '',
  progress INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS catalogue_items (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'General',
  unit TEXT DEFAULT 'pcs', unit_cost INTEGER DEFAULT 0, notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY, key TEXT UNIQUE NOT NULL, value TEXT, updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 2. RENDER (Backend) — render.com

```
1. render.com → New + → Web Service → connect GitHub repo
2. Settings:
   Root Directory : backend
   Build Command  : npm install
   Start Command  : node server.js
   Instance Type  : Free
3. Environment Variables:
   DATABASE_URL = postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
   NODE_ENV     = production
   FRONTEND_URL = (fill in after Netlify deploy)
4. Create Web Service → wait ~3 min
5. Test: https://YOUR-APP.onrender.com/health
   → should return: { "status": "ok" }
```

---

## 3. NETLIFY (Frontend) — netlify.com

```
1. netlify.com → Add new site → Deploy manually
2. Drag & drop the frontend/ folder
3. Note your URL: https://luxion-crm-XXXX.netlify.app
```

---

## 4. CONNECT FRONTEND ↔ BACKEND

```
A. In Render → Environment → set FRONTEND_URL = https://luxion-crm-XXXX.netlify.app → Save

B. In the live site:
   → Settings page → Backend section
   → Paste: https://YOUR-APP.onrender.com
   → Save Settings
```

---

## 5. SECURE THE SITE (optional)

```
Netlify → Site settings → Access control → Visitor access → Password protection → Enable
Set a password → share only with Latif Mukalazi
```

---

## 6. QUICK CHECKS

| Check | Expected Result |
|---|---|
| `GET /health` | `{ "status": "ok", "owner": "Latif Mukalazi" }` |
| `GET /api/leads` | `[]` (empty array — no seed data) |
| `GET /api/invoices` | `[]` |
| `GET /api/projects` | `[]` |
| `GET /api/catalogue` | `[]` |

---

## File locations reminder

```
backend/  → Deploy to Render
frontend/ → Deploy to Netlify (drag & drop the folder)
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Backend returns 500 | Check DATABASE_URL in Render env vars — password correct? |
| CORS error in browser | Set FRONTEND_URL in Render env to exact Netlify URL (no trailing slash) |
| No data after saving | Check Settings → Backend URL is set correctly (no trailing slash) |
| Render sleeps after 15 min | Free tier spins down — first request takes ~30s to wake up |
| Can't connect to Supabase | Make sure SSL is enabled (already handled in db.js) |

---

*Luxion Operations System · Latif Mukalazi · Luxion Solutions Limited · Kampala, Uganda*
