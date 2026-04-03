# Inventrix Modernization Standards

## Architecture
- Keep existing ECS Fargate + RDS + S3 + SQS architecture
- All API endpoints require JWT authentication
- Input validation using Zod schemas on every Express route
- Parameterized queries only — no string concatenation in SQL

## Code Conventions
- Migrate to TypeScript strict mode
- Error handling: Express error middleware with custom AppError class
- Structured logging (winston/pino) — no console.log
- All config via environment variables or Secrets Manager

## Security Requirements (from Design Review)
- No PII in logs (fix existing violations)
- Database credentials in AWS Secrets Manager (not env vars)
- S3 bucket private with least-privilege IAM policy
- CORS configured for frontend origin only
- Rate limiting on all public endpoints
- HTTPS enforced on ALB

## Infrastructure
- SQS dead-letter queue for failed events
- Health check endpoint for ALB target group
- Audit trail table for inventory mutations

## Backward Compatibility
- Maintain existing API routes and response shapes
- Frontend changes should be minimal (auth headers + env-based API URL)
