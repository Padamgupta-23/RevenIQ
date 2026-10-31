# RevenIQ: 3-Minute Live Presentation & Video Demo Script

This document provides a timed, screen-by-screen presenter's cue-sheet for delivering an engaging 3-minute product demonstration of **RevenIQ: Revenue Intelligence and Subscription Management**.

---

## Demo Overview & Flow Matrix

| Time Window | Segment | Persona | Key Features Demonstrated |
|:---:|---|---|---|
| **0:00 - 0:20** | 1. Customer Signup & Password Security | Customer | Live password policy checklist, public signup auto-assigning `CUSTOMER` role, JWT `httpOnly` cookie |
| **0:20 - 0:45** | 2. Admin Login & Catalog Configuration | Admin | Products with attribute variant pricing, recurring plans with policy switches, discount rules with atomic limits |
| **0:45 - 1:15** | 3. Quotation from Template & Lifecycle Activation | Staff / Admin | 1-click quote generation, automated tax snapshotting, lifecycle stepper (`DRAFT` $\rightarrow$ `QUOTATION` $\rightarrow$ `CONFIRMED` $\rightarrow$ `ACTIVE`) |
| **1:15 - 1:45** | 4. Automated Recurring Billing Run Engine | Admin | Batch processing, multi-period catch-up loop, idempotency skip on rerun, applied discount usage decrement |
| **1:45 - 2:10** | 5. Invoice Review, Email Dispatch & Payment | Staff | Printable HTML view, email notification simulation, `SELECT ... FOR UPDATE` row-locked payment, auto-reconciliation to `PAID` |
| **2:10 - 2:35** | 6. Real-time Finance Analytics Dashboard | Admin / Executive | Live KPI metrics, normalized MRR, interactive Recharts monthly revenue chart, sub-100ms SQL aggregates |
| **2:35 - 3:00** | 7. Customer Self-Service Portal & Tenant Isolation | Customer | Customer contract management, policy-checked pause/renew, invoice ledger, multi-tenant 404 security isolation |

---

## Detailed Step-by-Step Cue Sheet

### Segment 1: Customer Signup & Password Security (0:00 - 0:20)
**Screen**: [http://localhost:5173/signup](http://localhost:5173/signup)  
**Persona**: New Prospective Customer

#### Actions:
1. Open the signup page in an incognito window or logged-out browser.
2. In the password field, type `pass` and pause.
   - Point out the **interactive validation checklist**:
     - ❌ More than 8 characters
     - ❌ At least one uppercase letter
     - ❌ At least one lowercase letter
     - ❌ At least one special character
3. Complete the input with `SecurePass123!`: observe all indicators turning green in real time.
4. Fill in:
   - **Name**: `Sarah Connor`
   - **Email**: `sarah@cyberdyne.test`
   - **Company**: `Cyberdyne Systems`
5. Click **"Create Account"**.

#### Spoken Narrative:
> *"Welcome to RevenIQ. We begin with our customer-facing onboarding. Notice our non-negotiable security requirements: passwords strictly require more than 8 characters, mixed casing, and special characters, with a live visual checklist validated uniformly on both client and backend. Public registrations automatically receive the CUSTOMER role and receive a secure, httpOnly JWT session cookie."*

---

### Segment 2: Admin Login & Catalog Configuration (0:20 - 0:45)
**Screen**: [http://localhost:5173/login](http://localhost:5173/login) $\rightarrow$ Products / Plans / Discounts  
**Persona**: System Administrator (`admin@reveniq.test` / `DemoPass123!`)

#### Actions:
1. Log in using `admin@reveniq.test`.
2. Navigate to **Catalog $\rightarrow$ Products**:
   - Open product **"ERP Software License"**.
   - Show attribute variants: e.g. `Brand = Odoo` adding `+$560.00` to the base sales price.
3. Navigate to **Catalog $\rightarrow$ Plans**:
   - Show plans: **"Enterprise Cloud Annual"** and **"Pro Monthly"**.
   - Point out the policy switches: `Auto Close`, `Closable`, `Pausable`, `Renewable`.
4. Navigate to **Catalog $\rightarrow$ Discounts**:
   - Show the active coupon **"WELCOME20"** (20% off) with an atomic usage limit (`usedCount < usageLimit`) and the visual consumption progress bar.

#### Spoken Narrative:
> *"Switching to our Administrator workspace. RevenIQ's catalog architecture supports multi-dimensional pricing. Products feature attribute variants with dynamic price deltas—for example, selecting the Odoo brand adds $560.00. Our plans govern contract behavior via explicit policy switches: pausable, closable, renewable, and autoClose. Discounts can be product-scoped or subscription-scoped, backed by atomic usage limit counters that prevent race conditions."*

---

### Segment 3: Quotation from Template & Lifecycle Activation (0:45 - 1:15)
**Screen**: [http://localhost:5173/subscriptions](http://localhost:5173/subscriptions)  
**Persona**: Staff / Account Executive

#### Actions:
1. Navigate to **Subscriptions** and click **"Create from Template"**.
2. Choose the pre-configured **"Enterprise Cloud Suite"** template.
3. Select customer **"Acme Corp"** (`customer@reveniq.test`).
4. Review the auto-populated quotation:
   - Line items with variants, quantities, unit prices, and snapshotted taxes (`GST 18%`).
   - Live calculated subtotal, discounts, and tax total.
5. Step through the visual status stepper:
   - Click **"Send Quotation"** (`DRAFT` $\rightarrow$ `QUOTATION`).
   - Click **"Confirm Order"** (`QUOTATION` $\rightarrow$ `CONFIRMED`).
   - Click **"Activate Subscription"** (`CONFIRMED` $\rightarrow$ `ACTIVE`).
6. Point out that the engine automatically initialized `nextBillingDate = startDate`.

#### Spoken Narrative:
> *"Sales teams can spin up instant quotations in one click using pre-packaged templates. Line items automatically snapshot product variant prices and regional taxes. Notice our strict state machine: transitions from Draft to Quotation to Confirmed and Active are role-guarded. Upon activation, the recurring billing engine immediately schedules the next billing date based on the plan's period."*

---

### Segment 4: Automated Recurring Billing Run Engine (1:15 - 1:45)
**Screen**: [http://localhost:5173/invoices](http://localhost:5173/invoices)  
**Persona**: Operations / Billing Specialist

#### Actions:
1. Navigate to **Invoices** and click the **"Run Billing Engine"** button.
2. In the modal, click **"Execute Run"** (triggers `POST /api/v1/billing/run`).
3. Point out the execution summary dialog:
   - Invoices created: `1`
   - Subscriptions skipped (already billed): `0`
   - Failures: `0`
4. Click **"Execute Run"** a second time immediately:
   - Invoices created: `0`
   - Invoices skipped: `1`
5. Explain the idempotency guarantee backed by `@@unique([subscriptionId, periodStart])`.
6. Open the newly generated invoice:
   - Show the snapshotted tax breakdown (`InvoiceLine`).
   - Show the applied discount record (`InvoiceDiscount`) with decremented usage.

#### Spoken Narrative:
> *"Here is RevenIQ's automated recurring billing engine. In production, this executes daily at 00:30 UTC via node-cron or on-demand. The engine queries all due active subscriptions, handles multi-period catch-up loops if intervals were missed, and isolates each contract in its own database transaction. Most importantly, it is 100% idempotent: running the job twice never creates duplicates due to database-level unique constraints."*

---

### Segment 5: Invoice Review, Email Dispatch & Payment Settlement (1:45 - 2:10)
**Screen**: [http://localhost:5173/invoices/:id](http://localhost:5173/invoices/:id)  
**Persona**: Finance / Billing Specialist

#### Actions:
1. On the invoice detail page:
   - Click **"Send Invoice"**: displays a toast confirming transactional email transmission with timestamp.
   - Click **"Print Invoice"**: opens a new tab displaying the styled HTML printable invoice (`/invoices/:id/print`) with clean print CSS, company header, and tax breakdown.
2. Return to the invoice detail page and click **"Record Payment"**:
   - Amount: Enter full remaining balance (e.g. `$1,180.00`).
   - Payment Method: Select **"CARD"**.
   - Note: `"Settled via Corporate Visa"`.
3. Click **"Submit Payment"**:
   - Show the instant status change to **"PAID"** (green badge).
   - Show the payment audit ledger at the bottom of the invoice.

#### Spoken Narrative:
> *"Invoices provide complete auditability. We can send itemized summary emails to the customer or render a beautifully styled, print-ready HTML document for accounting. Recording payments utilizes PostgreSQL row-level locks (SELECT ... FOR UPDATE) inside transactions to prevent double-payment races. Partial payments are tracked seamlessly, and once the balance is satisfied, the invoice transitions to PAID automatically."*

---

### Segment 6: Real-time Finance Analytics & MRR Dashboard (2:10 - 2:35)
**Screen**: [http://localhost:5173/reports](http://localhost:5173/reports)  
**Persona**: Chief Financial Officer / Executive

#### Actions:
1. Navigate to **Finance Dashboard** (`/reports`).
2. Point out the live KPI cards:
   - **Active Subscriptions**: `3,635`
   - **Total Revenue Collected**: `$165,050.00`
   - **Outstanding Receivables**: `$329,228.00`
   - **Overdue Invoices**: `847 ($166,260.00)`
   - **Normalized MRR**: `$409,634.50`
3. Hover over the **Monthly Revenue Recharts visualization** showing monthly revenue buckets.
4. Review the **Overdue Invoices table** showing aging balances and customer contact info.
5. Highlight performance: Explain that these metrics are computed using **pure SQL aggregates** in **under 25 milliseconds** across 5,200+ subscriptions.

#### Spoken Narrative:
> *"For executives, RevenIQ delivers instant revenue intelligence. Notice our normalized Monthly Recurring Revenue (MRR), which normalizes daily, weekly, monthly, and yearly cycles. Every metric on this dashboard—from outstanding balances to overdue aging—is computed directly in PostgreSQL using pure SQL aggregates. Even under heavy load with 5,200 subscriptions and 3,900 invoices, the entire query completes in just 23 milliseconds—80 times faster than our 2-second SLA."*

---

### Segment 7: Customer Self-Service Portal & Tenant Isolation (2:35 - 3:00)
**Screen**: [http://localhost:5173/portal/subscriptions](http://localhost:5173/portal/subscriptions)  
**Persona**: Logged-in Customer (`customer@reveniq.test` / `DemoPass123!`)

#### Actions:
1. Log out of the admin account and log in as `customer@reveniq.test`.
2. Notice the customer-specific sidebar navigation:
   - "My Subscriptions"
   - "My Invoices"
3. On **My Subscriptions**:
   - Show active contract.
   - Click **"Pause Subscription"**: succeeds because the associated plan has `pausable = true`.
4. Navigate to **My Invoices**:
   - Show only invoices belonging to Acme Corp.
   - Click an invoice and demonstrate the print view.
5. **Security Isolation Check**: Attempt to navigate to an admin route (e.g. `/users` or `/discounts`):
   - ProtectedRoute intercepts and renders a clean **403 Forbidden** page.
   - Explain that backend queries enforce `customerId = req.user.id`, returning **404 Not Found** if a customer attempts to query another tenant's record.

#### Spoken Narrative:
> *"Finally, our Customer Portal empowers clients with self-service capabilities. Customers can review their contracts and execute policy-permitted actions like pausing or renewing without contacting support. Most importantly, multi-tenant security is strictly enforced on the backend: every customer query filters by user ID, and any attempt to access another customer's invoice or subscription yields a clean 404 Not Found. RevenIQ provides end-to-end security, enterprise reliability, and actionable revenue intelligence."*

---

## Presentation Checklist & Rehearsal Tips

- [ ] **Docker PostgreSQL Running**: Ensure `docker compose ps` shows `subscription_postgres` healthy on port 5432.
- [ ] **Servers Active**: API running on port 4000, Vite Web running on port 5173.
- [ ] **Database Pre-Seeded**: Run `npm run db:seed` and `npx tsx prisma/seed-bulk.ts` prior to demo to have 5,000+ subscriptions ready for the dashboard segment.
- [ ] **Demo Accounts Handy**:
  - Admin: `admin@reveniq.test` / `DemoPass123!`
  - Customer: `customer@reveniq.test` / `DemoPass123!`
- [ ] **Screen Sizing**: Keep browser window at 1920x1080 (or 100% desktop scale) so charts and tables display comfortably without horizontal scrolling.

