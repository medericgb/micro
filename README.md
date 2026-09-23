# PayFlow

A deliberately simple payments app for learning NestJS microservices.

## Services

| Service | Type | Port | Owns |
|---|---|---|---|
| `api-gateway` | HTTP | 3000 | The only public surface: routing, auth guard, validation, error mapping |
| `auth-service` | TCP | 4001 | Users, credentials, JWTs |
| `wallet-service` | TCP | 4002 | Wallets, deposits, transfers, ledger |
| `notification-service` | TCP | 4003 | In-app notification inbox |
| `momo-sim` | TCP | 4004 | Simulated mobile-money provider |

`wallet-service` is itself a client of `momo-sim`, `notification-service` and
`auth-service`, so the codebase shows service-to-service calls and not only
gateway fan-out.

## Getting started

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm prisma:migrate
pnpm dev:all
curl localhost:3000/health
```

Postgres is published on **5433**, not the usual 5432, to avoid colliding with
another Postgres container on the same machine. Change it in
`docker-compose.yml` and `.env` together if you prefer a different port.

## Layout

- `apps/*` — the five applications
- `libs/contracts` — message patterns, injection tokens and DTOs; **the only
  code shared across service boundaries**
- `libs/common` — transport config, money helpers, error codes
- `prisma/*` — one schema per service, each owning a private Postgres schema

## Rules this codebase follows

1. A service never imports another service. Cross-service types come from
   `@app/contracts`.
2. A service never reads another service's tables. Cross-service data comes
   from a message.
3. Money is a `BigInt` in minor units in the database and a decimal `string` on
   every wire. `BigInt` has no JSON representation, so it must never reach a
   contract type. A single amount is capped at `MAX_AMOUNT` (999999999999.99);
   an accumulated balance is not.
4. Every message pattern string is defined once, in
   `libs/contracts/src/patterns.ts`.
5. Every mutating operation carries an idempotency key, unique per wallet
   rather than globally, so one user cannot burn another user's key.
6. Transport is described in exactly one file,
   `libs/common/src/transport.config.ts`. Gateway edge policy — rate limits and
   CORS — likewise lives in `apps/api-gateway/src/security.config.ts`.

## Gateway edge policy

The gateway is the only public surface, so it is the only place that needs edge
defences. `helmet()` sets the standard response headers, a global
`ThrottlerGuard` gives every route a budget of 120 requests a minute, and
`/auth/register` and `/auth/login` get a tighter 10 — they are the two routes
that take no token. A throttled request comes back as `429 RATE_LIMITED`.

**CORS is deny-by-default.** An empty `CORS_ORIGINS` means no cross-origin
browser access at all; set a comma-separated list of exact origins to let a
frontend in. A payments gateway that defaults to `*` is one forgotten variable
away from letting any page on the internet spend a signed-in user's balance.

All of it is tunable through the `THROTTLE_*` and `CORS_ORIGINS` variables in
`.env.example`.

## Two build details worth knowing

**Prisma clients generate into `node_modules/@db/<service>`, not into a folder
in the repo.** Path-aliasing them would compile and then fail at runtime: `tsc`
rewrites an aliased specifier relative to the *emitted* file, and the clients
are not part of the compiled tree. Generating into `node_modules` keeps
`@db/wallet` a bare specifier that Node resolves from any depth. If
`pnpm install` ever prunes them, run `pnpm prisma:generate`.

**Compiled output nests.** Once an app imports from `libs/`, tsc widens its
root and emits to `dist/apps/<app>/apps/<app>/src/main.js`. `nest start`
handles this; a hand-written `node dist/...` command must use the full path.

## Testing

```bash
pnpm test       # unit tests, no database required
pnpm test:e2e   # boots all five apps and asserts GET /health
```

`pnpm test:e2e` binds the real service ports, so stop `pnpm dev:all` first.

## Roadmap

The skeleton wires every service and returns typed stubs. Each milestone fills
in handlers behind contracts that already exist:

1. Register and login — real bcrypt hashing and Prisma lookups
2. Create wallet, check balance
3. Deposit through `momo-sim`, including declined and timeout paths
4. Transfer between users, including the insufficient-funds rollback
5. Transaction history with cursor pagination
6. Notifications on every money movement
7. *Stretch:* swap TCP for RabbitMQ and turn notifications into real events

See `docs/superpowers/specs/2026-09-15-payflow-structure-design.md` for the
full design and `docs/superpowers/plans/2026-09-15-payflow-skeleton.md` for how
the skeleton was built.
