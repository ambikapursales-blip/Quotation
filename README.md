# MongoDB Configuration
# Connection string (e.g., mongodb://localhost:27017 or mongodb+srv://...)
MONGODB_URI=mongodb://localhost:27017
# Database name
MONGODB_DB_NAME=quotation_db

# Secret used to sign the authentication session cookie (HMAC-SHA256).
# Keep it private and stable: changing it invalidates all active sessions.
AUTH_SECRET=O2D_Quotation_Manager_2026_8fK9mP4xQ7vL2nR6sT1

# O2D sync — server-side only. Never use NEXT_PUBLIC_ prefix.
# When a quotation is marked Won, the Quotation Software POSTs the payload
# to this URL so O2D can create/match Customers, Orders and Order_Items.
O2D_SYNC_API_URL=https://your-production-o2d-domain.com/api/sync/quotations
O2D_SYNC_SECRET=your-o2d-sync-secret

# ─── Secret Login (Internal/Emergency Access) ─────────────────────────────
# Enable the secret login route at /7326982411
# WARNING: Only enable in development or controlled environments!
# Default: false (disabled in production)
ENABLE_SECRET_LOGIN=false
# Secret key required to access the secret login route (set a strong random value)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SECRET_LOGIN_KEY=
# Optional: Pre-configured user ID to log in as (MongoDB _id from users collection)
# If not set, will use the first active user from the users collection
SECRET_LOGIN_USER_ID=

# Quotation Manager

A modern, SaaS-style quotation management application. This is the foundation
build: the Quotation creation workflow, a scalable Next.js structure, and a
MongoDB-backed API layer that later modules (Customers, Reports,
Approvals, etc.) can plug into.

## Stack

- Next.js 14 (App Router) + React 18
- JavaScript only (no TypeScript)
- Tailwind CSS
- Zod for validation (shared between client and API route)
- MongoDB (server-side only)

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your MongoDB connection details
npm run dev
```

Visit `http://localhost:3000` — it redirects to `/quotations`, with
`/quotations/new` as the quotation creation workflow.

## Connecting MongoDB

1. Ensure MongoDB is running (local or Atlas).
2. Fill in `.env.local`:
   - `MONGODB_URI` (e.g., `mongodb://localhost:27017` or Atlas connection string)
   - `MONGODB_DB_NAME` (e.g., `quotation_db`)
   - `AUTH_SECRET` (random string for session signing)
3. Run the migration to populate MongoDB from Google Sheets (one-time):
   ```bash
   node scripts/migrate-to-mongodb.js
   node scripts/verify-migration.js
   ```

The frontend never talks to MongoDB directly. It POSTs to
`/api/quotations`, which validates the payload with Zod and — only if valid —
writes to MongoDB via `mongodbService.js`.

## Folder structure

```
src/
  app/
    layout.js                 Root layout, fonts, ToastProvider
    page.js                   Redirects "/" to "/quotations"
    globals.css
    7326982411/
      page.js                 Secret login page (hidden, env-controlled)
    quotations/
      page.js                 Quotations list
      new/page.js             Quotation creation workflow
      [quotationNo]/edit/page.js  Quotation edit page
    api/
      quotations/route.js     POST (create) + GET (list) endpoints
      quotations/[quotationNo]/route.js    GET/PUT single quotation
      quotations/[quotationNo]/followup/route.js  Follow-up & Order Status
      customers/route.js      Customer list/create
      customers/[id]/route.js Customer get/update/delete
      customers/search/route.js Customer search
      parts/route.js          Parts list/create
      parts/[id]/route.js     Part get/update/delete
      parts/search/route.js   Parts search
      dashboard/route.js      Dashboard analytics
      dashboard/drilldown/route.js Dashboard drill-down
      dashboard/followups/route.js Pending follow-ups
      auth/login/route.js     Login
      auth/logout/route.js    Logout
      auth/me/route.js        Current user
      secret-login/route.js   Secret login endpoint
      secret-login/check/route.js Secret login feature check

  components/
    ui/                       Generic, reusable primitives (Button, Input, Select,
                               Textarea, Card, Badge, Toaster, FieldShell)
    layout/                   AppShell, Sidebar, Topbar — shared app chrome
    quotations/                Quotation-module-specific components
      CustomerInfoSection.js
      QuotationInfoSection.js
      ItemListSection.js / ItemRow.js
      SummaryRail.js           The "ledger" running-total panel
      QuotationForm.js         Composes the three sections + summary rail

  hooks/
    useQuotationForm.js       Form state, validation wiring, submit logic
    useToast.js               Toast context/provider (no external dep)

  lib/
    db/mongodb.js             MongoDB connection singleton
    models/                   MongoDB models (Customer, Part, Quotation, FollowupHistory, User)
    services/                 Server-only service layer
      mongodbService.js       Unified MongoDB service (replaces googleSheetsService)
      usersService.js         User authentication
      o2dSyncService.js       O2D sync integration
    validation/quotationSchema.js   Zod schemas, shared client + server
    constants/quotationOptions.js    Dropdown option lists, empty-row factory
    utils/formatters.js       Currency + totals math
    utils/cn.js               className helper
    utils/dateUtils.js        Date parsing/formatting
    server/dashboard.js       Dashboard data aggregation

  scripts/
    migrate-to-mongodb.js     One-time migration from Google Sheets
    verify-migration.js       Post-migration verification
```

## Adding a new module later

The structure is intentionally modular so growth doesn't require refactors:

- **New page/route**: add a folder under `src/app/<module>` and reuse
  `AppShell` for consistent chrome.
- **New nav item**: add an entry to `NAV_ITEMS` in
  `src/components/layout/Sidebar.js` (flip `available: true` once the route
  exists).
- **New backend logic**: add a route under `src/app/api/<module>/route.js`
  and a matching service in `src/lib/services/`. Keep MongoDB (or any
  other data store) access inside `lib/services` — never called from
  components directly.
- **New form fields**: extend the relevant Zod schema in
  `lib/validation/quotationSchema.js`, then add the field to the matching
  section component and the initial state in `useQuotationForm.js`.
- **Shared UI**: new form controls belong in `components/ui/` so every
  future module gets the same look for free.

## Design notes

The visual direction is a "ledger" theme: a dark, structured sidebar/summary
panel next to light, spacious form cards — reflecting that a quotation is,
at its core, a running total that always needs to be visible while you
build it. Item rows are numbered because they are a genuine ordered list
(the line items on the eventual PDF quotation), not decoration.

## Migration from Google Sheets

This application previously used Google Sheets as the database backend.
The migration is complete and all data has been moved to MongoDB.

Key changes:
- `googleSheetsService.js` → `mongodbService.js` (drop-in replacement)
- 4 Google Sheets tabs → 5 MongoDB collections
- All API routes updated to use MongoDB
- Build-time lazy MongoDB connection (no DB needed during build)
- Secret login route at `/7326982411` (disabled by default)