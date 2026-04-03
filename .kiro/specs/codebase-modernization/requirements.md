# Requirements Document

## Introduction

The Inventrix e-commerce application is a pnpm monorepo consisting of an Express.js/TypeScript API backend (`packages/api`) with a SQLite database and a React/Vite/TypeScript frontend (`packages/frontend`). The application supports product browsing, order placement with GST calculation, admin dashboards, inventory management, and AI-powered product image generation via AWS Bedrock.

A thorough codebase analysis has identified critical security vulnerabilities, architectural limitations, and technical debt that must be addressed to bring the system in line with the modernization standards defined in `project-standards.md`. The current deployment model is a single EC2 instance with manual shell-script deployment; the target architecture is ECS Fargate with RDS, S3, and SQS.

This requirements document captures the full modernization scope across security hardening, infrastructure migration, code quality improvements, and operational readiness.

## Glossary

- **API_Server**: The Express.js backend application in `packages/api`
- **Frontend_App**: The React/Vite frontend application in `packages/frontend`
- **Auth_Middleware**: The JWT authentication middleware in `packages/api/src/middleware/auth.ts`
- **Database_Module**: The SQLite database initialization and connection module in `packages/api/src/db.ts`
- **Route_Handler**: An Express route handler in `packages/api/src/routes/`
- **Validation_Layer**: The Zod-based input validation layer to be added to all Express routes
- **Error_Middleware**: The centralized Express error-handling middleware with custom AppError class
- **Logger**: The structured logging service (winston or pino) replacing console.log usage
- **Secrets_Manager_Client**: The AWS Secrets Manager integration for retrieving database credentials
- **Rate_Limiter**: The middleware that enforces request rate limits on public endpoints
- **Health_Check_Endpoint**: The ALB-compatible health check route for ECS Fargate target groups
- **Audit_Trail_Table**: The database table recording all inventory mutation events
- **Image_Generator_Service**: The AWS Bedrock integration service for product image generation
- **Dead_Letter_Queue**: The SQS dead-letter queue for capturing failed event processing messages

## Requirements

### Requirement 1: Migrate Database from SQLite to RDS

**User Story:** As a platform operator, I want the application to use Amazon RDS instead of SQLite, so that the database supports concurrent connections, persistence across deployments, and production-grade reliability.

#### Acceptance Criteria

1. WHEN the API_Server starts, THE Database_Module SHALL connect to an Amazon RDS PostgreSQL instance using credentials retrieved from the Secrets_Manager_Client.
2. THE Database_Module SHALL use parameterized queries for all SQL operations, with no string concatenation in query construction.
3. WHEN the Secrets_Manager_Client fails to retrieve credentials, THE API_Server SHALL log a structured error message and terminate with a non-zero exit code.
4. THE Database_Module SHALL create all required tables (users, products, orders, order_items, audit_trail) using migration scripts that are idempotent.
5. IF a database query fails, THEN THE Database_Module SHALL propagate the error to the Error_Middleware without exposing internal database details in the response.

### Requirement 2: Harden JWT Authentication and Secrets Management

**User Story:** As a security engineer, I want all secrets stored in AWS Secrets Manager and JWT configuration hardened, so that credentials are not exposed in source code or environment variables.

#### Acceptance Criteria

1. THE Auth_Middleware SHALL retrieve the JWT signing secret from the Secrets_Manager_Client at application startup.
2. THE Auth_Middleware SHALL reject any startup if the JWT secret cannot be retrieved from the Secrets_Manager_Client.
3. WHEN a JWT token is issued, THE Auth_Middleware SHALL set the token expiration to a configurable duration retrieved from application configuration.
4. THE API_Server SHALL NOT contain hardcoded secrets, default fallback secrets, or secret values in source code.
5. WHEN an authentication failure occurs, THE Auth_Middleware SHALL log the failure event using the Logger without including the user password or token value in the log entry.

### Requirement 3: Add Input Validation with Zod Schemas

**User Story:** As a developer, I want all API endpoints validated with Zod schemas, so that invalid or malicious input is rejected before reaching business logic.

#### Acceptance Criteria

1. THE Validation_Layer SHALL validate request bodies, query parameters, and path parameters on every Route_Handler using Zod schemas.
2. WHEN validation fails, THE Validation_Layer SHALL return a 400 status code with a structured error response listing all validation errors.
3. THE Validation_Layer SHALL define Zod schemas for: user registration (email, password, name), user login (email, password), product creation/update (name, description, price, stock, image_url), order creation (items array with product_id and quantity), and order status update (status enum).
4. WHEN a request body contains unexpected fields not defined in the schema, THE Validation_Layer SHALL strip those fields before passing data to the Route_Handler.
5. THE Validation_Layer SHALL validate that price values are positive numbers, stock values are non-negative integers, and email values conform to email format.

### Requirement 4: Implement Centralized Error Handling

**User Story:** As a developer, I want a centralized error-handling middleware with a custom AppError class, so that all errors are handled consistently and internal details are not leaked to clients.

#### Acceptance Criteria

1. THE Error_Middleware SHALL catch all unhandled errors from Route_Handlers and return a structured JSON error response with an appropriate HTTP status code.
2. THE Error_Middleware SHALL use a custom AppError class that includes a status code, a user-facing message, and an optional internal detail field.
3. WHEN an unexpected error occurs that is not an AppError, THE Error_Middleware SHALL return a 500 status code with a generic error message and log the full error details using the Logger.
4. THE Error_Middleware SHALL ensure that stack traces, database error messages, and internal system paths are excluded from all client-facing error responses.
5. WHEN an error is handled, THE Error_Middleware SHALL log the error with structured fields including request method, path, status code, and a correlation ID.

### Requirement 5: Replace console.log with Structured Logging

**User Story:** As a platform operator, I want structured JSON logging throughout the application, so that logs are searchable, parseable, and free of PII.

#### Acceptance Criteria

1. THE Logger SHALL output all log entries in structured JSON format using winston or pino.
2. THE API_Server SHALL contain zero instances of console.log, console.error, or console.warn in production code.
3. THE Logger SHALL NOT include personally identifiable information (email addresses, user names, passwords, JWT tokens) in any log entry.
4. WHEN a request is processed, THE Logger SHALL log the request method, path, response status code, and response time in milliseconds.
5. THE Logger SHALL support configurable log levels (debug, info, warn, error) via environment variables.

### Requirement 6: Configure CORS for Frontend Origin Only

**User Story:** As a security engineer, I want CORS restricted to the frontend origin, so that the API does not accept cross-origin requests from unauthorized domains.

#### Acceptance Criteria

1. THE API_Server SHALL configure CORS to allow requests only from the Frontend_App origin, specified via an environment variable.
2. WHEN a request arrives from an origin not matching the configured frontend origin, THE API_Server SHALL reject the request with an appropriate CORS error.
3. THE API_Server SHALL NOT use a wildcard (`*`) CORS configuration in any environment.

### Requirement 7: Add Rate Limiting on Public Endpoints

**User Story:** As a security engineer, I want rate limiting on all public-facing endpoints, so that the API is protected against brute-force attacks and abuse.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL enforce a configurable maximum number of requests per time window on all public endpoints (login, register, product listing, product detail).
2. WHEN a client exceeds the rate limit, THE Rate_Limiter SHALL return a 429 status code with a Retry-After header.
3. THE Rate_Limiter SHALL apply stricter limits to authentication endpoints (login, register) than to product browsing endpoints.
4. THE Rate_Limiter SHALL identify clients by IP address.

### Requirement 8: Implement Health Check Endpoint

**User Story:** As a platform operator, I want a health check endpoint compatible with ALB target groups, so that ECS Fargate tasks are monitored and unhealthy instances are replaced.

#### Acceptance Criteria

1. THE API_Server SHALL expose a GET `/health` endpoint that does not require authentication.
2. WHEN the database connection is healthy, THE Health_Check_Endpoint SHALL return a 200 status code with a JSON body containing `{"status": "healthy"}`.
3. IF the database connection is unavailable, THEN THE Health_Check_Endpoint SHALL return a 503 status code with a JSON body containing `{"status": "unhealthy", "reason": "database"}`.
4. THE Health_Check_Endpoint SHALL respond within 5 seconds.

### Requirement 9: Add Audit Trail for Inventory Mutations

**User Story:** As a business analyst, I want all inventory changes recorded in an audit trail table, so that stock movements can be traced and investigated.

#### Acceptance Criteria

1. WHEN a product's stock value changes (order placement, manual stock update, product creation), THE API_Server SHALL insert a record into the Audit_Trail_Table.
2. THE Audit_Trail_Table SHALL store the product ID, previous stock value, new stock value, change reason (order, manual_update, creation), the user ID who initiated the change, and a timestamp.
3. THE Audit_Trail_Table SHALL be append-only; records in the Audit_Trail_Table SHALL NOT be updated or deleted by the application.
4. WHEN an order is placed that reduces stock for multiple products, THE API_Server SHALL create one audit record per product within the same database transaction.

### Requirement 10: Migrate Static Assets to S3

**User Story:** As a platform operator, I want product images stored in a private S3 bucket with least-privilege IAM policies, so that static assets persist independently of application deployments and are served securely.

#### Acceptance Criteria

1. WHEN a product image is generated or uploaded, THE Image_Generator_Service SHALL store the image in a private S3 bucket.
2. THE Image_Generator_Service SHALL generate pre-signed URLs with a configurable expiration for serving images to the Frontend_App.
3. THE API_Server SHALL NOT serve static image files from the local filesystem in production.
4. THE S3 bucket SHALL be configured with a least-privilege IAM policy that grants only the necessary PutObject and GetObject permissions to the API_Server's task role.
5. IF an S3 upload fails, THEN THE Image_Generator_Service SHALL log the error using the Logger and return a structured error to the client.


### Requirement 11: Implement SQS Dead-Letter Queue for Failed Events

**User Story:** As a platform operator, I want failed event processing messages captured in a dead-letter queue, so that failures are not silently lost and can be investigated and replayed.

#### Acceptance Criteria

1. WHEN an asynchronous event (order notification, image generation) fails processing after a configurable number of retries, THE API_Server SHALL route the message to the Dead_Letter_Queue.
2. THE Dead_Letter_Queue SHALL retain messages for a configurable retention period (minimum 14 days).
3. THE API_Server SHALL publish a CloudWatch metric when a message is sent to the Dead_Letter_Queue.
4. WHEN a message is placed in the Dead_Letter_Queue, THE Logger SHALL log the event with the message ID, failure reason, and original queue name.

### Requirement 12: Enforce HTTPS on ALB

**User Story:** As a security engineer, I want all traffic to the application encrypted via HTTPS, so that data in transit is protected.

#### Acceptance Criteria

1. THE API_Server infrastructure SHALL configure the Application Load Balancer to listen on port 443 with a valid TLS certificate.
2. WHEN a request arrives on port 80, THE Application Load Balancer SHALL redirect the request to HTTPS (port 443) with a 301 status code.
3. THE API_Server SHALL NOT accept unencrypted HTTP traffic in production.

### Requirement 13: Containerize Application for ECS Fargate

**User Story:** As a platform operator, I want the API packaged as a Docker container and deployed on ECS Fargate, so that the application scales automatically and does not require server management.

#### Acceptance Criteria

1. THE API_Server SHALL include a Dockerfile that produces a minimal production container image.
2. THE Dockerfile SHALL use a multi-stage build to separate build dependencies from the runtime image.
3. WHEN deployed to ECS Fargate, THE API_Server SHALL read all configuration from environment variables and AWS Secrets Manager.
4. THE ECS task definition SHALL define CPU and memory limits, health check configuration, and logging to CloudWatch.
5. THE API_Server container SHALL run as a non-root user.

### Requirement 14: Maintain Backward Compatibility

**User Story:** As a frontend developer, I want existing API routes and response shapes preserved during modernization, so that the Frontend_App requires only minimal changes (auth headers and environment-based API URL).

#### Acceptance Criteria

1. THE API_Server SHALL maintain all existing API route paths: `/api/auth/login`, `/api/auth/register`, `/api/products`, `/api/products/:id`, `/api/orders`, `/api/orders/:id`, `/api/orders/:id/status`, `/api/analytics/dashboard`, `/api/analytics/inventory`, `/api/products/generate-image`.
2. THE API_Server SHALL maintain the existing JSON response shapes for all endpoints.
3. WHEN new fields are added to API responses, THE API_Server SHALL add them as optional fields that do not break existing Frontend_App parsing.
4. THE Frontend_App SHALL use an environment variable to configure the API base URL instead of relying on the Vite dev proxy for production.

### Requirement 15: Secure Order Processing with Database Transactions

**User Story:** As a developer, I want order placement wrapped in a database transaction, so that stock decrements and order creation are atomic and race conditions are prevented.

#### Acceptance Criteria

1. WHEN an order is placed, THE API_Server SHALL execute stock validation, order creation, order item insertion, stock decrement, and audit trail insertion within a single database transaction.
2. IF any step within the order transaction fails, THEN THE API_Server SHALL roll back the entire transaction and return an error to the client.
3. THE API_Server SHALL use row-level locking or serializable isolation to prevent concurrent orders from overselling a product's stock.
4. WHEN a transaction is rolled back, THE Logger SHALL log the rollback event with the order details and failure reason.
