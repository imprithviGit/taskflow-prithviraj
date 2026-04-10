# TaskFlow

A minimal task management system with authentication, projects, and tasks.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.22, chi router, golang-migrate, bcrypt, JWT |
| Database | PostgreSQL 16 |
| Frontend | React 18, TypeScript, Vite, TanStack Query, Tailwind CSS |
| Infrastructure | Docker, docker compose, nginx |

---

## Running Locally

**Prerequisites:** Docker and Docker Compose installed.

```bash
# 1. Clone and enter the repo
git clone <your-repo-url> taskflow-prithviraj
cd taskflow-prithviraj

# 2. Copy env file (defaults work out of the box)
cp .env.example .env

# 3. Start everything
docker compose up --build
```

That's it. Open:
- **Frontend:** http://localhost:3000
- **API:** http://localhost:8080

To stop:
```bash
docker compose down          # keep data
docker compose down -v       # also remove postgres volume
```

---

## Running Migrations

Migrations run **automatically on server startup**. The server uses `golang-migrate` to apply any pending migrations before accepting requests.

To run manually (local dev, with postgres running):
```bash
cd backend
go run ./cmd/api   # runs migrations then starts server
```

---

## Test Credentials

Seed data is created automatically on first startup:

| Field | Value |
|---|---|
| Email | `demo@taskflow.com` |
| Password | `password123` |

The seed creates:
- 1 demo user
- 1 demo project ("Demo Project")
- 3 tasks with varying statuses (todo, in_progress, done)

---

## Architecture Decisions

### Backend

**No ORM.** Using `database/sql` directly with `lib/pq`. For an assignment-scale project, the overhead of an ORM (GORM, sqlx structs everywhere) adds more complexity than it removes. Raw SQL is readable, explicit, and easy to review.

**chi router.** Lightweight, idiomatic Go, composable middleware, and URL params via `chi.URLParam`. No magic.

**Bcrypt cost 12.** The spec requires >= 12. Cost 12 adds ~300ms per hash, which is acceptable for an auth endpoint.

**JWT in Authorization header (Bearer).** Stored in `localStorage` on the frontend. Not httpOnly cookies because this is an SPA assignment, not a server-rendered app. A production app should use httpOnly cookies to prevent XSS token theft.

**Seed in `main.go`.** Rather than a separate binary or migration, seed logic runs at startup and is idempotent (checks if demo user exists first). Simpler, fewer moving parts.

**VARCHAR + CHECK constraints over ENUM types.** PostgreSQL enums are harder to evolve (adding values requires a migration with `ALTER TYPE`). VARCHAR with a CHECK constraint is easier to work with and equally safe.

**Partial update via pointer fields.** `PATCH /tasks/:id` only updates fields explicitly provided. Built with a whitelist of hardcoded column names, so there's no SQL injection risk from the dynamic query.

### Frontend

**TanStack Query for server state.** Handles caching, background refetching, loading/error states, and optimistic updates cleanly. No custom fetch hooks needed.

**Optimistic UI on task updates.** Status and priority changes reflect instantly in the UI; rollback happens automatically if the server returns an error.

**Auth persisted to localStorage.** On page refresh, the stored token and user object are restored from `localStorage`. The Axios interceptor automatically attaches the Bearer token to every request, and redirects to `/login` on 401.

**Vite proxy for local dev.** In development, Vite proxies `/auth`, `/projects`, and `/tasks` to `localhost:8080`, so no CORS issues during development.

**`VITE_API_URL` baked at build time.** Since Vite is a static bundler, the API URL is embedded during `npm run build`. For Docker, it defaults to `http://localhost:8080` which is where the backend is exposed to the browser.

### Infrastructure

**Multi-stage Docker builds.** The Go image produces a ~10MB runtime binary; the final image is `alpine:3.19` with just the binary and migration files. The Node build produces a dist folder served by nginx.

**`depends_on` with health check.** The backend service waits for postgres to pass its health check before starting. Additionally, the backend retries the DB connection up to 10 times with backoff, so startup ordering is resilient.

**Single `docker compose up` workflow.** Migrations, seeding, and server startup all happen automatically in the backend container.

---

## API Reference

### Auth

```
POST /auth/register
Body: { "name": "string", "email": "string", "password": "string" }
Returns: { "token": "...", "user": { ... } }

POST /auth/login
Body: { "email": "string", "password": "string" }
Returns: { "token": "...", "user": { ... } }
```

All endpoints below require `Authorization: Bearer <token>`.

### Projects

```
GET    /projects              List all projects for authenticated user
POST   /projects              Create a project  { "name", "description?" }
GET    /projects/:id          Get a project
PATCH  /projects/:id          Update a project  { "name?", "description?" }
DELETE /projects/:id          Delete a project (cascades to tasks)
```

### Tasks

```
GET    /projects/:id/tasks    List tasks  ?status=todo|in_progress|done  ?assignee=<uuid>
POST   /projects/:id/tasks    Create task { "title", "description?", "status?", "priority?", "assignee_id?", "due_date?" }
PATCH  /tasks/:id             Update task (any subset of task fields)
DELETE /tasks/:id             Delete a task
```

### Stats (Bonus)

```
GET    /projects/:id/stats    Task counts by status and priority
Returns: { "total", "todo", "in_progress", "done", "high_priority", "medium_priority", "low_priority" }
```

### HTTP Status Codes

| Scenario | Code |
|---|---|
| Validation error | 400 with `{ "error": "validation failed", "fields": { ... } }` |
| Unauthenticated | 401 |
| Authenticated but not owner | 403 |
| Resource not found | 404 |
| Server error | 500 |

---

## What I'd Do With More Time

1. **Pagination.** `GET /projects/:id/tasks` should support `?page=&limit=` for large projects. The query is already structured to make this easy.

2. **httpOnly cookie auth.** Storing JWT in `localStorage` is convenient but exposes it to XSS. A production app should use `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict`.

3. **Assignee UX.** The data model supports `assignee_id`, but the frontend currently only shows/edits the assignee UUID. A proper implementation would fetch project members and show a dropdown of names.

4. **Integration tests.** The handlers are designed to be testable (stores are injected), but I didn't write tests due to time constraints. At minimum: register -> login -> create project -> create task -> patch task -> delete.

5. **Refresh tokens.** 24-hour JWT expiry means users get logged out mid-session. A refresh token flow (or sliding expiry) would fix this.

6. **Real-time updates via WebSocket/SSE.** If multiple users share a project, they'd see stale data. SSE would let the server push task updates to all connected clients.

7. **Rate limiting.** The auth endpoints have no rate limiting; a real deployment would need this to prevent brute-force attacks.
