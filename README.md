# RevenIQ : Revenue Intelligence and Subscription Management

Unified platform for subscriptions, quotations, automated recurring invoicing, taxes, discounts, payments, a customer portal, and finance dashboard.

## Architecture

- **Monorepo**: npm workspaces with `apps/api` and `apps/web`
- **API**: Node 20, TypeScript, Express, Prisma (PostgreSQL), Zod validation, JWT in httpOnly cookie
- **Web**: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, React Router, TanStack Query

## Setup & Running

1. **Start database:**
   ```bash
   docker compose up -d
   ```

2. **Environment configuration:**
   Copy `env.example` to `.env` (configured for default local docker setup).

3. **Database migrations:**
   ```bash
   npm run db:migrate
   ```

4. **Run dev servers:**
   ```bash
   npm run dev
   ```

