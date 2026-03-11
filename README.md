# Company Miner Backend

Enterprise-grade API for the Company Miner product: mine company data from URLs and manage master services.

## Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js + TypeScript
- **Database:** MySQL + Sequelize ORM
- **Auth:** JWT (access + refresh)
- **Validation:** Zod
- **Security:** Helmet, CORS, rate limiting, input validation

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment**
   - Copy `.env.example` to `.env`
   - Set `DB_*`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `OPENAI_API_KEY`, `CORS_ORIGIN`

3. **Database**
   - Create MySQL database: `CREATE DATABASE company_miner_db;`
   - Run migrations: `npm run migrate` (creates `users`, `master_services`)
   - Seed data: `npm run seed` (master services + admin user), or run both: `npm run db:setup`
   - Default admin (after seed): email `admin@companyminer.local`, password `Admin@123` (override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env`)
   - See [src/database/README.md](src/database/README.md) for migration and seeder details.

4. **Run**
   - Development: `npm run dev`
   - Production: `npm run build && npm start`

## API

- **Base:** `http://localhost:3000/api/v1`
- **Health:** `GET /api/v1/health` — JSON with API + DB status (200 when healthy, 503 when DB unreachable)
- **Auth:** `POST /auth/register`, `POST /auth/login`, `GET /auth/profile` (Bearer)
- **Company Miner:** `POST /admin/company-miner` (body: `{ \"url\": \"https://example.com\" }`) — requires auth
- **Master Services:** `GET/POST/PUT/DELETE /admin/master-services` — requires admin

## Database migrations and seeders

| Script | Description |
|--------|-------------|
| `npm run migrate` | Run all pending migrations (users, master_services tables). |
| `npm run migrate:undo` | Undo the last migration. |
| `npm run seed` | Run all seeders (8 master services + 1 admin user). |
| `npm run seed:undo` | Undo all seeders. |
| `npm run db:setup` | Run `migrate` then `seed`. |

Migrations live in `src/database/migrations/`, seeders in `src/database/seeders/`. Full list and table descriptions: [src/database/README.md](src/database/README.md).

## Project structure

- `src/config` — app and DB config
- `src/database` — migrations (`migrations/`), seeders (`seeders/`), [README](src/database/README.md)
- `src/models` — Sequelize models (User, MasterService)
- `src/repositories` — data access
- `src/services` — business logic (auth, admin, tools/CompanyMiner)
- `src/controllers` — HTTP handlers
- `src/middleware` — auth, validation, errors, rate limit
- `src/routes` — route definitions
- `src/utils` — response, logger, jwt, errors, password
