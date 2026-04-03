# Inventrix Architecture Analysis

## 1. Current System Components

### API Server (`packages/api`)

| Component | File | Responsibility |
|---|---|---|
| Express Entry Point | `src/index.ts` | Bootstraps Express app, registers middleware (CORS, JSON parser), mounts route handlers, serves static images from `/public/images` |
| Database Module | `src/db.ts` | Initializes SQLite via `better-sqlite3`, creates tables, seeds default admin/customer users and 24 products |
| Auth Middleware | `src/middleware/auth.ts` | JWT token generation, verification, role-based access control (`authenticate`, `requireAdmin`) |
| Auth Routes | `src/routes/auth.ts` | `POST /api/auth/login`, `POST /api/auth/register` — credential validation with bcrypt |
| Product Routes | `src/routes/products.ts` | CRUD for products, AI image generation via Bedrock (`POST /api/products/generate-image`) |
| Order Routes | `src/routes/orders.ts` | Order placement with GST calculation, order listing, status updates |
| Analytics Routes | `src/routes/analytics.ts` | Admin dashboard (revenue, top products, order stats) and inventory report |
| Image Generator | `src/services/imageGenerator.ts` | Calls AWS Bedrock (Nova Canvas) to generate product images, writes to local filesystem |

### Frontend (`packages/frontend`)

| Component | Responsibility |
|---|---|
| React SPA (Vite) | Product storefront, order management, admin dashboard, inventory management |
| AuthContext | JWT token storage, login/register flows, hardcoded `/api/` prefix for all API calls |

### Infrastructure (Current)

- Single EC2 instance with manual shell-script deployment (`deploy.sh`)
- SQLite file database (`inventrix.db`) on local disk
- Product images served from local filesystem (`/public/images/`)
- No load balancer, no container orchestration, no managed database

---

## 2. Identified Security Issues and Risks

### Critical

| # | Issue | Location | Risk |
|---|---|---|---|
| S1 | **Hardcoded JWT secret with insecure fallback** | `middleware/auth.ts:4` — `'inventrix-secret-key-change-in-production'` | Any attacker who reads the source code can forge valid JWT tokens for any user including admin |
| S2 | **Hardcoded default passwords in seed data** | `db.ts:50-51` — `'admin123'`, `'customer123'` | Default credentials provide immediate admin access to any deployment |
| S3 | **Wildcard CORS (`cors()` with no config)** | `index.ts:17` — `app.use(cors())` | Any origin can make authenticated API requests, enabling CSRF-like attacks |
| S4 | **No input validation on any endpoint** | All route files | SQL injection risk (mitigated by parameterized queries), but no protection against malformed data, negative prices, or type coercion attacks |
| S5 | **No rate limiting** | All public endpoints | Brute-force attacks on login, credential stuffing, and API abuse are unrestricted |

### High

| # | Issue | Location | Risk |
|---|---|---|---|
| S6 | **Non-transactional order processing** | `routes/orders.ts:43-63` | Race condition: concurrent orders can oversell stock. Partial failures leave inconsistent state (order created but stock not decremented, or vice versa) |
| S7 | **PII exposure in potential logs** | All files use `console.log` | No log filtering — user emails, names, and request bodies with passwords could appear in logs |
| S8 | **No HTTPS enforcement** | `index.ts` — plain HTTP on port 3000 | Data in transit (including JWT tokens and passwords) is unencrypted |
| S9 | **Static images served from filesystem** | `index.ts:18`, `imageGenerator.ts:30-35` | Images lost on redeployment, no access control, directory traversal risk |
| S10 | **JWT tokens never expire meaningfully** | `auth.ts` — hardcoded `7d` expiry, no refresh mechanism | Stolen tokens remain valid for a week with no revocation capability |

### Medium

| # | Issue | Location | Risk |
|---|---|---|---|
| S11 | **No centralized error handling** | All route files — inline try/catch or none | Internal error details (stack traces, DB errors) may leak to clients |
| S12 | **SQLite in production** | `db.ts` | No concurrent write support, no persistence across deployments, no backup/restore, single point of failure |
| S13 | **No health check endpoint** | Not implemented | No way for load balancers or orchestrators to detect unhealthy instances |
| S14 | **No audit trail for inventory changes** | `routes/orders.ts`, `routes/products.ts` | Stock mutations are untraceable — no record of who changed what and when |

---

## 3. Data Flow

### Current Data Flow

```
Browser (React SPA)
    |
    | HTTP (unencrypted, any origin allowed)
    v
Express API (single process, port 3000)
    |
    |--- SQLite file (inventrix.db) on local disk
    |       - users, products, orders, order_items
    |       - No connection pooling, no transactions on orders
    |
    |--- Local filesystem (/public/images/)
    |       - Product images written by Bedrock integration
    |       - Served as static files
    |
    |--- AWS Bedrock (HTTPS)
            - Image generation (Nova Canvas)
```

### Proposed Data Flow

```
Browser (React SPA on S3 + CloudFront)
    |
    | HTTPS only (TLS terminated at ALB)
    v
Application Load Balancer (port 443, cert from ACM)
    |
    | HTTP (internal VPC traffic)
    v
ECS Fargate (Express container, non-root)
    |
    |--- RDS PostgreSQL (credentials from Secrets Manager)
    |       - users, products, orders, order_items, audit_trail
    |       - Connection pooling via pg.Pool
    |       - Transactional order processing with row-level locking
    |
    |--- S3 (private bucket, least-privilege IAM)
    |       - Product images via PutObject
    |       - Pre-signed GetObject URLs for frontend
    |
    |--- SQS + Dead-Letter Queue
    |       - Async events (order notifications, image gen)
    |       - Failed messages captured in DLQ (14-day retention)
    |       - CloudWatch metric on DLQ sends
    |
    |--- AWS Secrets Manager
    |       - JWT signing secret
    |       - Database credentials
    |
    |--- AWS Bedrock (HTTPS)
    |       - Image generation (Nova Canvas)
    |
    |--- CloudWatch Logs
            - Structured JSON logs via pino
            - No PII in log output
```

---

## 4. Authentication Gaps and Proposed Solution

### Current Gaps

| Gap | Detail |
|---|---|
| Hardcoded secret | JWT signed with `'inventrix-secret-key-change-in-production'` fallback — effectively a public key |
| No secret rotation | Secret is a static string in source code, never rotated |
| Fixed token expiry | Hardcoded `7d` — not configurable per environment |
| No input validation on auth endpoints | Login and register accept any payload shape without validation |
| PII in auth logs | Auth failures could log email/password via `console.log` |
| No rate limiting on auth | Unlimited login attempts enable brute-force attacks |
| No HTTPS | Tokens transmitted in plaintext over HTTP |

### Proposed Solution

| Fix | Implementation |
|---|---|
| Secrets Manager integration | New `config/secrets.ts` retrieves JWT secret from AWS Secrets Manager at startup. App refuses to start if secret unavailable. |
| Configurable token expiry | Expiry duration read from `AppConfig`, not hardcoded |
| Zod validation on auth routes | `loginSchema` (email + password) and `registerSchema` (email + password min 6 + name) validate all input before processing |
| Structured logging without PII | pino logger with explicit field filtering — passwords, tokens, and emails excluded from all log entries |
| Rate limiting | `authLimiter` (20 req/15 min) on login and register endpoints |
| HTTPS enforcement | ALB listens on 443 with ACM certificate, redirects port 80 → 443 |
| Remove hardcoded passwords | Seed data removed from production builds; admin user provisioned via secure onboarding flow |

---

## 5. Prioritized Remediation Plan

### Phase 1 — Critical Security (Tasks 1-3)

| Priority | Action | Addresses |
|---|---|---|
| P0 | Create AppError class, structured logger (pino), Secrets Manager client, app config module | S1, S2, S7, S11 |
| P0 | Implement error handler middleware, request logger, Zod validation middleware, rate limiter | S4, S5, S7, S11 |
| P0 | Define Zod schemas for all API domains (auth, products, orders) | S4 |

### Phase 2 — Data Layer (Tasks 4-6)

| Priority | Action | Addresses |
|---|---|---|
| P1 | Migrate database from SQLite to PostgreSQL with idempotent migrations | S12 |
| P1 | Create audit trail service for inventory mutations | S14 |
| P1 | Harden auth middleware — remove hardcoded secret, configurable expiry, no PII in logs | S1, S10 |

### Phase 3 — Route Migration (Tasks 7-11)

| Priority | Action | Addresses |
|---|---|---|
| P1 | Migrate auth routes — pg queries, Zod validation, AppError | S4 |
| P1 | Migrate product routes — S3 integration replacing local filesystem | S9 |
| P1 | Migrate order routes — transactional processing with row-level locking | S6 |
| P2 | Migrate analytics routes — pg queries | S12 |
| P2 | Add health check endpoint (`GET /health`) | S13 |

### Phase 4 — Async & Integration (Task 12)

| Priority | Action | Addresses |
|---|---|---|
| P2 | Implement SQS integration with dead-letter queue | Operational resilience |

### Phase 5 — Wiring & Deployment (Tasks 13-16)

| Priority | Action | Addresses |
|---|---|---|
| P1 | Rewrite entry point — async startup, restricted CORS, remove static serving | S3, S8 |
| P2 | Update frontend for environment-based API URL | Deployment flexibility |
| P1 | Create multi-stage Dockerfile for ECS Fargate (non-root user) | S8, S12 |
| P2 | Backward compatibility and integration tests | Regression prevention |

---

## Summary

The Inventrix application has 14 identified security and architectural issues ranging from critical (hardcoded JWT secret, wildcard CORS, no input validation) to medium (no health checks, no audit trail). The modernization plan addresses all issues across 18 implementation tasks organized in dependency order, targeting ECS Fargate + RDS + S3 + SQS architecture with structured logging, centralized error handling, and comprehensive input validation.
