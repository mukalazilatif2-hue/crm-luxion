# Luxion Operations System
**Owner:** Latif Mukalazi  
**Company:** Luxion Solutions Limited, Kampala, Uganda  
**Stack:** Node.js + Express · PostgreSQL (Supabase) · Netlify (frontend) · Render (backend)

---

## Table of Contents
1. [Project Structure](#project-structure)
2. [Step 1 — Set up the Supabase Database](#step-1--set-up-the-supabase-database)
3. [Step 2 — Deploy the Backend to Render](#step-2--deploy-the-backend-to-render)
4. [Step 3 — Deploy the Frontend to Netlify](#step-3--deploy-the-frontend-to-netlify)
5. [Step 4 — Connect Frontend to Backend](#step-4--connect-frontend-to-backend)
6. [Step 5 — Log in After Deployment](#step-5--log-in-after-deployment)
7. [Local Development](#local-development)
8. [Features](#features)

---

## Project Structure

```
luxion-crm/
├── backend/
│   ├── server.js          ← Express entry point
│   ├── db.js              ← PostgreSQL pool (pg)
│   ├── routes/
│   │   ├── leads.js       ← GET/POST/PUT/DELETE /api/leads
│   │   ├── invoices.js    ← GET/POST/PUT/PATCH/DELETE /api/invoices
│   │   ├── projects.js    ← GET/POST/PUT/DELETE /api/projects
│   │   └── catalogue.js   ← GET/POST/PUT/DELETE /api/catalogue
│   ├── .env.example       ← Copy to .env and fill in values
│   └── package.json
├── frontend/
│   ├── index.html         ← Single-page app shell
│   ├── app.js             ← All frontend logic (vanilla JS)
│   └── style.css          ← All styles (unchanged design)
├── README.md              ← This file
└── DEPLOY.md              ← Quick-reference cheat sheet
```

---

## Step 1 — Set up the Supabase Database

### 1.1 Create a free Supabase project
1. Go to **https://supabase.com** and sign up (free).
2. Click **"New Project"**.
3. Choose a name, set a **strong database password** (save it!), and pick a region close to Uganda (e.g. `eu-west-1`).
4. Wait ~2 minutes for the project to provision.

### 1.2 Run the SQL schema
1. In your Supabase project, click **"SQL Editor"** in the left sidebar.
2. Click **"New Query"**.
3. Paste the **entire block below** and click **"Run"**:

```sql
-- ============================================================
-- Luxion Operations System — Database Schema
-- Owner: Latif Mukalazi | Luxion Solutions Limited
-- Run this once in Supabase SQL Editor to create all tables.
-- ============================================================

-- Leads / Deals
CREATE TABLE IF NOT EXISTS leads (
  id          SERIAL PRIMARY KEY,
  name        TEXT        NOT NULL,
  biz         TEXT        DEFAULT '',
  phone       TEXT        DEFAULT '',
  email       TEXT        DEFAULT '',
  service     TEXT        DEFAULT 'Website',
  value       INTEGER     DEFAULT 0,
  stage       TEXT        DEFAULT 'New',
  priority    TEXT        DEFAULT 'Medium',
  source      TEXT        DEFAULT 'Direct',
  followup    DATE,
  notes       TEXT        DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id           SERIAL PRIMARY KEY,
  number       TEXT        NOT NULL,
  client       TEXT        NOT NULL,
  project      TEXT        DEFAULT '',
  invoice_date DATE        DEFAULT CURRENT_DATE,
  due_date     DATE,
  amount       INTEGER     DEFAULT 0,
  status       TEXT        DEFAULT 'Unpaid',
  notes        TEXT        DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id          SERIAL PRIMARY KEY,
  name        TEXT        NOT NULL,
  client      TEXT        DEFAULT '',
  type        TEXT        DEFAULT 'Website',
  status      TEXT        DEFAULT 'Discovery',
  assigned    TEXT        DEFAULT '',
  value       INTEGER     DEFAULT 0,
  start_date  DATE,
  end_date    DATE,
  notes       TEXT        DEFAULT '',
  progress    INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Price Catalogue
CREATE TABLE IF NOT EXISTS catalogue_items (
  id          SERIAL PRIMARY KEY,
  name        TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'General',
  unit        TEXT        DEFAULT 'pcs',
  unit_cost   INTEGER     DEFAULT 0,
  notes       TEXT        DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Settings (single row — optional, for future use)
CREATE TABLE IF NOT EXISTS settings (
  id          SERIAL PRIMARY KEY,
  key         TEXT UNIQUE NOT NULL,
  value       TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

4. You should see **"Success. No rows returned"** — that means all 5 tables were created with zero seed data.

### 1.3 Get your database connection string
1. In Supabase, go to **Project Settings → Database**.
2. Scroll to **"Connection String"** → select **"URI"** tab.
3. Copy the string. It looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.abcxyz123.supabase.co:5432/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with the password you set in Step 1.1.
5. **Save this string** — you'll need it in Step 2.

---

## Step 2 — Deploy the Backend to Render

### 2.1 Push to GitHub
1. Create a **new GitHub repository** (e.g. `luxion-crm-backend`).
2. Upload or push only the `backend/` folder contents (or the whole project — Render will only run what you tell it to).

### 2.2 Create a new Web Service on Render
1. Go to **https://render.com** and sign up (free).
2. Click **"New +"** → **"Web Service"**.
3. Connect your GitHub repo.
4. Set the following:

| Setting | Value |
|---|---|
| **Name** | `luxion-crm-backend` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |
| **Instance Type** | Free |

### 2.3 Add environment variables
Still in Render, scroll to **"Environment Variables"** and add:

| Key | Value |
|---|---|
| `DATABASE_URL` | The Supabase URI you copied in Step 1.3 |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | *(Leave blank for now — fill in after Step 3)* |

5. Click **"Create Web Service"**. Render will build and deploy (takes ~3 minutes).
6. Once deployed, note your backend URL:  
   `https://luxion-crm-backend.onrender.com`

### 2.4 Test the backend
Open in your browser:
```
https://luxion-crm-backend.onrender.com/health
```
You should see:
```json
{ "status": "ok", "system": "Luxion Operations System", "owner": "Latif Mukalazi" }
```

---

## Step 3 — Deploy the Frontend to Netlify

### 3.1 Prepare the frontend folder
The `frontend/` folder contains only 3 files:
- `index.html`
- `app.js`
- `style.css`

No build step required — it's plain HTML/CSS/JS.

### 3.2 Deploy to Netlify
**Option A — Drag and drop (easiest):**
1. Go to **https://netlify.com** and sign up (free).
2. Click **"Add new site"** → **"Deploy manually"**.
3. Drag and drop the `frontend/` folder into the upload area.
4. Netlify will deploy instantly and give you a URL like:  
   `https://luxion-crm-abc123.netlify.app`

**Option B — From GitHub:**
1. Push the `frontend/` folder to a GitHub repo.
2. In Netlify: **"Add new site"** → **"Import from Git"**.
3. Select your repo.
4. Set **Publish directory** to `frontend`.
5. Click **"Deploy site"**.

### 3.3 Set your Netlify site name (optional but recommended)
In Netlify: **Site settings → Domain management → Site name** → change to `luxion-crm` (or similar).

---

## Step 4 — Connect Frontend to Backend

### 4.1 Set the backend URL in Render (CORS)
1. Go back to Render → your backend service → **Environment**.
2. Set `FRONTEND_URL` to your Netlify URL (e.g. `https://luxion-crm.netlify.app`).
3. Click **"Save Changes"** — Render will restart automatically.

### 4.2 Set the backend URL in the frontend
1. Open your deployed Netlify site.
2. Click **Settings** (gear icon in the left sidebar) or navigate to the Settings page.
3. Scroll to the **"Backend"** section.
4. Paste your Render backend URL:  
   `https://luxion-crm-backend.onrender.com`
5. Click **"Save Settings"**.

The frontend will now load all data from the real PostgreSQL database on Supabase.

> **Note:** The app works fully offline too — if no backend URL is set, all data is saved in the browser's localStorage. You can switch from offline → online at any time by setting the API URL in Settings.

---

## Step 5 — Log in After Deployment

This CRM is a **single-user internal tool** — there is no login system by design. It is accessed directly by the owner (Latif Mukalazi).

**To secure it** (optional but recommended):

**Option A — Netlify Password Protection (simplest):**
1. In Netlify: **Site settings → Access control → Visitor access**.
2. Enable **"Password protection"** and set a password.
3. Anyone visiting the site will be prompted for the password.

**Option B — Add authentication yourself:**
- Implement a simple JWT login on the backend (`/api/auth/login` endpoint).
- Store a token in localStorage on the frontend.
- Add a middleware to protect all `/api/*` routes.

---

## Local Development

### Run the backend locally
```bash
cd backend
cp .env.example .env
# Edit .env and fill in DATABASE_URL with your Supabase URI
npm install
npm run dev
# Backend runs on http://localhost:3001
```

### Serve the frontend locally
No build needed. Use any static file server:
```bash
cd frontend
npx serve .
# or: python3 -m http.server 5500
```

Open `http://localhost:5500` in your browser.

Then in the app, go to **Settings → Backend** and set:  
`http://localhost:3001`

---

## Features

| Feature | Details |
|---|---|
| **Leads & Deals** | Full pipeline with 7 stages, priority, source, follow-up dates |
| **Pricing Engine** | Price catalogue + quote builder with markup calculator and profit margin indicator |
| **Invoices** | Create, track, mark paid/partial, overdue alerts, **Download PDF** (jsPDF, in-browser) |
| **Projects** | Track progress, deadlines, urgency badges, estimated profit per project |
| **Dashboard** | Financial overview, pipeline chart (Chart.js doughnut), follow-up reminders |
| **Mobile** | Bottom tab bar, cards instead of tables on mobile, 375px-safe layout |
| **Offline mode** | Works fully in localStorage if no backend is configured |
| **Dark mode** | Toggle in Settings, preference saved in localStorage |

---

*Luxion Operations System — built for Luxion Solutions Limited, Kampala Uganda.*
