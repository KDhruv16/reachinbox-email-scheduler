# ReachInbox Full-Stack Email Job Scheduler

A production-quality, distributed Email Job Scheduler built for the ReachInbox Software Development Intern Hiring Assignment. Built with a modern, high-throughput tech stack featuring persistent BullMQ delayed queues, Redis-backed atomic per-sender rate limiting, Nodemailer with live Ethereal SMTP test previews, Elasticsearch full-text search with database fallback, Google & Slack OAuth 2.0 integrations, and a clean, responsive ReachInbox-style SaaS dashboard.

---

## 🏛️ Architecture Overview

```mermaid
flowchart TD
    subgraph Client ["Frontend (React + Vite + Tailwind CSS)"]
        UI[User Dashboard & Compose Modal]
        AuthUI[Google OAuth & Dev Login]
        MonitoringUI[Embedded Bull Board Queue Viewer]
    end

    subgraph API ["Backend API (Node.js + Express + TypeScript)"]
        Router[Express Router & Auth Middleware]
        EmailService[Email Scheduling Service & Idempotency Engine]
        RateLimiter[Redis Atomic Rate Limiter]
        ESService[Elasticsearch Service & Fallback]
    end

    subgraph Storage ["Data & Messaging Layer"]
        PG[(PostgreSQL Database\nUsers & EmailJob Records)]
        Redis[(Redis Key-Value & BullMQ Queue Storage)]
        ES[(Elasticsearch Cluster\nemail_records Index)]
    end

    subgraph Processing ["Worker Layer (BullMQ Worker)"]
        Worker[BullMQ Multi-threaded Worker\nConcurrency: 5]
        Nodemailer[Nodemailer Transport Engine]
    end

    subgraph External ["External Services"]
        Ethereal[Ethereal SMTP Sandbox & Web Previews]
        Slack[Slack Web API & OAuth]
        Google[Google Identity Services OAuth 2.0]
    end

    UI --> Router
    Router --> EmailService
    EmailService --> PG
    EmailService --> Redis
    EmailService --> ESService
    ESService --> ES

    Redis --> Worker
    Worker --> RateLimiter
    RateLimiter --> Redis
    Worker --> PG
    Worker --> Nodemailer
    Nodemailer --> Ethereal
    Worker --> ESService
    RateLimiter -.->|Limit Exceeded Alert| Slack
    AuthUI -.-> Google
```

---

## 🚀 Key Features

### 1. Robust Distributed Scheduling (BullMQ & Redis)
- **Persistent Delayed Jobs**: Scheduled emails are persisted as delayed jobs in Redis via BullMQ. Even if the API server or worker process crashes or reboots, jobs survive and execute at their designated timestamp.
- **Idempotency Guarantee**: Unique content-and-timestamp hash keys (`generateIdempotencyKey`) ensure that the same batch or recipient cannot be enqueued or scheduled twice.
- **Worker Crash Safety**: Failed jobs automatically leverage BullMQ exponential backoff (`attempts: 3`, initial delay `2000ms`). Statuses in PostgreSQL are updated atomically.

### 2. Concurrency-Safe Sender Rate Limiting
- **Atomic Redis Lua Scripting**: Enforces strict hourly limits per sender without race conditions across multiple worker instances.
- **No Lost Dispatches (Auto-Rescheduling)**: When a sender reaches their hourly limit (e.g. 100 emails/hour), jobs are **never dropped or marked failed**. Instead, the worker calculates the exact milliseconds until the start of the next hour window and reschedules the job with delay, updating the database status to `DELAYED`.
- **Deduplicated Slack Alerts**: When a sender hits their limit, an alert is sent via the Slack Web API, with a 1-hour Redis deduplication lock to avoid spamming the channel.

### 3. Nodemailer & Ethereal SMTP with Live Web Previews
- **Zero-Config Persistent Testing**: Ethereal test account credentials are automatically saved in `backend/.ethereal-account.json` across server and worker restarts, ensuring all test messages stay grouped under one persistent mailbox.
- **Strict Verification Before Mark-as-Sent**: Emails are never marked as `SENT` before Nodemailer and the SMTP socket confirm delivery. On success, the real SMTP `messageId` and Ethereal `previewUrl` are saved in PostgreSQL.
- **Live Rendered Email Links & Drawer**: After dispatch, `previewUrl` is displayed in the frontend as both a clickable badge and inside an interactive slide-over Email Detail Drawer.

### 4. Elasticsearch with Graceful Database Fallback
- Indexes subject, body, recipient, sender, and status into `email_records`.
- If Elasticsearch is unavailable or under heavy load, searches seamlessly fall back to PostgreSQL `ILIKE` queries without crashing or degrading user experience.
- Includes a reindexing endpoint (`POST /api/emails/reindex`) to sync all PostgreSQL records into Elasticsearch on demand.

### 5. Bull Board Real-Time Queue Monitoring
- Embedded directly into the frontend at `/monitoring` and accessible at `http://localhost:5000/admin/queues`.
- Real-time visibility into Waiting, Delayed, Active, Completed, and Failed job states with retry triggers.

### 6. Authentication & Local Dev Evaluation
- **Google OAuth 2.0**: Production-ready OAuth code exchange with profile sync and secure HTTP-only cookie JWT tokens.
- **Dev Mode Bypass**: Includes an "Instant Demo Login" button to evaluate the full application immediately without waiting to register Google Cloud console credentials.

### 7. Premium SaaS UI Redesign (Linear & Resend Aesthetic)
- **ReachInbox / Linear Aesthetic**: Built with clean neutral surfaces, dark navy typography, subtle borders, and smooth transitions.
- **Slide-over Email Detail Drawer**: Inspect HTML body, raw text, recipient details, message ID, Ethereal preview links, and cancellation controls.
- **Interactive Drag & Drop File Upload**: Supports `.csv` and `.txt` files with recipient chip count preview, chip cloud with single-click removal, and preset templates.
- **Engine Live Badges & Quick Stats**: Real-time stats cards with scheduled, sent, and delayed counts, plus auto-refreshing dashboard polling.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, React Router v6, Axios, Lucide React |
| **Backend** | Node.js (v22), Express, TypeScript, Prisma ORM |
| **Databases** | PostgreSQL 16 (Relational DB), Redis 7 (Queues & Rate Limiting), Elasticsearch 8.13 (Search) |
| **Queue & Worker** | BullMQ, @bull-board/express, @bull-board/api |
| **Integrations** | Nodemailer (Ethereal SMTP), Slack Web API (`@slack/web-api`), Google OAuth 2.0 |

---

## 📂 Project Structure

```
.
├── backend/
│   ├── prisma/
│   │   └── schema.prisma           # Prisma schema (User & EmailJob models)
│   ├── src/
│   │   ├── config/                 # Environment, Redis, and Elasticsearch configs
│   │   ├── lib/                    # Prisma client, Nodemailer mailer, Slack API client
│   │   ├── middleware/             # Auth middleware (JWT + dev bypass) & error handling
│   │   ├── queues/                 # BullMQ email queue definition & Bull Board adapter
│   │   ├── routes/                 # Auth, Email, Slack, and Health check routes
│   │   ├── services/               # Scheduling, rate limiting & Elasticsearch sync
│   │   ├── worker.ts               # BullMQ worker process with concurrency control
│   │   ├── app.ts                  # Express application setup & middleware
│   │   └── server.ts               # Bootstrap script (API + Worker)
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── api/                    # Axios API client
│   │   ├── components/             # Navbar, Sidebar, EmailTable, ComposeModal, StatCards
│   │   ├── context/                # AuthContext (Google OAuth & Demo Login)
│   │   ├── pages/                  # Login, Dashboard, Scheduled, Sent, Integrations, Monitoring
│   │   ├── types/                  # TypeScript interface definitions
│   │   ├── App.tsx                 # App router & layouts
│   │   ├── main.tsx                # Entry point
│   │   └── index.css               # Tailwind CSS directives
│   ├── .env.example
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── docker-compose.yml              # PostgreSQL, Redis & Elasticsearch services
├── .gitignore
└── README.md
```

---

## ⚙️ Environment Variables

### Backend Configuration (`backend/.env`)

```env
# Database Configuration
DATABASE_URL="postgresql://reachinbox:reachinbox_password@localhost:5432/reachinbox_scheduler?schema=public"

# Redis Configuration
REDIS_HOST="127.0.0.1"
REDIS_PORT=6379
REDIS_PASSWORD=""

# Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_CALLBACK_URL="http://localhost:5000/api/auth/google/callback"

# JWT Secret for Session Auth
JWT_SECRET="super-secret-reachinbox-jwt-token-key-change-in-production"

# Ethereal SMTP Settings (leave empty to auto-generate testing account)
ETHEREAL_HOST="smtp.ethereal.email"
ETHEREAL_PORT=587
ETHEREAL_USER=""
ETHEREAL_PASS=""

# Elasticsearch Configuration
ELASTICSEARCH_URL="http://localhost:9200"

# Slack OAuth Integration
SLACK_CLIENT_ID=""
SLACK_CLIENT_SECRET=""
SLACK_REDIRECT_URI="http://localhost:5000/api/slack/callback"

# Rate Limiting & Concurrency Settings
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=100
WORKER_CONCURRENCY=5

# App Ports & URLs
PORT=5000
FRONTEND_URL="http://localhost:5173"

# Dev Mode Bypass (Allows 1-click test login if Google OAuth credentials not yet added)
DEV_AUTH_BYPASS=true
```

### Frontend Configuration (`frontend/.env`)

```env
VITE_API_BASE_URL="http://localhost:5000"
```

---

## 🏃 Running the Application

### 1. Start Infrastructure via Docker Compose
Ensure Docker Desktop or daemon is running, then run:
```bash
docker compose up -d
```
This boots:
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`
- Elasticsearch on `localhost:9200`

### 2. Setup and Run Backend
```bash
cd backend

# Install dependencies
npm install

# Push database schema to PostgreSQL
npm run prisma:push

# Start API Server & Worker
npm run dev
```
To run the BullMQ worker as an independent, standalone process:
```bash
npm run worker
```

### 3. Setup and Run Frontend
```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

---

## 🌐 Application URLs & Endpoints

| Service | URL | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | `http://localhost:5173` | Modern ReachInbox Campaign Dashboard |
| **Backend API** | `http://localhost:5000` | REST API & OAuth Handlers |
| **Health Probe** | `http://localhost:5000/api/health` | PostgreSQL, Redis & ES Health Status |
| **Bull Board** | `http://localhost:5000/admin/queues` | Live Queue Management Dashboard |

### Complete REST API Reference:
- `GET /api/health` — Service connectivity health check (PostgreSQL, Redis, Elasticsearch, BullMQ)
- `POST /api/auth/dev-login` — Instant developer demo authentication
- `GET /api/auth/me` — Authenticated user profile and session validation
- `GET /api/auth/google` — Initiate Google OAuth 2.0 redirection flow
- `GET /api/auth/google/callback` — Google OAuth code exchange and JWT issuance
- `POST /api/auth/logout` — Clear session cookies and invalidate token
- `POST /api/emails/schedule` — Schedule an email campaign with batch idempotency and custom pacing
- `GET /api/emails/scheduled` — Retrieve paginated scheduled/delayed emails with optional search & filter
- `GET /api/emails/sent` — Retrieve paginated sent/failed emails with SMTP message IDs and preview URLs
- `GET /api/emails/:id` — Get single email record details
- `DELETE /api/emails/:id` — Cancel a scheduled email and remove it from the BullMQ delayed queue
- `GET /api/emails/search?q=...` — Fuzzy search across emails using Elasticsearch (with DB fallback)
- `GET /api/emails/stats` — Real-time campaign stats (total scheduled, sent, delayed, failed)
- `GET /api/emails/smtp-info` — Inspect active Ethereal SMTP account credentials and mailbox link
- `POST /api/emails/reindex` — Sync all database records into Elasticsearch
- `GET /api/slack/connect` — Initiate Slack OAuth authorization flow
- `GET /api/slack/callback` — Slack OAuth callback and secure user token storage
- `POST /api/slack/disconnect` — Disconnect Slack integration
- `GET /admin/queues` — Protected Bull Board dashboard

---

## 🧪 Automated End-to-End Verification

Two dedicated verification scripts are provided in the repository:

```bash
# 1. Run Complete End-to-End Test (Health, Auth, SMTP, Idempotency, Worker Dispatch, ES Search, Bull Board)
node backend/test-flow.js

# 2. Run Atomic Rate Limiter Reschedule Test (Verifies automatic rescheduling into next hour window)
node backend/test-rate-limit.js
```

1. **API Health Check**: Returned `status: "ok"` with `database: "connected"`, `redis: "connected"`, and `elasticsearch: "connected"`.
2. **Authentication Flow**: Evaluated dev authentication, session JWT cookie generation, and `/api/auth/me`.
3. **Email Scheduling & Parsing**: Scheduled multi-recipient email batch with custom delays and CSV extraction.
4. **Idempotency Prevention**: Resubmitted identical payload and verified duplicate requests are skipped without duplicate database records or queue entries.
5. **Worker Execution**: Worker picked up scheduled jobs, dispatched via Nodemailer, recorded sent timestamps, and persisted live Ethereal preview links.
6. **Rate Limiting & Rescheduling**: Tested with `hourlyLimit: 1`; first email sent immediately, and second email was rescheduled to the next hour (`status: "DELAYED"`).
7. **Crash / Restart Recovery**: Scheduled a delayed job, killed the server process, restarted it, and verified the delayed job remained in Redis/BullMQ and executed when due.
8. **Elasticsearch Search**: Verified multi-field fuzzy query searching across recipients, subjects, and email bodies.
9. **Bull Board**: Verified HTML dashboard rendering and job visualization on `/admin/queues`.

---

## 🔒 External OAuth Setup Guide

### Google OAuth 2.0
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (Web Application).
3. Set **Authorized redirect URIs** to `http://localhost:5000/api/auth/google/callback`.
4. Copy `Client ID` and `Client Secret` into `backend/.env` under `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### Slack OAuth Integration
1. Navigate to the [Slack API Apps Console](https://api.slack.com/apps).
2. Create a New App ("From scratch").
3. Under **OAuth & Permissions**, add Redirect URL: `http://localhost:5000/api/slack/callback`.
4. Add Bot Token Scopes: `chat:write`, `channels:read`, `incoming-webhook`.
5. Copy `Client ID` and `Client Secret` into `backend/.env` under `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`.

---

## 💡 Trade-Offs & Architectural Decisions

- **In-Process vs Independent Worker**: The backend bootstrap launches the worker inside the server for seamless developer onboarding, but provides a fully decoupled `npm run worker` script for separate horizontal scaling in production.
- **Rescheduling vs Dropping**: To protect sender domain reputation, rate-limited emails are not discarded or failed; they are delayed to the top of the next hour window (`getMsUntilNextHour`).
- **Elasticsearch Graceful Degradation**: Production clusters can occasionally drop connections during rolling updates; implementing a transparent PostgreSQL `ILIKE` fallback ensures user searches never break.
