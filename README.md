# Moneta — Smart Expense Tracker

A responsive personal-finance web application built with React, Node.js/Express, and MongoDB (with MySQL support). It includes JWT-backed accounts, income and expense tracking, monthly category budgets, interactive analytics, reports with CSV export, savings goals, and light/dark theme.

## Prerequisites

- Node.js 20 or later and npm
- **MongoDB** (running locally on port 27017 or a MongoDB Atlas URI) *OR* MySQL 8.0

---

## Running with MongoDB (Recommended & Pre-configured)

1. Ensure MongoDB service is running (e.g., local MongoDB on `mongodb://127.0.0.1:27017`).
2. Verify `server/.env`:
   ```env
   PORT=4000
   CLIENT_ORIGIN=http://localhost:5173
   JWT_SECRET=moneta_smart_expense_tracker_secure_jwt_secret_token_key_2026
   MONGODB_URI=mongodb://127.0.0.1:27017/smart_expense_tracker
   ```
3. Start both backend and frontend from the project root:
   ```sh
   npm run dev
   ```
   *(Default categories are seeded automatically into MongoDB on the first run!)*

4. Open [http://localhost:5173](http://localhost:5173), create an account, and start managing your money.

---

## Running with MySQL (Alternative)

1. Create the MySQL database and schema:
   ```sh
   mysql -u root -p < database/schema.sql
   ```
2. In `server/package.json`, run `npm run dev:mysql --workspace=server` or set `npm run dev:mysql`.

---

## API Overview

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/dashboard`, `GET /api/categories`
- `GET/POST /api/transactions`, `PUT/DELETE /api/transactions/:id`
- `GET/POST /api/budgets`, `DELETE /api/budgets/:id`
- `GET/POST /api/goals`, `PUT/DELETE /api/goals/:id`
- `GET /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD`

All finance endpoints require the HttpOnly `moneta_session` cookie set upon sign in. All reads and writes remain strictly scoped to the authenticated user.
