# Inventrix

A full-stack e-commerce platform with inventory management, order processing, and analytics.

## Features

- Virtual storefront for browsing and ordering products
- Product catalog management with pricing and descriptions
- Order processing and fulfillment tracking
- Real-time inventory management and stock control
- User authentication and role-based authorization (Admin/Customer)
- Business reporting and analytics

## Tech Stack

- **Frontend**: Vite + React + TypeScript
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite

## Getting Started

### Prerequisites

- Node.js 22
- pnpm
- AWS credentials configured

### Installation

```bash
pnpm install
```

### AWS Configuration

For AI image generation, configure AWS credentials:

```bash
# Set environment variables
export AWS_REGION=your_region
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key

# Or use AWS CLI
aws configure
```

### Development

```bash
pnpm dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

### Production Build

```bash
pnpm build
pnpm start
```

### Deploying to AWS

```bash
chmod +x deploy.sh
./deploy.sh
```

## Default Users

- **Admin**: admin@inventrix.com / admin123
- **Customer**: customer@inventrix.com / customer123

## Project Structure

```
inventrix/
├── packages/
│   ├── api/          # Express backend
│   └── frontend/     # React frontend
```

# License

This library is licensed under the MIT-0 License. See the LICENSE file.