# Database migrations and seeders

This folder contains Sequelize CLI migrations and seeders for the Company Miner backend.

## Prerequisites

- MySQL server running
- Database `company_miner_db` created: `CREATE DATABASE company_miner_db;`
- `.env` configured with `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

## Migrations

Migrations run in filename order. They create and update table schema.

| Migration | Description |
|-----------|-------------|
| `20250101000000-create-users.js` | Creates `users` table (id, email, password, first_name, last_name, role, is_active, timestamps). Indexes on email (unique), role. |
| `20250101000001-create-master-services.js` | Creates `master_services` table (id, name, description, sort_order, is_active, timestamps). Indexes on is_active, sort_order. |

### Commands

```bash
# Run all pending migrations
npm run migrate

# Undo the last migration
npm run migrate:undo
```

## Seeders

Seeders run in filename order. They insert initial or reference data.

| Seeder | Description |
|--------|-------------|
| `20250101000001-seed-master-services.js` | Inserts 8 default master services (Digital Engineering, Customer Experience, AI/Data, Cloud, Cybersecurity, etc.). |
| `20250101000002-seed-admin-user.js` | Inserts one admin user. Email/password from env: `SEED_ADMIN_EMAIL` (default `admin@companyminer.local`), `SEED_ADMIN_PASSWORD` (default `Admin@123`). |

### Commands

```bash
# Run all seeders
npm run seed

# Undo all seeders (in reverse order)
npm run seed:undo
```

## Full setup

From project root:

```bash
npm install
cp .env.example .env
# Edit .env with your DB and JWT settings
npm run migrate
npm run seed
npm run dev
```

Or use the combined script (migrate + seed):

```bash
npm run db:setup
```
