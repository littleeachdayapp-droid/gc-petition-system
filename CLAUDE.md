# GC Petition System

UMC General Conference Petition Management System. Handles the full lifecycle of legislative petitions: submission, committee review, plenary calendar, and voting.

## Plan
Full implementation plan is in the project plan document. Work is organized into sessions:
- **Session 1** (DONE): Scaffolding, Prisma schema, seed data, folder structure
- **Session 2** (DONE): Auth (NextAuth.js, role-based access, middleware)
- **Session 3**: Document browser (Book of Discipline / Book of Resolutions)
- **Session 4**: Petition CRUD and submission
- **Session 5**: Admin pipeline and auto-routing
- **Session 6**: Committee workspace
- **Session 7**: Diffing engine (red-line view)
- **Session 8**: Plenary calendar and voting
- **Session 9**: Public portal and search
- **Session 10**: Polish, testing, deployment

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL 16 (via Docker on port 5433)
- **ORM**: Prisma 6 (custom output to `src/generated/prisma`)
- **Auth**: NextAuth.js (Session 2)
- **Styling**: Tailwind CSS 4, shadcn/ui
- **Package manager**: pnpm

## Database

### Local PostgreSQL (Docker)
```bash
# Start (first time or after removal)
docker run --name gc-petition-db -e POSTGRES_PASSWORD=petition -e POSTGRES_DB=gc_petition -p 5433:5432 -d postgres:16

# Start existing container
docker start gc-petition-db

# Stop
docker stop gc-petition-db
```

### Connection
```
DATABASE_URL="postgresql://postgres:petition@localhost:5433/gc_petition"
```

### Commands
```bash
npx prisma db push      # Push schema to DB
npx prisma generate      # Generate client
npx prisma db seed       # Seed data (via prisma.config.ts)
npx tsx prisma/seed.ts   # Run seed directly
npx prisma studio        # Browse data in browser
```

## Seed Data
- 1 conference (2028 General Conference)
- 2 books (Discipline + Resolutions, 2024 editions)
- 18 sections, 134 paragraphs, 39 resolutions
- 15 legislative committees with routing rules
- 7 users (one per role), all with password: `password123`

### Sample User Accounts
| Email | Role |
|---|---|
| superadmin@gc2028.org | SUPER_ADMIN |
| admin@gc2028.org | ADMIN |
| staff@gc2028.org | STAFF |
| chair@gc2028.org | COMMITTEE_CHAIR |
| member@gc2028.org | COMMITTEE_MEMBER |
| delegate@gc2028.org | DELEGATE |
| public@gc2028.org | PUBLIC |

## Key Conventions
- Prisma client singleton: `src/lib/prisma.ts`
- Import Prisma types from `@/generated/prisma/client` in Next.js app code
- Import from `../src/generated/prisma/client.js` in scripts outside Next.js (e.g., seed)
- Add `import "dotenv/config"` in scripts that need env vars (seed, etc.)
- API routes return typed responses (see `src/types/index.ts`)
- Route groups: `(auth)` for login/register, `(dashboard)` for authenticated pages
- Committee routing rules stored as JSON in `Committee.routingRulesJson`

## Auth (Session 2)
- **NextAuth.js v4** with Credentials provider (JWT strategy, no DB sessions)
- Config: `src/lib/auth.ts` (shared `authOptions`)
- Type augmentation: `src/types/next-auth.d.ts` (adds `id` and `role` to session/JWT)
- API: `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/auth/register/route.ts`
- Middleware: `src/middleware.ts` — protects `/dashboard/*`, `/petitions/*`, `/committees/*`, `/calendar/*`, `/admin/*`; redirects unauthed to `/login`; redirects authed away from `/login` and `/register`
- Auth helpers: `src/lib/auth-helpers.ts` — `getCurrentUser()`, `requireRole()`, `requireMinRole()`, `hasMinRole()`, `hasRole()`
- Role hierarchy (lowest→highest): PUBLIC → DELEGATE → COMMITTEE_MEMBER → COMMITTEE_CHAIR → STAFF → ADMIN → SUPER_ADMIN
- Client: `<SessionProvider>` in `src/components/providers.tsx`, wraps root layout
- `<UserNav>` component shows name, role label, sign out button
- Registration creates users with role `PUBLIC`
- Env vars: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`

## Dev Server
```bash
pnpm dev   # http://localhost:3000
```

### Key Endpoints
- `/` — Landing page
- `/dashboard` — Dashboard with nav links
- `/api/health` — DB connection status + seed data counts
