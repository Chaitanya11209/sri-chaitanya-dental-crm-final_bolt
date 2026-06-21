# Deployment Guide: Sri Chaitanya Dental Clinic Workspace

This production deployment guide walks you through setting up and deploying the Sri Chaitanya Dental Clinic CRM to **Vercel** as the frontend, matched with a secure and real-time **Supabase PostgreSQL** database.

---

## Part 1: Supabase Database Setup

Select your favorite region and configure a new project inside your Supabase dashboard.

### 1. Execute SQL Migration & Schema Schema
1. Select your project in the **Supabase Dashboard**.
2. Navigate to **SQL Editor** in the left sidebar.
3. Open a **New query**.
4. Log into the local codebase bundle at `supabase/schema.sql`. Copy and paste the entire schema file into Supabase query panel.
5. Click **Run**. This establishes your relational tables:
   - `patients` (with unique index phone and email mappings, cascade behaviors)
   - `appointments` (linked via patient foreign keys with trigger functions)
   - `treatments` (tracking operational clinical notes)
   - `staff_roles` (configuring role assignments)
   - `portal_audit_logs` (retaining clinical change histories)
6. Run any specific migration files from the `supabase/migrations/` directory sequentially to apply additional updates (e.g., real-time appointment sync triggers).

---

## Part 2: Setup Vercel Deployment

Deploy the client application with effortless CDN hosting on Vercel.

### Option A: Direct Vercel Git Integration (Recommended)
1. Initiate a public or private GitHub repository.
2. Push your extracted codebase contents to your GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "Sri Chaitanya Dental Workspace V1.0"
   git branch -M main
   git remote add origin https://github.com/your-username/repo-name.git
   git push -u origin main
   ```
3. Visit the **Vercel Dashboard** (https://vercel.com) and click **Add New** > **Project**.
4. Authorize and import your GitHub repository.
5. Vercel automatically detects **Vite** as your framework template, configuring:
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. Expand **Environment Variables** and insert variables mapped from `.env.example`:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
7. Click **Deploy**. Your live medical platform will build and launch in less than a minute!

---

## Part 3: Configure Role-Based Access Control

Since Sri Chaitanya Dental Care uses strict row-level security (RLS) policies, follow these steps to add your administrator and clinical staff login credentials:

1. In the **Supabase Dashboard**, navigate to **Authentication** > **Users**.
2. Click **Add User** > **Create User** and enter a valid email address and password (e.g., `admin@srichaitanyadental.com`).
3. Under active **Authentication Users**, locate the freshly registered user and copy their **User ID** (UUID format).
4. Head to the **SQL Editor** and run an INSERT command to assign roles:

```sql
INSERT INTO staff_roles (user_id, role, name)
VALUES 
  ('USER_UUID_HERE', 'admin', 'Dr. Sri Chaitanya');
```

Role Options:
- `'admin'`: Grants complete access, including Collections, Billing, reports, settings, and full CRUD.
- `'staff'`: Restricts access from delicate collections and billing grids while maintaining general patient workflows, treatments, and scheduler queues.

---

## Part 4: Production Checklist

Before launching, please review these key settings:
- **Enable Realtime**: Ensure Supabase Realtime is enabled on the `patients` and `appointments` tables so database changes automatically trigger UI updates.
- **Configure SMTP**: Set up transactional email delivery (e.g., EmailJS) to power your automated notification forms.
- **Change Default Keys**: Never expose your service role keys to the browser. Only the public anon key should be prefix-mapped using `VITE_`.
