# Digital Draw System — Backend API

Node.js + Express + PostgreSQL backend for the Digital Token-Based Draw System.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Express 4 |
| Language | TypeScript |
| Database | PostgreSQL 15+ |
| Auth | JWT (access + refresh tokens) |
| 2FA | TOTP via `speakeasy` + QR code |
| Email | Nodemailer (SMTP) |
| Security | Helmet, CORS, Rate Limiting, bcrypt |

---

## Project Structure

```
backend/
├── migrations/
│   └── 001_initial_schema.sql      # Full DB schema
├── src/
│   ├── config/
│   │   └── database.ts             # PostgreSQL pool
│   ├── controllers/
│   │   ├── auth.controller.ts      # Register, login, 2FA, JWT
│   │   ├── draw.controller.ts      # Draw CRUD + execution engine
│   │   ├── token.controller.ts     # Token issuance + entry submission
│   │   └── misc.controller.ts      # Winners, notifications, analytics, audit, admin
│   ├── middleware/
│   │   ├── auth.ts                 # JWT + role guard middleware
│   │   ├── error.ts                # Global error handler + AppError
│   │   └── validate.ts             # express-validator middleware
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── draw.routes.ts
│   │   └── index.ts                # Token, winner, notification, analytics, audit, admin
│   ├── services/
│   │   ├── audit.service.ts        # Audit log writer
│   │   ├── email.service.ts        # Nodemailer templates
│   │   └── notification.service.ts # In-app notifications
│   ├── types/
│   │   └── index.ts                # Shared TypeScript interfaces
│   ├── utils/
│   │   └── tokens.ts               # Token code generators
│   ├── migrations/
│   │   └── run.ts                  # Migration runner
│   ├── app.ts                      # Express app + middleware setup
│   └── server.ts                   # Entry point + graceful shutdown
├── .env.example
├── tsconfig.json
└── package.json
```

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your PostgreSQL credentials, JWT secrets, and SMTP settings
```

### 3. Create the database
```bash
psql -U postgres -c "CREATE DATABASE digital_draw_db;"
```

### 4. Run migrations
```bash
npm run migrate
```

### 5. Start dev server
```bash
npm run dev
```

The API will be at `http://localhost:5000/api/v1`.

---

## API Reference

### Authentication — `/api/v1/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Register participant or organizer |
| POST | `/verify-email` | — | Verify email with token |
| POST | `/login` | — | Login, returns JWT pair |
| POST | `/refresh` | — | Rotate access + refresh tokens |
| POST | `/logout` | ✅ | Revoke refresh token |
| POST | `/forgot-password` | — | Send reset email |
| POST | `/reset-password` | — | Set new password |
| POST | `/2fa/setup` | Organizer | Generate TOTP secret + QR |
| POST | `/2fa/verify` | Organizer | Enable 2FA + get backup codes |
| POST | `/2fa/disable` | Organizer | Disable 2FA (requires password) |
| GET | `/me` | ✅ | Get current user profile |
| PATCH | `/me` | ✅ | Update profile |

### Draws — `/api/v1/draws`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Optional | List draws (filtered by role) |
| GET | `/:id` | Optional | Get draw details + prizes |
| POST | `/` | Organizer | Create draw with prizes |
| PATCH | `/:id` | Organizer | Update draw |
| DELETE | `/:id` | Organizer | Soft-delete draw |
| PATCH | `/:id/status` | Organizer | Open / close / cancel draw |
| POST | `/:id/execute` | Organizer | Run weighted random draw |
| GET | `/:id/winners` | Optional | Get draw winners |

### Tokens — `/api/v1/tokens`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/issue` | Organizer | Issue tokens to a participant |
| GET | `/validate/:token_code` | ✅ | Validate a token |
| POST | `/submit-entry` | Participant | Use a token to enter a draw |
| GET | `/draw/:drawId` | Organizer | List all tokens for a draw |
| PATCH | `/:id/revoke` | Organizer | Revoke a token |
| GET | `/my/tokens` | Participant | My tokens |
| GET | `/my/entries` | Participant | My draw entries |

### Winners — `/api/v1/winners`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Organizer | List winners (filter by draw/status) |
| POST | `/:id/claim` | ✅ | Claim a prize (with verification code) |
| PATCH | `/:id/status` | Organizer | Update winner status |

### Notifications — `/api/v1/notifications`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | ✅ | Get my notifications + unread count |
| PATCH | `/:id/read` | ✅ | Mark single notification read |
| PATCH | `/read-all` | ✅ | Mark all as read |

### Analytics — `/api/v1/analytics`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Organizer | Dashboard stats + entry trend (30d) |

### Audit — `/api/v1/audit`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Organizer | Paginated audit log (filterable) |

### Admin — `/api/v1/admin`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/users` | Admin | List all users |
| PATCH | `/users/:id` | Admin | Update user status/role |
| DELETE | `/users/:id` | Admin | Soft-delete user |

---

## Draw Execution Algorithm

1. All **active entries** for the draw are fetched with their token `weight`
2. A **weighted pool** is built — each entry is duplicated `weight` times
3. The pool is **Fisher-Yates shuffled** using `crypto.randomBytes` as entropy source
4. Winners are selected in order, **deduplicated by participant** (one win per person)
5. A **cryptographic seed** (`hex(randomBytes(32))`) is saved on the draw for audit
6. Winners are inserted into the `winners` table with a **verification code** and **30-day claim deadline**
7. All selected participants are **notified in-app**

---

## Frontend Integration

In your Next.js app, set:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

Send the JWT as a Bearer token on all authenticated requests:
```ts
headers: { Authorization: `Bearer ${accessToken}` }
```

Use `/api/v1/auth/refresh` with the `refreshToken` cookie/localStorage value to rotate tokens silently.

---

## Environment Variables

See `.env.example` for the full list. Key variables:

```
DATABASE_URL         — PostgreSQL connection string
JWT_SECRET           — Secret for access tokens (change in prod!)
JWT_REFRESH_SECRET   — Secret for refresh tokens (change in prod!)
SMTP_HOST/USER/PASS  — Email provider credentials
FRONTEND_URL         — CORS allowed origin
```
