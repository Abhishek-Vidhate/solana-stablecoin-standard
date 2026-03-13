# Backend API Reference

The SSS backend provides a REST API for programmatic access to stablecoin operations. Built with Express, Zod validation, Winston logging, and API key authentication.

## Setup

### Docker (Recommended)

```bash
# Set environment variables
export SOLANA_RPC_URL="https://api.devnet.solana.com"

# Start the backend
docker-compose up -d
```

The `docker-compose.yml` mounts your local Solana keypair as the operator wallet:

```yaml
volumes:
  - ${HOME}/.config/solana/id.json:/app/deployer.json:ro
```

### Manual Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your values
npm run dev
```

### Environment Variables

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `PORT` | No | `3000` | Server listen port |
| `SOLANA_RPC_URL` | No | `http://localhost:8899` | Solana RPC endpoint |
| `KEYPAIR_PATH` | No | `~/.config/solana/id.json` | Path to operator keypair |
| `WEBHOOK_URL` | No | — | URL for event webhooks |

## Authentication

Currently, the SSS Backend API does **not** require authentication for its operational endpoints. It is intended for use within a trusted network environment or as a component of a larger system where access control is managed at the network or infrastructure level.

## Rate Limiting

All endpoints are rate-limited to **30 requests per 60 seconds** per IP.

## Endpoints

### Health

#### `GET /health`

Returns server health status and Solana slot.

**Response:**

```json
{
  "status": "ok",
  "solanaSlot": 284392847,
  "uptime": 3600
}
```

**Error Response (503):**

```json
{
  "status": "degraded",
  "error": "Connection refused"
}
```

---

### Operations

Operational endpoints provide programmatic access to stablecoin instructions.

#### `POST /operations/mint`

Mint tokens to a recipient address.

**Request Body:**

| Field | Type | Required | Description |
|---|---|:---:|---|
| `mint` | string (Pubkey) | Yes | Mint address |
| `recipient` | string (Pubkey) | Yes | Recipient wallet address |
| `amount` | string \| number | Yes | Amount in base units |

**Example:**

```bash
curl -X POST http://localhost:3000/operations/mint \
  -H "Content-Type: application/json" \
  -d '{
    "mint": "7xKL...abc",
    "recipient": "9yAB...def",
    "amount": "1000000000"
  }'
```

**Response:**

```json
{
  "success": true,
  "signature": "5zCD...ghi"
}
```

#### `POST /operations/burn`

Burn tokens from a token account.

**Request Body:**

| Field | Type | Required | Description |
|---|---|:---:|---|
| `mint` | string (Pubkey) | Yes | Mint address |
| `from` | string (Pubkey) | Yes | Token account to burn from |
| `amount` | string \| number | Yes | Amount in base units |

**Example:**

```bash
curl -X POST http://localhost:3000/operations/burn \
  -H "Content-Type: application/json" \
  -d '{
    "mint": "7xKL...abc",
    "from": "8DEF...xyz",
    "amount": "500000000"
  }'
```

#### `POST /operations/freeze`

Freeze a token account.

**Request Body:**

| Field | Type | Required | Description |
|---|---|:---:|---|
| `mint` | string (Pubkey) | Yes | Mint address |
| `account` | string (Pubkey) | Yes | Token account to freeze |

**Example:**

```bash
curl -X POST http://localhost:3000/operations/freeze \
  -H "Content-Type: application/json" \
  -d '{
    "mint": "7xKL...abc",
    "account": "8DEF...xyz"
  }'
```

#### `POST /operations/thaw`

Thaw a frozen token account.

**Request Body:**

| Field | Type | Required | Description |
|---|---|:---:|---|
| `mint` | string (Pubkey) | Yes | Mint address |
| `account` | string (Pubkey) | Yes | Token account to thaw |

#### `POST /operations/pause`

Globally pause mint and burn operations.

**Request Body:**

| Field | Type | Required | Description |
|---|---|:---:|---|
| `mint` | string (Pubkey) | Yes | Mint address |

#### `POST /operations/unpause`

Resume paused operations.

**Request Body:**

| Field | Type | Required | Description |
|---|---|:---:|---|
| `mint` | string (Pubkey) | Yes | Mint address |

#### `POST /operations/seize`

Force-transfer tokens via PermanentDelegate (SSS-2/4).

**Request Body:**

| Field | Type | Required | Description |
|---|---|:---:|---|
| `mint` | string (Pubkey) | Yes | Mint address |
| `from` | string (Pubkey) | Yes | Source token account |
| `to` | string (Pubkey) | Yes | Destination token account |
| `amount` | string \| number | Yes | Amount in base units |

**Example:**

```bash
curl -X POST http://localhost:3000/operations/seize \
  -H "Content-Type: application/json" \
  -d '{
    "mint": "7xKL...abc",
    "from": "8DEF...xyz",
    "to": "9GHI...uvw",
    "amount": "1000000"
  }'
```

#### `POST /operations/fees/update`

Update transfer fee (SSS-4 only). Requires Admin role.

**Request Body:**

| Field | Type | Required | Description |
|---|---|:---:|---|
| `mint` | string (Pubkey) | Yes | Mint address |
| `basisPoints` | number | Yes | Fee in basis points (0–10000, e.g. 10 = 0.10%) |
| `maximumFee` | string \| number | Yes | Maximum fee in base units |

**Example:**

```bash
curl -X POST http://localhost:3000/operations/fees/update \
  -H "Content-Type: application/json" \
  -d '{
    "mint": "7xKL...abc",
    "basisPoints": 10,
    "maximumFee": "1000000"
  }'
```

**Response:** `{ "success": true, "signature": "..." }`

#### `POST /operations/fees/withdraw`

Withdraw withheld transfer fees to a destination (SSS-4 only). Requires Admin role.

**Request Body:**

| Field | Type | Required | Description |
|---|---|:---:|---|
| `mint` | string (Pubkey) | Yes | Mint address |
| `destination` | string (Pubkey) | Yes | Token account to receive withdrawn fees |
| `sources` | array (Pubkey) | No | Optional token accounts to withdraw from; if omitted, withdraws from all |

**Example:**

```bash
curl -X POST http://localhost:3000/operations/fees/withdraw \
  -H "Content-Type: application/json" \
  -d '{
    "mint": "7xKL...abc",
    "destination": "9GHI...uvw"
  }'
```

**Response:** `{ "success": true, "signature": "..." }`

---

### Compliance

Compliance endpoints manage blacklisting and audit trails.

#### `POST /compliance/blacklist/add`

Add an address to the blacklist.

**Request Body:**

| Field | Type | Required | Description |
|---|---|:---:|---|
| `mint` | string (Pubkey) | Yes | Mint address |
| `address` | string (Pubkey) | Yes | Address to blacklist |
| `reason` | string (1-64 chars) | Yes | Compliance reason code |

**Example:**

```bash
curl -X POST http://localhost:3000/compliance/blacklist/add \
  -H "Content-Type: application/json" \
  -d '{
    "mint": "7xKL...abc",
    "address": "BAD1...xyz",
    "reason": "OFAC-SDN-2026-001"
  }'
```

#### `POST /compliance/blacklist/remove`

Remove an address from the blacklist.

**Request Body:**

| Field | Type | Required | Description |
|---|---|:---:|---|
| `mint` | string (Pubkey) | Yes | Mint address |
| `address` | string (Pubkey) | Yes | Address to remove |

#### `GET /compliance/status/:mint/:address`

Check if an address is blacklisted. Does not require authentication.

**Response:**

```json
{
  "mint": "7xKL...abc",
  "address": "BAD1...xyz",
  "blacklisted": true
}
```

#### `GET /compliance/audit-trail/:mint`

Retrieve recent transaction signatures for the stablecoin config PDA.

**Response:**

```json
{
  "mint": "7xKL...abc",
  "configPda": "9yAB...def",
  "transactions": [
    {
      "signature": "5zCD...ghi",
      "slot": 284392847,
      "blockTime": 1741305600,
      "err": null,
      "memo": null
    }
  ]
}
```

---

## Error Responses

All error responses follow a consistent format:

```json
{
  "success": false,
  "error": "Supply cap exceeded"
}
```

| HTTP Status | Meaning |
|---|---|
| 200 | Success |
| 400 | Bad request (validation error or on-chain error) |
| 401 | Not Used |
| 429 | Rate limit exceeded |
| 500 | Server misconfiguration |
| 503 | Solana RPC unavailable |

## Docker Compose Reference

```yaml
version: "3.8"
services:
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    ports:
      - "3000:3000"
    environment:
      PORT: 3000
      SOLANA_RPC_URL: ${SOLANA_RPC_URL:-http://host.docker.internal:8899}
      KEYPAIR_PATH: /app/deployer.json
    volumes:
      - ${HOME}/.config/solana/id.json:/app/deployer.json:ro
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Running with Docker

```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop
docker-compose down

# Rebuild after changes
docker-compose up -d --build
```

## Event Listener

The backend starts an event listener on boot that monitors the Solana RPC WebSocket for program events (mints, burns, freezes, blacklist changes, etc.). If `WEBHOOK_URL` is configured, events are forwarded as POST requests to that URL for external integrations.
