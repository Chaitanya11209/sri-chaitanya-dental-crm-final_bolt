# Deployment Guide: Sri Chaitanya Dental Care CRM

This comprehensive production deployment guide outlines setup instructions for local development, GitHub pushing, Vercel frontend hosting, and Supabase cloud database configuration.

---

## 🚀 Part 1: Local Development Quick-Start

1. **Extract Repository**: Unpack the master repository archive.
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Environment Setup**: Copy `.env.example` to create a local `.env` configuration file:
   ```bash
   cp .env.example .env
   ```
4. **Boot Dev Server**:
   ```bash
   npm run dev
   ```
5. **Access Application**:
   - Website Landing Page: `http://localhost:5173/` or `http://localhost:3000/`
   - Clinical CRM Dashboard: `http://localhost:5173/admin` or `http://localhost:3000/admin`
   - **Database and Auth**: Access is secured via Supabase Auth and checked strictly against the database `staff_roles` table. No hardcoded or mock developer backdoors exist.

---

## 🗄️ Part 2: Supabase Relational Database Setup

Select a target cloud hosting region (e.g., AWS Mumbai / Singapore) and launch a new PostgreSQL project on [Supabase](https://supabase.com).

### 1. Execute SQL Schema Definitions
1. Go to your **Supabase Project Dashboard**.
2. Select **SQL Editor** from the left sidebar navigation layout.
3. Establish a **New Query**.
4. Open the SQL template located at `supabase/schema.sql` inside your repository. Copy and paste its exact contents into the Supabase editor block.
5. Click **Run**. This establishes your full tables schema:
   - `patients` (With constraints for double-entry checks)
   - `appointments` (With scheduler alignment constraints)
   - `doctors` (Full clinical credential logs)
   - `treatments` (Clinical treatment stages metrics)
   - `staff_roles` (Linking user IDs for ACL)
   - `audit_logs` (Secured ledger logging operations)
6. Run migration logs from `supabase/migrations/` sequentially if you want to deploy discrete incremental tablesets.

### 2. Configure Realtime Synchronization
To enable live instant dashboard updates when patients register or make bookings:
1. In the Supabase Dashboard, click on the **Database** menu in the sidebar list.
2. Select **Replication**.
3. Toggle "Inbound publication (supabase_realtime)" on for the `patients`, `appointments`, and `treatments` tables.

---

## 🔑 Part 3: Configure Role-Based Access Control (RBAC)

Ensure your medical coordinators are classified under correct access control lists (ACL) to protect sensitive billing charts.

1. Go to the **Supabase Dashboard** > **Authentication** > **Users**.
2. Click **Add User** > **Create User**. Set an email login and password credential.
3. Copy the newly generated **User ID** (UUID format from the user list).
4. Head back to the **SQL Editor** and run the query:
   ```sql
   INSERT INTO staff_roles (user_id, role, name)
   VALUES 
     ('YOUR_USER_UUID_FROM_AUTHENTICATION_SCREEN', 'admin', 'Dr. Sri Chaitanya');
   ```
   *Available Role Scopes:*
   - `'admin'`: Complete read-write permissions, access to financial Collections charts, settings configuration, and full CSV/ZIP export dashboards.
   - `'staff'`: General clinical access to patients, schedules, and active treatment cards; hidden from revenue stats and Collections grids.

---

## 🌐 Part 4: Direct Vercel Frontend Deployment

Vlc Web Deployment allows instant global hosting on a performant serverless CDN.

### 1. Prepare GitHub Repository
```bash
git init
git add .
git commit -m "Production Release Sri Chaitanya Dental CRM"
git branch -M main
git remote add origin https://github.com/your-username/repo-name.git
git push -u origin main
```

### 2. Import into Vercel
1. Access the **Vercel Console** (https://vercel.com).
2. Click **Add New** > **Project** and authorize your GitHub account.
3. Import the targeted repository name.
4. Vercel automatically detects the **Vite** configuration profile:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Expand the **Environment Variables** panel and add variables matching `.env.example`:
   - `VITE_SUPABASE_URL` = (Your projects URL endpoint)
   - `VITE_SUPABASE_ANON_KEY` = (Your projects anonymous public API key)
6. Select **Deploy**. Your custom domain link is ready in less than 45 seconds!
