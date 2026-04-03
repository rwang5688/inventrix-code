# Implementation Plan: Codebase Modernization

## Overview

Modernize the Inventrix e-commerce API from a single-process SQLite-backed Express server to a production-grade architecture with RDS PostgreSQL, S3, SQS, structured logging, input validation, centralized error handling, and ECS Fargate containerization. All changes preserve existing API routes and response shapes.

## Tasks

- [ ] 1. Set up foundational modules (AppError, Logger, Config)
  - [ ] 1.1 Create `packages/api/src/lib/errors.ts` with the custom `AppError` class containing `statusCode`, `message`, and optional `internalDetail`
    - _Requirements: 4.2_
  - [ ] 1.2 Create `packages/api/src/lib/logger.ts` with pino structured JSON logger, configurable log levels via `LOG_LEVEL` env var, and a `createRequestLogger(correlationId)` child-logger factory
    - _Requirements: 5.1, 5.5_
  - [ ] 1.3 Create `packages/api/src/config/secrets.ts` with `loadSecrets()` that retrieves JWT secret and DB credentials from AWS Secrets Manager, terminates with non-zero exit code on failure
    - _Requirements: 2.1, 2.2, 1.1, 1.3_
  - [ ] 1.4 Create `packages/api/src/config/index.ts` with `buildConfig(secrets)` merging env vars and secrets into a single `AppConfig` object (CORS origin, rate limits, log level, S3 bucket, SQS URLs, token expiry, pre-signed URL expiry)
    - _Requirements: 2.3, 6.1, 7.1_
  - [ ]* 1.5 Write unit tests for AppError, Logger (JSON output, no PII), and config modules
    - Test that Logger outputs valid JSON at all levels
    - Test that AppError carries statusCode and message correctly
    - Test that `loadSecrets()` calls `process.exit(1)` on failure
    - _Requirements: 4.2, 5.1, 5.3, 1.3, 2.2_

- [ ] 2. Implement centralized middleware (error handler, request logger, validation, rate limiter)
  - [ ] 2.1 Create `packages/api/src/middleware/errorHandler.ts` — Express error middleware that distinguishes `AppError` from unexpected errors, returns sanitized JSON (no stack traces, no DB details, no internal paths), logs full details with correlation ID
    - _Requirements: 4.1, 4.3, 4.4, 4.5_
  - [ ] 2.2 Create `packages/api/src/middleware/requestLogger.ts` — generates UUID v4 correlation ID per request, logs method/path on entry and status/duration on response finish, no PII in logs
    - _Requirements: 5.3, 5.4, 4.5_
  - [ ] 2.3 Create `packages/api/src/middleware/validate.ts` — generic Zod validation middleware factory accepting schema and source (`body`, `query`, `params`), strips unknown fields via `.strip()`, returns 400 with structured error list on failure
    - _Requirements: 3.1, 3.2, 3.4_
  - [ ] 2.4 Create `packages/api/src/middleware/rateLimiter.ts` — two pre-configured `express-rate-limit` instances: `authLimiter` (stricter, e.g. 20 req/15 min) and `publicLimiter` (relaxed, e.g. 100 req/15 min), returns 429 with `Retry-After` header, identifies clients by IP
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [ ]* 2.5 Write property test for error handler (Property 2: No Internal Details in Client Error Responses)
    - **Property 2: No Internal Details in Client Error Responses**
    - Generate random error messages, stack traces, and DB errors; verify none leak to client JSON response
    - **Validates: Requirements 1.5, 4.1, 4.3, 4.4**
  - [ ]* 2.6 Write property test for Zod validation middleware (Property 5: Invalid Input Returns Structured 400)
    - **Property 5: Invalid Input Returns Structured 400**
    - Generate random invalid payloads (missing fields, wrong types, negative prices, malformed emails); verify 400 + structured error array
    - **Validates: Requirements 3.2, 3.5**
  - [ ]* 2.7 Write property test for unknown field stripping (Property 6: Unknown Fields Stripped)
    - **Property 6: Unknown Fields Stripped from Validated Payloads**
    - Generate valid payloads with arbitrary extra fields; verify output contains only schema-defined fields
    - **Validates: Requirements 3.4**
  - [ ]* 2.8 Write property test for structured log completeness (Property 7: Structured Log Completeness)
    - **Property 7: Structured Log Completeness**
    - Generate random request contexts; verify log entries contain `method`, `path`, `statusCode`, `responseTimeMs`, and error logs contain `correlationId`
    - **Validates: Requirements 4.5, 5.4**
  - [ ]* 2.9 Write property test for JSON log output (Property 8: Logger Outputs Valid JSON)
    - **Property 8: Logger Outputs Valid JSON**
    - Generate random log messages at all levels; verify each output line is parseable as valid JSON
    - **Validates: Requirements 5.1**
  - [ ]* 2.10 Write property test for PII filtering (Property 4: No PII in Log Output)
    - **Property 4: No PII in Log Output**
    - Generate random requests containing emails, passwords, names, JWT tokens; verify none appear in log output
    - **Validates: Requirements 2.5, 5.3**

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Define Zod schemas for all domains
  - [ ] 4.1 Create `packages/api/src/schemas/auth.schema.ts` with `loginSchema` (email, password) and `registerSchema` (email, password min 6, name)
    - _Requirements: 3.3, 3.5_
  - [ ] 4.2 Create `packages/api/src/schemas/product.schema.ts` with `createProductSchema` and `updateProductSchema` (name, description optional, price positive, stock non-negative integer, image_url optional) and `productIdParamSchema`
    - _Requirements: 3.3, 3.5_
  - [ ] 4.3 Create `packages/api/src/schemas/order.schema.ts` with `createOrderSchema` (items array min 1, each with product_id positive int and quantity positive int) and `updateOrderStatusSchema` (status enum)
    - _Requirements: 3.3, 3.5_

- [ ] 5. Migrate database module from SQLite to PostgreSQL
  - [ ] 5.1 Create `packages/api/src/db/migrations/001_initial.sql` with idempotent DDL for users, products, orders, order_items, and audit_trail tables in PostgreSQL syntax (SERIAL, NUMERIC, TIMESTAMPTZ, CHECK constraints)
    - _Requirements: 1.4, 9.2_
  - [ ] 5.2 Rewrite `packages/api/src/db.ts` — replace `better-sqlite3` with `pg.Pool`, expose `initDb()` (connects pool, runs idempotent migrations), `getPool()`, and `withTransaction(fn)` helper (BEGIN/COMMIT/ROLLBACK). All queries use parameterized syntax only.
    - _Requirements: 1.1, 1.2, 1.4, 1.5_
  - [ ]* 5.3 Write property test for migration idempotence (Property 1: Migration Idempotence)
    - **Property 1: Migration Idempotence**
    - Run migrations N times (N ≥ 1); compare resulting schema to single-run schema
    - **Validates: Requirements 1.4**

- [ ] 6. Create audit trail service
  - [ ] 6.1 Create `packages/api/src/services/auditTrail.ts` with `recordStockChange(client, productId, previousStock, newStock, reason, userId)` that inserts append-only records into audit_trail table within the caller's transaction
    - _Requirements: 9.1, 9.2, 9.3_
  - [ ]* 6.2 Write property test for audit trail completeness (Property 10: Audit Trail Completeness)
    - **Property 10: Audit Trail Completeness for Stock Mutations**
    - Generate random stock mutations; verify audit record contains correct product_id, previous_stock, new_stock, change_reason, user_id. For orders affecting N products, verify exactly N audit records in same transaction.
    - **Validates: Requirements 9.1, 9.2, 9.4**

- [ ] 7. Harden authentication and update auth routes
  - [ ] 7.1 Rewrite `packages/api/src/middleware/auth.ts` — remove hardcoded JWT secret fallback, read secret from config (injected at startup), use configurable token expiry from config, log auth failures via Logger without PII (no password/token in logs)
    - _Requirements: 2.1, 2.3, 2.4, 2.5_
  - [ ] 7.2 Rewrite `packages/api/src/routes/auth.ts` — use `pg` parameterized queries, add Zod validation (`loginSchema`, `registerSchema`), wrap in try/catch throwing `AppError`, use Logger instead of console
    - _Requirements: 1.2, 3.1, 4.1, 14.1, 14.2_
  - [ ]* 7.3 Write property test for JWT token expiry (Property 3: JWT Token Expiry Matches Configuration)
    - **Property 3: JWT Token Expiry Matches Configuration**
    - Generate random valid expiry duration strings; verify JWT `exp` claim matches current time + configured duration
    - **Validates: Requirements 2.3**

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Migrate product routes with S3 integration
  - [ ] 9.1 Rewrite `packages/api/src/services/imageGenerator.ts` — replace local filesystem writes with S3 `PutObject`, return pre-signed `GetObject` URL with configurable expiry, log S3 errors via Logger, throw `AppError` on failure
    - _Requirements: 10.1, 10.2, 10.3, 10.5_
  - [ ] 9.2 Rewrite `packages/api/src/routes/products.ts` — use `pg` parameterized queries, add Zod validation on all endpoints, call `recordStockChange` on product creation and manual stock updates within transactions, apply `publicLimiter` to GET routes, use Logger
    - _Requirements: 1.2, 3.1, 9.1, 14.1, 14.2_
  - [ ]* 9.3 Write property test for pre-signed URL expiry (Property 11: Pre-Signed URL Expiry Matches Configuration)
    - **Property 11: Pre-Signed URL Expiry Matches Configuration**
    - Generate random expiry durations; verify S3 pre-signed URL expiration parameter matches configured duration
    - **Validates: Requirements 10.2**

- [ ] 10. Migrate order routes with transactional processing
  - [ ] 10.1 Rewrite `packages/api/src/routes/orders.ts` — wrap order placement in `withTransaction` with `SELECT ... FOR UPDATE` row-level locking, insert audit trail records per product in same transaction, add Zod validation, use `pg` parameterized queries, log rollbacks via Logger
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 9.1, 9.4, 1.2, 3.1, 14.1, 14.2_
  - [ ]* 10.2 Write property test for order transaction atomicity (Property 13: Order Transaction Atomicity)
    - **Property 13: Order Transaction Atomicity**
    - Generate random orders with injected failures at each step; verify all-or-nothing: either all changes committed or DB state unchanged
    - **Validates: Requirements 15.1, 15.2**
  - [ ]* 10.3 Write property test for concurrent order safety (Property 14: Concurrent Orders Cannot Oversell)
    - **Property 14: Concurrent Orders Cannot Oversell**
    - Generate concurrent order scenarios where total requested quantity exceeds stock; verify final stock ≥ 0 and no overselling
    - **Validates: Requirements 15.3**

- [ ] 11. Migrate analytics routes and add health check
  - [ ] 11.1 Rewrite `packages/api/src/routes/analytics.ts` — use `pg` parameterized queries, use Logger
    - _Requirements: 1.2, 14.1, 14.2_
  - [ ] 11.2 Create `packages/api/src/routes/health.ts` — unauthenticated `GET /health` endpoint, pings DB pool, returns 200 `{"status":"healthy"}` or 503 `{"status":"unhealthy","reason":"database"}`, responds within 5 seconds
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 12. Implement SQS integration with dead-letter queue
  - [ ] 12.1 Create `packages/api/src/services/queue.ts` — publishes async events (order notifications, image generation) to SQS, retries with exponential backoff (3 attempts), routes to DLQ on exhaustion, publishes CloudWatch metric on DLQ send, logs DLQ events with message ID, failure reason, and original queue name
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Wire up application entry point and CORS
  - [ ] 14.1 Rewrite `packages/api/src/index.ts` — async startup: `loadSecrets()` → `buildConfig()` → `initDb()` → register middleware (CORS restricted to configured origin, rate limiters, request logger, JSON parser, routes including `/health`, error handler). Remove `console.log`. Remove static file serving. Exit on secrets/DB failure.
    - _Requirements: 1.1, 2.1, 2.2, 5.2, 6.1, 6.2, 6.3, 2.4_
  - [ ]* 14.2 Write property test for CORS rejection (Property 9: Non-Matching CORS Origins Rejected)
    - **Property 9: Non-Matching CORS Origins Rejected**
    - Generate random non-matching Origin headers; verify response does not include `Access-Control-Allow-Origin`
    - **Validates: Requirements 6.2**

- [ ] 15. Update frontend for environment-based API URL
  - [ ] 15.1 Update `packages/frontend/src/context/AuthContext.tsx` — replace hardcoded `/api/` prefix with `import.meta.env.VITE_API_URL` base URL for all fetch calls
    - _Requirements: 14.4_

- [ ] 16. Containerize application for ECS Fargate
  - [ ] 16.1 Create `packages/api/Dockerfile` — multi-stage build (`node:20-alpine` builder → `node:20-alpine` runtime), copy only production deps + compiled JS, run as non-root user
    - _Requirements: 13.1, 13.2, 13.3, 13.5_
  - [ ]* 16.2 Write unit tests verifying Dockerfile structure (multi-stage, non-root USER directive)
    - _Requirements: 13.2, 13.5_

- [ ] 17. Add backward compatibility verification
  - [ ]* 17.1 Write property test for response shape backward compatibility (Property 12: Response Shape Backward Compatibility)
    - **Property 12: Response Shape Backward Compatibility**
    - Generate valid requests to all existing API endpoints; verify response JSON contains all original keys with same value types
    - **Validates: Requirements 14.2**
  - [ ]* 17.2 Write integration tests covering full request lifecycle: register → login → browse products → place order → check order, verifying all existing routes return expected status codes and response shapes
    - _Requirements: 14.1, 14.2, 14.3_

- [ ] 18. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The implementation language is TypeScript throughout, using `pg` (node-postgres), `pino`, `zod`, `express-rate-limit`, and `fast-check` for property tests with Vitest as the test runner
- Infrastructure-level concerns (ALB TLS configuration, ECS task definitions, S3 bucket IAM policies) referenced in Requirements 10.4, 12.1, 12.2, 12.3, 13.4 are addressed through the Dockerfile and application code that reads config from environment/Secrets Manager — actual IaC (CDK/CloudFormation) is out of scope for this coding task list
