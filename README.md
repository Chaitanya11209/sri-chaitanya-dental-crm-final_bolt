# Sri Chaitanya Dental Clinic & Staff CRM

A fully consolidated, production-ready healthcare management workspace featuring a medical booking website and an isolation-aware CRM dashboard. Integrated with an on-demand clinical database backing.

---

## 📂 Consolidated Folder Structure

```text
Sri-Chaitanya-Dental-CRM/
├── src/                          # Real-Time Front-End Application (React + Vite)
│   ├── components/               # Segmented visual interface elements
│   ├── contexts/                 # Dynamic state systems (Auth, Data syncing)
│   ├── hooks/                    # Reusable hook definitions
│   ├── pages/                    # CRM routers & Landing templates
│   ├── styles/                   # Core styling configs and themes
│   └── types/                    # Shared TypeScript types & Enums
├── public/                       # Static media, metadata files, and client-side icons
├── supabase/                     # Database Engine Infrastructure
│   ├── migrations/               # Step-by-step SQL incremental updates
│   ├── policies/                 # Row-Level Security (RLS) policies
│   └── triggers/                 # Automated Patient & Appointment state systems
├── docs/                         # Structured Release & Operations Guides
│   ├── CHANGELOG.md              # Historical iterations & feature registries
│   ├── deployment-guide.md       # Multi-platform production setup checklist
│   ├── backup-recovery-guide.md  # DR and export recovery instructions
│   └── vercel-setup.md           # Vercel CDN deployment configurations
├── backups/                      # Storage path directory for clinical data exports
│   └── .gitkeep                  # Empty folder persistence
├── package.json                  # System metadata, dependencies, and script profiles
├── vite.config.ts                # Bundler routes & on-demand packagers
└── vercel.json                   # Serverless CDN navigation overrides
```

---

## ⚙️ Core Modules & Features

- **Patient Records & History**: Track registration states, complete milestone checklists, and aggregate histories.
- **Appointment Scheduler**: Visual grid with interactive calendar, time slots, status updates, and doctor-matching options.
- **Automated Sync Engine**: Database triggers instantly match appointments to patient records using telephone mappings.
- **Treatment Loggers**: Track multi-stage clinical cycles, sessions completed, and clinical dental charts.
- **Collections Grid**: Protected revenue tracking, invoicing ledgers, and black-and-white print-ready PDF generator.
- **On-Demand Exporter**: Download customized backups directly from the system admin panel.

---

## 🚀 Deployment Guide — Fast Start

### 1. Build and Run Workspace Locally
```bash
npm install
cp .env.example .env
npm run dev
```

### 2. Configure Database Tables
Execute the complete database blueprint located in `supabase/schema.sql` using the SQL console in your **Supabase Dashboard** to automatically spawn structured schemas, policies, and system triggers.

### 3. Verify TypeScript Standard Compliance
To run a complete static analysis check, execute:
```bash
npm run typecheck
```
These steps will boot up the full client app, with the local backup exporter accessible inside CRM Admin panels.
