# Disaster Recovery & Backup Guide: Sri Chaitanya Dental Care CRM

Maintaining robust operational uptime and backup systems prevents critical database or file losses. This guide outlines how to utilize the platform's self-contained backups, export options, and Disaster Recovery (DR) protocols.

---

## 🗄️ Part 1: Automated Backups & Package Compiling

The Sri Chaitanya Dental CRM features a smart compile module built directly inside the administrative portal at `/crm/export`. 
This allows any authorized Administrator to generate three distinct operational backups instantly:

1. **Source Code Package (`sri-chaitanya-dental-crm-source.zip`)**:
   - Contains a complete dump of active React, Vite, components, styling configurations, types, and hooks folders.
   - Ideal for developers migrating workspaces or setting up secondary development stations.

2. **Database Engine & Schema Package (`sri-chaitanya-dental-crm-database.zip`)**:
   - Isolates `schema.sql`, individual chronological `migrations/`, target RLS `policies/`, and background reconciliation `triggers/`.
   - Used to spawn new staging clones or spin up on-premise local database mirrors on Docker.

3. **Production Deployment Package (`sri-chaitanya-dental-crm-production-package.zip`)**:
   - Combines server configurations, bundler requirements, assets, and environmental templates together.
   - Ideal for deploying standalone branches on Netlify, Render, AWS, or Vercel.

### Manual Local Storage Export
Administrators can execute on-site data downloads by visiting the **CSV Exports** panel on the backup screen.
- **Export Patients**: Instantly downloads a complete tabular UTF-8 matching index of patients, location attributes, phone registries, and total visit summaries.
- **Export Appointments Ledger**: Captures transactional records containing treatment descriptions, revenue amounts paid, and outstanding patient balances.

---

## 🚨 Part 2: Disaster Recovery (DR) Scenarios

Follow these rapid-action checksheets to restore full medical operations in the event of an outage:

### Scenario A: Local Station Crash (Zero Data Loss)
*Prerequisite*: A local computer running the clinical front-desk console has suffered a hardware failure.
1. Deploy a replacement laptop/PC at the reception desk.
2. Direct the browser to your live production Vercel subdomain link (e.g. `https://sri-chaitanya-dental-crm.vercel.app/admin`).
3. Have staff login using their registered credentials (e.g. `staff@srichaitanyadental.com`). Since patient details and appointments are stored safely in the cloud (Supabase), all data remains immediately accessible with zero local system setup.

### Scenario B: Accidental Production Table Override (Database Recovery)
*Prerequisite*: Critical records on the patients or appointments tables have been corrupted or truncated during manual editing.
1. Log into your **Supabase Cloud Dashboard**.
2. Navigate to your project's **Database** > **Backups** tab.
3. Supabase automatically retains daily physical database backups (for up to 7, 14, or 30 days depending on your subscription tier).
4. Select the closest restorable rollback point prior to the accidental incident.
5. Launch **Point-in-Time Recovery (PITR)** or select a standard Snapshot backup to re-initialize your live tables seamlessly.
6. The client React application will automatically pull from the restored schema upon refresh.

### Scenario C: Complete Cloud Migration (Recreating the Base Setup)
*Prerequisite*: You want to move your clinic's systems to a completely fresh Supabase or PostgreSQL account.
1. Download `sri-chaitanya-dental-crm-database.zip` from your administrative panels.
2. Launch a blank database instance under the new cloud account.
3. Open the `supabase/schema.sql` file and execute it in your new Database SQL Console to automatically structure tables, indexes, and triggers.
4. Export high-priority Patient/Appointment CSVs from your previous console, and import them directly into the new Postgres database via administrative table loaders or pg_restore tools.
5. Re-authenticate your staff roles following the UUID mapping instructions inside the `DEPLOY_GUIDE_VERCEL.md` file.
