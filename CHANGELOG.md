# Changelog — Sri Chaitanya Dental Clinic CRM

All notable changes and deployment updates for the Sri Chaitanya Dental Workspace are documented here.

## [1.3.0] — 2026-06-09
### Added
- **Service Worker Offline Caching**: Embedded custom `/public/sw.js` intercepts with high-speed dynamic caching of static front-end assets and dynamic Supabase REST database endpoints.
- **Auto-Fallbacks for Offline Access**: Enabled seamless read backup when clinical internet drops, returning cached patient profiles and appointment schedules immediately.
- **Connection Status Core Watcher**: Formulated real-time status tracker in `CRMLayout.tsx` to detect offline modes dynamically.
- **Visual Offline Alert Pill**: Incorporated an eye-safe animated pulsing amber indicator badge inside the navigation header to keep clinical coordinators notified of active cached states.

## [1.2.0] — 2026-06-09
### Added
- **Multi-Zip Export Support**: Refactored the backup mechanisms to support on-demand building of dedicated archives (Source ZIP, Database & Migrations ZIP, Production Deployable ZIP, and Master Full-Repository).
- **Consolidated Repository Structure**: Added complete `/docs` pipeline and isolated SQL subfolders (`supabase/policies/` and `supabase/triggers/`) for compliance.
- **Dynamic Backup Interface**: Implemented standalone buttons on the `/crm/export` page with full real-time compilation notifications.
- **Deep Alignment Engine**: Formulated automatic index repair to reconcile orphaned appointments and link them to patient registers via standard regex-processed phone matching.

### Changed
- **Linter & Pipeline Alignment**: Removed unneeded custom linter scripts and verified zero-compilation-warnings standard output under standard Vite configuration.

---

## [1.1.0] — 2026-06-08
### Added
- **Doctor Assignment Panel**: Embedded dynamic selector linked directly to active SQL doctors roster.
- **Treatments Progress-Tracker**: Multi-stage clinical log with total session tracking, progress sliders, and session increments.
- **Patient Appointment Triggers**: Automated trigger to align last and next visit timelines based on scheduler changes.
- **Admin vs Staff Access Isolation**: Strict validation on collections analytics and financial invoices grids.

---

## [1.0.0] — 2026-06-07
### Added
- **Initial Landing Page**: Interactive booking form, before/after slider, doctor specialties, and WhatsApp coordinates.
- **Supabase Authentication**: Integrated secure user email/password login flow with Client-Side developer fallbacks.
- **Billing Ledger**: Invoice PDF generation using streamlined jsPDF client-side layout.
- **Database Migrations Baseline**: Established initial tables schemas, indexed patterns, and basic row-level safety (RLS) definitions.
