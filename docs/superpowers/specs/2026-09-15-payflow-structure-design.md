# PayFlow — Application Structure Design

**Date:** 2026-09-15
**Status:** Approved for planning
**Goal:** A deliberately simple payments app used to learn NestJS microservices.

## 1. Purpose and scope

PayFlow is a learning project. It must demonstrate real service boundaries,
message contracts, and money-handling discipline without becoming a system
whose complexity obscures the lessons.

Features in scope:

1. Create an account
2. Log in
3. Create and manage a wallet
4. Deposit money
5. Transfer money to another user
6. Check transaction history
7. Receive notifications
8. Talk to a simulated mobile-money provider

Explicitly out of scope: KYC, multi-currency conversion, fees, reversals,
refunds, admin tooling, real payment integrations, production deployment.

## 2. Decisions

| Decision | Choice | Reason |
|---|---|---|
| Transport | Nest TCP | Zero infrastructure; fastest path to running services. Isolated behind one config file so it can be swapped for RabbitMQ later. |
| Persistence | Postgres + Prisma, one schema per service | Teaches database-per-service with a single container and one set of tooling. |
| Granularity | 5 services | Real boundaries without a transfer requiring a distributed transaction on day one. |
| First deliverable | Full skeleton, all services wired, handlers stubbed | Plumbing done once; each feature milestone is then pure business logic. |

### Consequence of choosing TCP

TCP is request/response only. There is no publish/subscribe, so notifications
are triggered by a direct call from `wallet-service` to `notification-service`
rather than by an event. This is an accepted trade-off for setup simplicity.
All transport configuration lives in a single file precisely so that migrating
to RabbitMQ — and converting notifications into genuine events — is a
contained change rather than a rewrite.

## 3. Services

| Service | Type | Port | Owns |
|---|---|---|---|
| `api-gateway` | HTTP | 3000 | HTTP routing, JWT guard, request validation, RPC-to-HTTP error mapping |
| `auth-service` | TCP | 4001 | Users, password hashing, JWT issuing and validation |
| `wallet-service` | TCP | 4002 | Wallets, balances, deposits, transfers, ledger, history |
| `notification-service` | TCP | 4003 | In-app notification inbox |
| `momo-sim` | TCP | 4004 | Simulated mobile-money provider |

`api-gateway` is the only service exposed to clients. `wallet-service` is also
a client of `notification-service` and `momo-sim`, so the codebase exercises
service-to-service calls and not only gateway fan-out.

### Dependency direction

```
api-gateway ──▶ auth-service
            ──▶ wallet-service
            ──▶ notification-service

wallet-service ──▶ momo-sim
               ──▶ notification-service
               ──▶ auth-service   (resolve recipient by email)
```

No cycles. `auth-service`, `notification-service` and `momo-sim` are leaves
and depend on nothing.

## 4. Repository layout

```
apps/
  api-gateway/
    src/
      main.ts
      api-gateway.module.ts
      auth/            controller, jwt.guard, current-user.decorator
      wallets/         controller
      transfers/       controller
      notifications/   controller
      health/          controller (fans out to all services)
      filters/         rpc-exception.filter.ts
  auth-service/
    src/
      main.ts
      auth-service.module.ts
      auth.controller.ts     @MessagePattern handlers only
      auth.service.ts        business logic
      prisma.service.ts
  wallet-service/
    src/
      main.ts
      wallet-service.module.ts
      wallet.controller.ts
      wallet.service.ts      wallets and balances
      deposit.service.ts     deposit flow, talks to momo-sim
      transfer.service.ts    transfer flow
      ledger.service.ts      transaction rows and history
      prisma.service.ts
  notification-service/
    src/ main.ts, notification-service.module.ts,
         notification.controller.ts, notification.service.ts,
         prisma.service.ts
  momo-sim/
    src/ main.ts, momo-sim.module.ts, momo.controller.ts, momo.service.ts,
         prisma.service.ts

libs/
  contracts/src/
    patterns.ts        message pattern constants
    auth/              dto + response types
    wallet/
    notification/
    momo/
    index.ts
  common/src/
    transport.config.ts   the transport swap seam
    money.ts              minor-unit helpers
    errors.ts             error codes and RpcException helpers
    index.ts

prisma/
  auth/schema.prisma
  wallet/schema.prisma
  notification/schema.prisma
  momo/schema.prisma

docker-compose.yml
.env.example
```

The default `apps/micro` scaffold is deleted. `nest-cli.json`, `tsconfig.json`
path aliases, and `package.json` scripts are updated for the five projects and
two libraries.

### Controller/service split

Every microservice keeps `@MessagePattern` handlers in a controller that does
nothing but unwrap the payload and delegate. Business logic lives in services
with no transport awareness, which is what makes them unit-testable and what
makes a later transport swap invisible to them.

## 5. Contracts

`libs/contracts` is the only code shared between services. A service never
imports another service's modules or Prisma client.

Message patterns are typed constants, so a mistyped pattern fails at compile
time rather than hanging at runtime:

```ts
export const AUTH_PATTERNS = {
  register:      'auth.register',
  login:         'auth.login',
  validateToken: 'auth.validate_token',
  getUser:       'auth.get_user',
  findByEmail:   'auth.find_by_email',
} as const;

export const WALLET_PATTERNS = {
  create:     'wallet.create',
  list:       'wallet.list',
  getBalance: 'wallet.get_balance',
  deposit:    'wallet.deposit',
  transfer:   'wallet.transfer',
  history:    'wallet.history',
} as const;

export const NOTIFICATION_PATTERNS = {
  send:    'notification.send',
  list:    'notification.list',
  markRead:'notification.mark_read',
} as const;

export const MOMO_PATTERNS = {
  charge:  'momo.charge',
  payout:  'momo.payout',
  status:  'momo.status',
} as const;
```

DTOs are classes decorated with `class-validator`, shared by the gateway's HTTP
layer and the services' message layer so a payload is described exactly once.

### Client tokens

`libs/contracts` also exports the injection tokens — `AUTH_SERVICE`,
`WALLET_SERVICE`, `NOTIFICATION_SERVICE`, `MOMO_SERVICE` — used by every
`ClientsModule.register` call.

## 6. Transport configuration

`libs/common/src/transport.config.ts` is the single place transport is
described. Each `main.ts` uses it to build its listener options; each
`ClientsModule` uses it to build client options. Host and port come from
environment variables with sane defaults.

```ts
export const serviceEndpoints = {
  AUTH_SERVICE:         { host: env('AUTH_HOST', 'localhost'), port: envInt('AUTH_PORT', 4001) },
  WALLET_SERVICE:       { host: env('WALLET_HOST', 'localhost'), port: envInt('WALLET_PORT', 4002) },
  NOTIFICATION_SERVICE: { host: env('NOTIFICATION_HOST', 'localhost'), port: envInt('NOTIFICATION_PORT', 4003) },
  MOMO_SERVICE:         { host: env('MOMO_HOST', 'localhost'), port: envInt('MOMO_PORT', 4004) },
} as const;

export function microserviceOptions(name: ServiceName): MicroserviceOptions;
export function clientOptions(name: ServiceName): ClientProviderOptions;
```

Migrating to RabbitMQ means changing these two functions and adding a broker to
`docker-compose.yml`. No service code changes.

## 7. Data model

One Prisma schema per service, each pointed at its own Postgres schema within a
single database instance. Cross-service data is retrieved by message, never by
SQL join.

### auth schema

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  fullName     String
  createdAt    DateTime @default(now())
}
```

### wallet schema

```prisma
model Wallet {
  id           String   @id @default(uuid())
  userId       String                      // from auth-service, not a FK
  currency     String   @default("XAF")
  balanceMinor BigInt   @default(0)
  status       WalletStatus @default(ACTIVE)
  createdAt    DateTime @default(now())
  transactions Transaction[]
  @@unique([userId, currency])
}

model Transaction {
  id                   String   @id @default(uuid())
  walletId             String
  wallet               Wallet   @relation(fields: [walletId], references: [id])
  type                 TxType            // DEPOSIT | TRANSFER_IN | TRANSFER_OUT
  status               TxStatus          // PENDING | COMPLETED | FAILED
  amountMinor          BigInt
  balanceAfterMinor    BigInt?
  counterpartyWalletId String?
  providerRef          String?
  idempotencyKey       String   @unique
  failureReason        String?
  createdAt            DateTime @default(now())
  @@index([walletId, createdAt])
}
```

### notification schema

```prisma
model Notification {
  id        String   @id @default(uuid())
  userId    String
  type      String
  title     String
  body      String
  readAt    DateTime?
  createdAt DateTime @default(now())
  @@index([userId, createdAt])
}
```

### momo schema

```prisma
model ProviderAccount {
  msisdn       String @id
  balanceMinor BigInt @default(1000000)
}
```

### Money representation

All amounts are integers in minor units. `balanceMinor: 5000` is 50.00. No
floating point touches a monetary value anywhere. `libs/common/src/money.ts`
provides parsing from a decimal string, formatting for display, and guards
against negative or zero amounts. The gateway accepts and returns decimal
strings; everything internal is minor units.

One trap to handle deliberately: Prisma returns `BigInt`, and `BigInt` has no
JSON representation, so it throws the moment a payload crosses the transport or
leaves an HTTP controller. Amounts are therefore converted to `string` at every
boundary — `money.ts` owns that conversion, and no `BigInt` ever appears in a
DTO defined in `libs/contracts`.

### Idempotency

Every mutating operation carries an `idempotencyKey`, supplied by the caller or
generated at the gateway, stored with a unique index. Replaying a request
returns the original transaction rather than performing the operation twice.
Retries are routine in a distributed system, so this is load-bearing rather
than decorative.

## 8. Flows

### Registration and login

```
POST /auth/register → auth.register  → hash password, insert User
                    → wallet.create  → default XAF wallet
POST /auth/login    → auth.login     → verify password, return JWT
```

The gateway makes both calls; `auth-service` never calls `wallet-service`,
because `wallet-service` already calls `auth-service` and the reverse edge
would create a cycle. `wallet.create` is idempotent on `(userId, currency)`,
so if the second call fails the user simply has no wallet yet and the next
`wallet.create` — issued on first wallet access — completes the job.

The gateway's `JwtGuard` validates tokens locally using the shared secret and
attaches `userId` to the request. `auth.validate_token` exists for services
that need to verify a token they did not receive from the gateway.

### Deposit

```
POST /wallets/:id/deposits { amount, msisdn, idempotencyKey? }

wallet-service:
  1. load wallet, assert ownership and ACTIVE status
  2. insert Transaction(DEPOSIT, PENDING)
  3. call momo.charge { msisdn, amountMinor, reference }
  4a. success → single DB transaction:
        balanceMinor += amount
        Transaction → COMPLETED, providerRef, balanceAfterMinor
  4b. failure → Transaction → FAILED with failureReason
  5. call notification.send (fire and forget; a notification failure
     must never fail a completed deposit)
```

### Transfer

```
POST /transfers { toEmail, amount, idempotencyKey? }

wallet-service:
  1. resolve recipient via auth.find_by_email
  2. load both wallets, assert same currency, assert sender has funds
  3. ONE Postgres transaction:
       sender.balanceMinor -= amount
       recipient.balanceMinor += amount
       insert Transaction(TRANSFER_OUT, COMPLETED) for sender
       insert Transaction(TRANSFER_IN,  COMPLETED) for recipient
  4. notify both users
```

Both wallets are owned by `wallet-service`, so the money movement is a single
local transaction. Insufficient funds rolls back the whole thing. Splitting the
ledger into its own service later — and watching this become a saga — is the
intended follow-up exercise.

### History

```
GET /wallets/:id/transactions?cursor=&limit=
→ wallet.history → cursor-paginated Transaction rows, newest first
```

### Notifications

```
GET  /notifications          → notification.list
POST /notifications/:id/read → notification.mark_read
```

## 9. The mobile-money simulator

`momo-sim` imitates a provider with deliberately triggerable outcomes, so
failure paths can be exercised on demand:

| MSISDN ending | Behaviour |
|---|---|
| `00` | Declined — insufficient funds at the provider |
| `99` | Timeout — delays past the client timeout |
| `11` | Pending, then succeeds on a later `momo.status` call |
| anything else | Immediate success |

It also enforces a per-account balance, so a large enough deposit is declined
naturally.

## 10. Error handling

Services throw `RpcException` carrying `{ code, message, details? }`. Codes are
defined once in `libs/common/src/errors.ts`.

| Code | HTTP |
|---|---|
| `VALIDATION_FAILED` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `USER_NOT_FOUND`, `WALLET_NOT_FOUND` | 404 |
| `EMAIL_TAKEN`, `WALLET_EXISTS` | 409 |
| `INSUFFICIENT_FUNDS`, `CURRENCY_MISMATCH`, `WALLET_INACTIVE` | 422 |
| `PROVIDER_DECLINED` | 422 |
| `PROVIDER_UNAVAILABLE`, `SERVICE_UNAVAILABLE` | 502 |
| `PROVIDER_TIMEOUT` | 504 |

The gateway carries one `RpcExceptionFilter` performing that mapping; an
unrecognised code becomes 500 and is logged with its correlation id.

`ValidationPipe` runs at both boundaries — once on HTTP input at the gateway,
and again on message payloads inside each service, because a message can reach
a service from somewhere other than the gateway.

Every client call has an explicit timeout (RxJS `timeout`) so a dead service
surfaces as a 502/504 instead of a hung request.

A correlation id is generated at the gateway, passed in every message payload,
and included in every log line.

## 11. Testing

- **Unit** — one `.spec.ts` per service class, with `ClientProxy` and
  `PrismaService` mocked. Money arithmetic, insufficient-funds rejection,
  idempotent replay, and provider-failure handling are the cases that matter.
- **Integration** — `wallet-service` against a real Postgres, verifying that a
  failed transfer leaves both balances untouched.
- **E2E** — in the gateway: boot all five apps in-process, hit `GET /health`,
  assert every service reports healthy. This is the smoke test proving the
  wiring is genuine and is the acceptance criterion for the skeleton.

## 12. Developer workflow

```
docker compose up -d postgres
pnpm prisma:generate          # all four schemas
pnpm prisma:migrate           # all four schemas
pnpm dev:all                  # five apps via concurrently
```

Individual services run with `pnpm start:dev <app>`. `.env.example` documents
every variable; `.env` is gitignored.

## 13. Acceptance criteria for the skeleton

1. `pnpm build` compiles all five apps and both libraries.
2. `docker compose up -d postgres` plus `pnpm prisma:migrate` creates all four
   schemas.
3. `pnpm dev:all` starts five processes with no errors.
4. `GET /health` returns healthy for all four downstream services.
5. Every message pattern in `libs/contracts` has a handler that returns a typed
   stub and is reachable through the gateway.
6. `pnpm lint` and `pnpm test` pass.

## 14. Milestones after the skeleton

1. Register and login; JWT guard enforced at the gateway
2. Create wallet, check balance
3. Deposit through `momo-sim`, including the declined and timeout paths
4. Transfer between users, including the insufficient-funds rollback
5. Transaction history with cursor pagination
6. Notifications on every money movement
7. *Stretch:* swap TCP for RabbitMQ and convert notifications into real events

Each milestone fills in handlers behind contracts the skeleton already
established, so no milestone requires new plumbing.
