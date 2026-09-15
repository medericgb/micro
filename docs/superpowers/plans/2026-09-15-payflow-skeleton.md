# PayFlow Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete five-service PayFlow skeleton — every app, library, contract, database schema and wire — so that `GET /health` proves a real gateway-to-service round trip and every message pattern is reachable with a typed stub.

**Architecture:** A NestJS monorepo with five applications communicating over Nest's TCP transport. `api-gateway` is the only HTTP surface; `auth-service`, `wallet-service`, `notification-service` and `momo-sim` are message-pattern microservices. Two shared libraries carry everything crossing a boundary: `@app/contracts` (patterns, tokens, DTOs) and `@app/common` (transport config, money helpers, error codes). Each service owns a private Postgres schema through its own Prisma client.

**Tech Stack:** NestJS 11, TypeScript 5.7, Prisma 6 + PostgreSQL 16, class-validator, Jest + ts-jest, pnpm 10, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-15-payflow-structure-design.md`

## Global Constraints

- **Node 20.19.0, pnpm 10.32.1.** Do not add a `"type": "module"` field — the repo compiles as CommonJS and the `nodenext` module resolution in `tsconfig.json` depends on that.
- **All `@nestjs/*` packages stay on `^11`.** The repo currently has `@nestjs/microservices@12.0.2` against `@nestjs/core@11.2.4`; its peer range is `^12.0.0`. Task 1 corrects this. Never install a `@nestjs` package at a different major from `@nestjs/core`.
- **Money is `BigInt` minor units in the database and `string` on every wire.** No `number` and no floating point ever holds a monetary value. No `BigInt` appears in any type exported from `@app/contracts` — `BigInt` has no JSON representation and throws on serialization.
- **Services never import each other.** The only cross-service imports are `@app/contracts` and `@app/common`. A service never imports another service's Prisma client.
- **Every message pattern string is defined once**, in `libs/contracts/src/patterns.ts`. No string literal pattern appears in a controller or a client call.
- **Currency default is `XAF`**, currency codes are exactly 3 uppercase letters.
- **Every mutating operation carries an `idempotencyKey`** and every client call carries an explicit timeout from `RPC_TIMEOUT_MS` (default 5000).
- **TDD throughout:** write the failing test, watch it fail, implement, watch it pass, commit.

---

## File Structure

| Path | Responsibility |
|---|---|
| `libs/common/src/money.ts` | Decimal-string ↔ minor-unit `BigInt` conversion, amount validation regex |
| `libs/common/src/errors.ts` | `ErrorCode` constants, `AppRpcException`, code→HTTP status map |
| `libs/common/src/transport.config.ts` | The only place transport is described; listener and client option builders |
| `libs/contracts/src/patterns.ts` | Every message pattern string, plus health patterns |
| `libs/contracts/src/tokens.ts` | `ClientsModule` injection tokens and the `ServiceName` type |
| `libs/contracts/src/{auth,wallet,notification,momo}/` | DTOs and response types per domain |
| `apps/momo-sim/src/` | Simulated provider: charge, payout, status |
| `apps/notification-service/src/` | Notification inbox: send, list, mark read |
| `apps/auth-service/src/` | Users, credentials, tokens |
| `apps/wallet-service/src/` | Wallets, deposits, transfers, ledger; client of momo, notification, auth |
| `apps/api-gateway/src/` | HTTP controllers, validation, RPC→HTTP error filter, health fan-out |
| `prisma/{auth,wallet,notification,momo}/schema.prisma` | One schema per service |

Tasks 7–10 build the leaf services first and the most-connected service last, so every dependency exists before something needs it.

---

### Task 1: Dependency baseline and workspace scaffolding

Corrects the broken dependency set, replaces the default scaffold with the five real applications and two libraries, and fixes two build-configuration bugs. Ends with all five apps compiling.

**Files:**
- Modify: `package.json` (dependencies, scripts, jest roots)
- Modify: `nest-cli.json` (projects, `deleteOutDir`, `webpack`)
- Modify: `tsconfig.json` (path aliases)
- Modify: `.gitignore`
- Delete: `apps/micro/`
- Create: `apps/{auth-service,wallet-service,notification-service,momo-sim}/`, `libs/{contracts,common}/`

**Interfaces:**
- Consumes: nothing
- Produces: the `@app/contracts` and `@app/common` path aliases, and the five Nest project names (`api-gateway`, `auth-service`, `wallet-service`, `notification-service`, `momo-sim`) used by every later task's build and run commands.

- [ ] **Step 1: Fix the mismatched Nest major and install the runtime dependencies**

`@nestjs/microservices@12.0.2` declares `"@nestjs/core": "^12.0.0"` as a peer, but installed core is `11.2.4`. Pin it to the same major:

```bash
pnpm add @nestjs/microservices@^11.0.0 @nestjs/config@^4.0.0 @nestjs/jwt@^11.0.0 \
  class-validator@^0.14.1 class-transformer@^0.5.1 @prisma/client@^6.0.0 bcrypt@^5.1.1
pnpm add -D prisma@^6.0.0 @types/bcrypt@^5.0.2 concurrently@^9.1.0
```

- [ ] **Step 2: Verify the majors now agree**

```bash
node -p "['@nestjs/core','@nestjs/common','@nestjs/microservices'].map(p=>p+': '+require('./node_modules/'+p+'/package.json').version).join('\n')"
```

Expected: all three report `11.x`.

- [ ] **Step 3: Generate the four services and two libraries**

```bash
pnpm nest generate app auth-service
pnpm nest generate app wallet-service
pnpm nest generate app notification-service
pnpm nest generate app momo-sim
pnpm nest generate library common
pnpm nest generate library contracts
```

When the library generator asks for a prefix, accept the default `@app`. The generator writes the `@app/common` and `@app/contracts` entries into `tsconfig.json` `paths` and into the jest `moduleNameMapper` in `package.json` — do not hand-write those.

- [ ] **Step 4: Remove the default scaffold**

```bash
rm -rf apps/micro
```

Then delete the `"micro"` entry from `projects` in `nest-cli.json`, and change `"root"` and `"sourceRoot"` at the top level to point at `apps/api-gateway` and `apps/api-gateway/src`.

- [ ] **Step 5: Fix the two build-configuration bugs in `nest-cli.json`**

Set `compilerOptions` at the top level to exactly:

```json
"compilerOptions": {
  "deleteOutDir": false,
  "webpack": false,
  "tsConfigPath": "apps/api-gateway/tsconfig.app.json"
}
```

`deleteOutDir: true` wipes all of `dist/` on every build, so in a sequential five-app build only the last app survives — that one is a straight bug and must be fixed.

`webpack: false` is the riskier of the two changes and Step 11 verifies it before anything depends on it. The trade-off: webpack resolves `@app/*` path aliases at build time and its Nest-supplied `IgnorePlugin` silences the optional `@nestjs/microservices` transports, but it also tries to bundle the Prisma clients, whose native query-engine binaries do not survive bundling. `tsc` leaves Prisma alone but does **not** rewrite path aliases in its output, so alias resolution has to hold at runtime. Step 11 settles which of the two this repo actually needs.

- [ ] **Step 6: Do NOT add path aliases for the generated Prisma clients**

The `@app/*` aliases the generator created are all that belongs in `paths`.

It is tempting to add `"@db/auth": ["generated/auth"]` and friends, but it does not work: `tsc` rewrites an aliased specifier into a path relative to the **emitted** file, and the generated clients are not part of the compiled tree, so `dist/apps/momo-sim/apps/momo-sim/src/prisma.service.js` ends up requiring `dist/apps/momo-sim/generated/momo`, which never exists. It compiles cleanly and then throws `MODULE_NOT_FOUND` on boot.

Task 6 instead generates each client into `node_modules/@db/<service>`, where Prisma writes a real `package.json` with `main`, `types` and a root `exports` entry. `@db/momo` then stays a bare specifier that `tsc` leaves untouched and Node resolves from any depth. Source files still import `from '@db/momo'` exactly as they would have.

- [ ] **Step 7: Teach jest about the library and generated-client paths**

In `package.json`, set `jest.roots` to include libraries, and add the `@db/*` mappings next to the `@app/*` ones the generator wrote:

```json
"roots": ["<rootDir>/apps/", "<rootDir>/libs/"],
"moduleNameMapper": {
  "^@app/common(|/.*)$": "<rootDir>/libs/common/src/$1",
  "^@app/contracts(|/.*)$": "<rootDir>/libs/contracts/src/$1"
}
```

No `@db/*` entries: those resolve through `node_modules` like any other package, so jest needs no help. Without `libs/` in `roots`, every test written in Tasks 2–5 is silently never run — check whether the library generator already added it before editing.

- [ ] **Step 8: Replace the `scripts` block in `package.json`**

```json
"scripts": {
  "clean": "rm -rf dist",
  "build": "pnpm clean && nest build api-gateway && nest build auth-service && nest build wallet-service && nest build notification-service && nest build momo-sim",
  "dev:gateway": "nest start api-gateway --watch",
  "dev:auth": "nest start auth-service --watch",
  "dev:wallet": "nest start wallet-service --watch",
  "dev:notification": "nest start notification-service --watch",
  "dev:momo": "nest start momo-sim --watch",
  "dev:all": "concurrently -n gw,auth,wallet,notif,momo -c blue,green,magenta,yellow,cyan \"pnpm dev:gateway\" \"pnpm dev:auth\" \"pnpm dev:wallet\" \"pnpm dev:notification\" \"pnpm dev:momo\"",
  "prisma:generate": "prisma generate --schema prisma/auth/schema.prisma && prisma generate --schema prisma/wallet/schema.prisma && prisma generate --schema prisma/notification/schema.prisma && prisma generate --schema prisma/momo/schema.prisma",
  "prisma:migrate": "prisma migrate dev --schema prisma/auth/schema.prisma && prisma migrate dev --schema prisma/wallet/schema.prisma && prisma migrate dev --schema prisma/notification/schema.prisma && prisma migrate dev --schema prisma/momo/schema.prisma",
  "format": "prettier --write \"apps/**/*.ts\" \"libs/**/*.ts\"",
  "lint": "eslint \"{apps,libs}/**/*.ts\" --fix",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:cov": "jest --coverage",
  "test:e2e": "jest --config ./apps/api-gateway/test/jest-e2e.json"
}
```

- [ ] **Step 9: Ignore generated output and local env**

Append to `.gitignore`:

```
.env
```

The generated clients live under `node_modules/`, which is already ignored.

- [ ] **Step 10: Verify every app compiles**

```bash
pnpm build && ls dist/apps
```

Expected: PASS, and `ls` lists all five of `api-gateway`, `auth-service`, `wallet-service`, `notification-service`, `momo-sim`. If only one directory appears, `deleteOutDir` was not set to `false`.

- [ ] **Step 11: Verify that `@app/*` aliases resolve at runtime, and record the outcome**

Compiling is not the same as running: `tsc` emits `require("@app/common")` verbatim, so an alias that type-checks can still throw `MODULE_NOT_FOUND` on boot. Prove it now, with a throwaway probe, rather than discovering it in Task 7.

```bash
mkdir -p libs/common/src && echo "export const PROBE = 'ok';" > libs/common/src/probe.ts
cat > apps/api-gateway/src/main.ts <<'PROBE'
import { PROBE } from '@app/common/probe';
console.log('alias resolved:', PROBE);
PROBE
pnpm nest build api-gateway && node dist/apps/api-gateway/main.js
```

Expected: prints `alias resolved: ok`, from `dist/apps/api-gateway/apps/api-gateway/src/main.js`. Note that path: once an app imports from `libs/`, tsc widens its `rootDir` to the repo root and the output nests one level deeper than `dist/apps/<app>/main.js`. `nest start` handles this, but a hand-written `node dist/...` command must use the nested path.

This probe covers `@app/*` only. It does **not** cover the generated Prisma clients — see Task 1 Step 6 for why they must not be path-aliased at all.

**If it prints `Cannot find module '@app/common/probe'` instead**, tsc output is not alias-aware. Apply the fallback: revert `nest-cli.json` to `"webpack": true`, then create `webpack.config.js` at the repo root so Prisma's clients are required at runtime rather than bundled —

```js
module.exports = (options) => ({
  ...options,
  externals: [
    ...(Array.isArray(options.externals) ? options.externals : []),
    ({ request }, callback) =>
      request?.startsWith('@db/')
        ? callback(null, `commonjs ${request}`)
        : callback(),
  ],
});
```

— and reference it from each project's `compilerOptions` in `nest-cli.json` as `"webpackConfigPath": "webpack.config.js"`. Then re-run the probe; webpack resolves `@app/*` from `tsconfig.json` `paths` at build time, so it must pass. Record which branch you took in the commit message: every later task depends on it.

Restore the real bootstrap afterwards:

```bash
rm libs/common/src/probe.ts
git checkout apps/api-gateway/src/main.ts
```

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold payflow monorepo with five apps and two libs"
```

---

### Task 2: Money helpers

Decimal-string ↔ minor-unit conversion, the single place monetary parsing lives.

**Files:**
- Create: `libs/common/src/money.ts`
- Test: `libs/common/src/money.spec.ts`
- Modify: `libs/common/src/index.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `AMOUNT_PATTERN: RegExp` — used by contract DTO validation in Task 5
  - `toMinor(amount: string): bigint`
  - `toDecimal(minor: bigint): string`
  - `assertPositiveAmount(amount: string): bigint`

- [ ] **Step 1: Write the failing test**

Create `libs/common/src/money.spec.ts`:

```ts
import { AMOUNT_PATTERN, toMinor, toDecimal, assertPositiveAmount } from './money';

describe('money', () => {
  describe('toMinor', () => {
    it('converts whole amounts', () => {
      expect(toMinor('50')).toBe(5000n);
    });

    it('converts two-decimal amounts', () => {
      expect(toMinor('50.25')).toBe(5025n);
    });

    it('pads a single decimal place', () => {
      expect(toMinor('50.2')).toBe(5020n);
    });

    it('handles amounts far beyond Number.MAX_SAFE_INTEGER', () => {
      expect(toMinor('99999999999999999.99')).toBe(9999999999999999999n);
    });

    it('rejects a malformed amount', () => {
      expect(() => toMinor('50.255')).toThrow('Invalid amount');
      expect(() => toMinor('-50')).toThrow('Invalid amount');
      expect(() => toMinor('abc')).toThrow('Invalid amount');
      expect(() => toMinor('')).toThrow('Invalid amount');
    });
  });

  describe('toDecimal', () => {
    it('formats with two decimal places', () => {
      expect(toDecimal(5000n)).toBe('50.00');
      expect(toDecimal(5025n)).toBe('50.25');
    });

    it('pads amounts below one unit', () => {
      expect(toDecimal(5n)).toBe('0.05');
      expect(toDecimal(0n)).toBe('0.00');
    });

    it('round-trips with toMinor', () => {
      expect(toDecimal(toMinor('1234.56'))).toBe('1234.56');
    });
  });

  describe('assertPositiveAmount', () => {
    it('returns the minor value for a positive amount', () => {
      expect(assertPositiveAmount('0.01')).toBe(1n);
    });

    it('rejects zero', () => {
      expect(() => assertPositiveAmount('0.00')).toThrow('must be greater than zero');
    });
  });

  it('exposes a pattern that accepts valid and rejects invalid amounts', () => {
    expect(AMOUNT_PATTERN.test('10')).toBe(true);
    expect(AMOUNT_PATTERN.test('10.5')).toBe(true);
    expect(AMOUNT_PATTERN.test('10.50')).toBe(true);
    expect(AMOUNT_PATTERN.test('10.500')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest libs/common/src/money.spec.ts`
Expected: FAIL — `Cannot find module './money'`.

If instead it reports "no tests found", `jest.roots` in `package.json` is missing `<rootDir>/libs/` (Task 1, Step 7).

- [ ] **Step 3: Write minimal implementation**

Create `libs/common/src/money.ts`:

```ts
/** Amounts cross the wire as decimal strings with at most two decimal places. */
export const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

const MINOR_UNIT_DIGITS = 2;

/** Parse a decimal string into minor units. String arithmetic only — never Number. */
export function toMinor(amount: string): bigint {
  if (typeof amount !== 'string' || !AMOUNT_PATTERN.test(amount)) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole + fraction.padEnd(MINOR_UNIT_DIGITS, '0'));
}

/** Format minor units as a decimal string for display or transport. */
export function toDecimal(minor: bigint): string {
  const digits = minor.toString().padStart(MINOR_UNIT_DIGITS + 1, '0');
  const cut = digits.length - MINOR_UNIT_DIGITS;
  return `${digits.slice(0, cut)}.${digits.slice(cut)}`;
}

/** Parse and require a strictly positive amount. */
export function assertPositiveAmount(amount: string): bigint {
  const minor = toMinor(amount);
  if (minor <= 0n) {
    throw new Error(`Amount must be greater than zero: ${amount}`);
  }
  return minor;
}
```

Note `toMinor` never converts through `Number`. `Number('99999999999999999.99')` loses precision silently; on money that is a real loss.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest libs/common/src/money.spec.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Export from the library barrel**

Replace the contents of `libs/common/src/index.ts` with:

```ts
export * from './money';
```

- [ ] **Step 6: Commit**

```bash
git add libs/common package.json
git commit -m "feat(common): add minor-unit money helpers"
```

---

### Task 3: Error codes and RPC exception helper

One vocabulary of failures, shared by the services that throw them and the gateway that maps them to HTTP.

**Files:**
- Create: `libs/common/src/errors.ts`
- Test: `libs/common/src/errors.spec.ts`
- Modify: `libs/common/src/index.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `ErrorCode` — const object and union type
  - `RpcErrorPayload { code: ErrorCode; message: string; details?: unknown }`
  - `AppRpcException` — an `RpcException` carrying an `RpcErrorPayload`
  - `httpStatusForCode(code: string): number`
  - `isRpcErrorPayload(value: unknown): value is RpcErrorPayload`

- [ ] **Step 1: Write the failing test**

Create `libs/common/src/errors.spec.ts`:

```ts
import { HttpStatus } from '@nestjs/common';
import {
  ErrorCode,
  AppRpcException,
  httpStatusForCode,
  isRpcErrorPayload,
} from './errors';

describe('errors', () => {
  it('carries a structured payload through RpcException', () => {
    const error = new AppRpcException(ErrorCode.INSUFFICIENT_FUNDS, 'Balance too low');
    expect(error.getError()).toEqual({
      code: 'INSUFFICIENT_FUNDS',
      message: 'Balance too low',
    });
  });

  it('includes details when supplied', () => {
    const error = new AppRpcException(ErrorCode.VALIDATION_FAILED, 'Bad input', {
      field: 'amount',
    });
    expect(error.getError()).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'Bad input',
      details: { field: 'amount' },
    });
  });

  it.each([
    [ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST],
    [ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED],
    [ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN],
    [ErrorCode.WALLET_NOT_FOUND, HttpStatus.NOT_FOUND],
    [ErrorCode.EMAIL_TAKEN, HttpStatus.CONFLICT],
    [ErrorCode.INSUFFICIENT_FUNDS, HttpStatus.UNPROCESSABLE_ENTITY],
    [ErrorCode.PROVIDER_DECLINED, HttpStatus.UNPROCESSABLE_ENTITY],
    [ErrorCode.PROVIDER_UNAVAILABLE, HttpStatus.BAD_GATEWAY],
    [ErrorCode.PROVIDER_TIMEOUT, HttpStatus.GATEWAY_TIMEOUT],
  ])('maps %s to %i', (code, status) => {
    expect(httpStatusForCode(code)).toBe(status);
  });

  it('maps an unknown code to 500', () => {
    expect(httpStatusForCode('SOMETHING_NEW')).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  describe('isRpcErrorPayload', () => {
    it('recognises a structured payload', () => {
      expect(isRpcErrorPayload({ code: 'UNAUTHORIZED', message: 'no' })).toBe(true);
    });

    it('rejects anything else', () => {
      expect(isRpcErrorPayload(null)).toBe(false);
      expect(isRpcErrorPayload('boom')).toBe(false);
      expect(isRpcErrorPayload(new Error('boom'))).toBe(false);
      expect(isRpcErrorPayload({ message: 'no code' })).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest libs/common/src/errors.spec.ts`
Expected: FAIL — `Cannot find module './errors'`.

- [ ] **Step 3: Write minimal implementation**

Create `libs/common/src/errors.ts`:

```ts
import { HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  WALLET_NOT_FOUND: 'WALLET_NOT_FOUND',
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  WALLET_EXISTS: 'WALLET_EXISTS',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  WALLET_INACTIVE: 'WALLET_INACTIVE',
  SELF_TRANSFER: 'SELF_TRANSFER',
  PROVIDER_DECLINED: 'PROVIDER_DECLINED',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface RpcErrorPayload {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

/**
 * Thrown inside microservices. Nest serializes the payload and the calling
 * ClientProxy rejects with the plain object — not with this class — so the
 * gateway identifies it structurally via isRpcErrorPayload.
 */
export class AppRpcException extends RpcException {
  constructor(code: ErrorCode, message: string, details?: unknown) {
    const payload: RpcErrorPayload = details === undefined
      ? { code, message }
      : { code, message, details };
    super(payload);
  }
}

const HTTP_STATUS_BY_CODE: Record<string, number> = {
  [ErrorCode.VALIDATION_FAILED]: HttpStatus.BAD_REQUEST,
  [ErrorCode.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [ErrorCode.USER_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.WALLET_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.TRANSACTION_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.NOTIFICATION_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.EMAIL_TAKEN]: HttpStatus.CONFLICT,
  [ErrorCode.WALLET_EXISTS]: HttpStatus.CONFLICT,
  [ErrorCode.INSUFFICIENT_FUNDS]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.CURRENCY_MISMATCH]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.WALLET_INACTIVE]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.SELF_TRANSFER]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.PROVIDER_DECLINED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.PROVIDER_UNAVAILABLE]: HttpStatus.BAD_GATEWAY,
  [ErrorCode.SERVICE_UNAVAILABLE]: HttpStatus.BAD_GATEWAY,
  [ErrorCode.PROVIDER_TIMEOUT]: HttpStatus.GATEWAY_TIMEOUT,
  [ErrorCode.NOT_IMPLEMENTED]: HttpStatus.NOT_IMPLEMENTED,
};

export function httpStatusForCode(code: string): number {
  return HTTP_STATUS_BY_CODE[code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
}

export function isRpcErrorPayload(value: unknown): value is RpcErrorPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    !(value instanceof Error) &&
    typeof (value as RpcErrorPayload).code === 'string' &&
    typeof (value as RpcErrorPayload).message === 'string'
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest libs/common/src/errors.spec.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Export from the barrel**

`libs/common/src/index.ts`:

```ts
export * from './money';
export * from './errors';
```

- [ ] **Step 6: Commit**

```bash
git add libs/common
git commit -m "feat(common): add error codes and rpc exception helper"
```

---

### Task 4: Transport configuration

The swap seam. Every listener and every client reads its address from here, so moving to RabbitMQ later changes this file and nothing else.

**Files:**
- Create: `libs/common/src/transport.config.ts`
- Test: `libs/common/src/transport.config.spec.ts`
- Modify: `libs/common/src/index.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type ServiceName = 'AUTH_SERVICE' | 'WALLET_SERVICE' | 'NOTIFICATION_SERVICE' | 'MOMO_SERVICE'`
  - `endpointFor(name: ServiceName): { host: string; port: number }`
  - `microserviceOptions(name: ServiceName): MicroserviceOptions`
  - `clientOptions(name: ServiceName): ClientProviderOptions`
  - `rpcTimeoutMs(): number`

**Note on a deliberate deviation from the spec:** the spec sketches `serviceEndpoints` as a `const` object. This task implements it as the function `endpointFor()` instead. A `const` evaluated at import time reads `process.env` before `ConfigModule` or a test has set anything, which makes it both untestable and wrong under Docker. The exported surface is otherwise exactly as specified.

- [ ] **Step 1: Write the failing test**

Create `libs/common/src/transport.config.spec.ts`:

```ts
import { Transport } from '@nestjs/microservices';
import {
  endpointFor,
  microserviceOptions,
  clientOptions,
  rpcTimeoutMs,
} from './transport.config';

describe('transport.config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AUTH_HOST;
    delete process.env.AUTH_PORT;
    delete process.env.RPC_TIMEOUT_MS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('falls back to documented defaults', () => {
    expect(endpointFor('AUTH_SERVICE')).toEqual({ host: 'localhost', port: 4001 });
    expect(endpointFor('WALLET_SERVICE')).toEqual({ host: 'localhost', port: 4002 });
    expect(endpointFor('NOTIFICATION_SERVICE')).toEqual({ host: 'localhost', port: 4003 });
    expect(endpointFor('MOMO_SERVICE')).toEqual({ host: 'localhost', port: 4004 });
  });

  it('reads the environment at call time, not at import time', () => {
    process.env.AUTH_HOST = 'auth-service';
    process.env.AUTH_PORT = '5001';
    expect(endpointFor('AUTH_SERVICE')).toEqual({ host: 'auth-service', port: 5001 });
  });

  it('ignores a non-numeric port and uses the default', () => {
    process.env.AUTH_PORT = 'not-a-port';
    expect(endpointFor('AUTH_SERVICE').port).toBe(4001);
  });

  it('builds TCP listener options', () => {
    expect(microserviceOptions('MOMO_SERVICE')).toEqual({
      transport: Transport.TCP,
      options: { host: 'localhost', port: 4004 },
    });
  });

  it('builds client options carrying the injection token as name', () => {
    expect(clientOptions('WALLET_SERVICE')).toEqual({
      name: 'WALLET_SERVICE',
      transport: Transport.TCP,
      options: { host: 'localhost', port: 4002 },
    });
  });

  it('defaults the rpc timeout to 5000ms and honours an override', () => {
    expect(rpcTimeoutMs()).toBe(5000);
    process.env.RPC_TIMEOUT_MS = '250';
    expect(rpcTimeoutMs()).toBe(250);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest libs/common/src/transport.config.spec.ts`
Expected: FAIL — `Cannot find module './transport.config'`.

- [ ] **Step 3: Write minimal implementation**

Create `libs/common/src/transport.config.ts`:

```ts
import {
  ClientProviderOptions,
  MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';

export type ServiceName =
  | 'AUTH_SERVICE'
  | 'WALLET_SERVICE'
  | 'NOTIFICATION_SERVICE'
  | 'MOMO_SERVICE';

interface EndpointDefaults {
  hostVar: string;
  portVar: string;
  port: number;
}

const DEFAULTS: Record<ServiceName, EndpointDefaults> = {
  AUTH_SERVICE: { hostVar: 'AUTH_HOST', portVar: 'AUTH_PORT', port: 4001 },
  WALLET_SERVICE: { hostVar: 'WALLET_HOST', portVar: 'WALLET_PORT', port: 4002 },
  NOTIFICATION_SERVICE: {
    hostVar: 'NOTIFICATION_HOST',
    portVar: 'NOTIFICATION_PORT',
    port: 4003,
  },
  MOMO_SERVICE: { hostVar: 'MOMO_HOST', portVar: 'MOMO_PORT', port: 4004 },
};

function readString(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.length > 0 ? value : fallback;
}

function readInt(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

/** Read at call time so ConfigModule and tests can influence the result. */
export function endpointFor(name: ServiceName): { host: string; port: number } {
  const spec = DEFAULTS[name];
  return {
    host: readString(spec.hostVar, 'localhost'),
    port: readInt(spec.portVar, spec.port),
  };
}

export function microserviceOptions(name: ServiceName): MicroserviceOptions {
  return { transport: Transport.TCP, options: endpointFor(name) };
}

export function clientOptions(name: ServiceName): ClientProviderOptions {
  return { name, transport: Transport.TCP, options: endpointFor(name) };
}

export function rpcTimeoutMs(): number {
  return readInt('RPC_TIMEOUT_MS', 5000);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest libs/common/src/transport.config.spec.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Export from the barrel**

`libs/common/src/index.ts`:

```ts
export * from './money';
export * from './errors';
export * from './transport.config';
```

- [ ] **Step 6: Commit**

```bash
git add libs/common
git commit -m "feat(common): add transport config seam"
```

---

### Task 5: Contracts — patterns, tokens and DTOs

The only code shared across service boundaries.

**Files:**
- Create: `libs/contracts/src/patterns.ts`, `tokens.ts`, `base.dto.ts`
- Create: `libs/contracts/src/auth/index.ts`, `wallet/index.ts`, `notification/index.ts`, `momo/index.ts`
- Test: `libs/contracts/src/patterns.spec.ts`, `libs/contracts/src/dto.spec.ts`
- Modify: `libs/contracts/src/index.ts`
- Delete: `libs/contracts/src/contracts.module.ts`, `contracts.service.ts`, `contracts.service.spec.ts` (generator scaffold)

**Interfaces:**
- Consumes: `AMOUNT_PATTERN` from `@app/common`
- Produces: `AUTH_PATTERNS`, `WALLET_PATTERNS`, `NOTIFICATION_PATTERNS`, `MOMO_PATTERNS`, `HEALTH_PATTERNS`, `SERVICE_TOKENS`, `BaseMessageDto`, and every DTO and view type named below. Tasks 7–11 import exclusively from here.

- [ ] **Step 1: Write the failing pattern test**

Create `libs/contracts/src/patterns.spec.ts`:

```ts
import {
  AUTH_PATTERNS,
  WALLET_PATTERNS,
  NOTIFICATION_PATTERNS,
  MOMO_PATTERNS,
  HEALTH_PATTERNS,
  ALL_PATTERNS,
} from './patterns';

describe('patterns', () => {
  it('namespaces every pattern by its owning service', () => {
    Object.values(AUTH_PATTERNS).forEach((p) => expect(p).toMatch(/^auth\./));
    Object.values(WALLET_PATTERNS).forEach((p) => expect(p).toMatch(/^wallet\./));
    Object.values(NOTIFICATION_PATTERNS).forEach((p) =>
      expect(p).toMatch(/^notification\./),
    );
    Object.values(MOMO_PATTERNS).forEach((p) => expect(p).toMatch(/^momo\./));
  });

  it('has no duplicate pattern strings across services', () => {
    expect(new Set(ALL_PATTERNS).size).toBe(ALL_PATTERNS.length);
  });

  it('defines a health pattern for every service token', () => {
    expect(HEALTH_PATTERNS).toEqual({
      AUTH_SERVICE: 'auth.health',
      WALLET_SERVICE: 'wallet.health',
      NOTIFICATION_SERVICE: 'notification.health',
      MOMO_SERVICE: 'momo.health',
    });
  });
});
```

A duplicate pattern string across two services routes a message to the wrong handler and is almost impossible to debug by reading logs. This test costs nothing and rules it out permanently.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest libs/contracts/src/patterns.spec.ts`
Expected: FAIL — `Cannot find module './patterns'`.

- [ ] **Step 3: Write the patterns and tokens**

Create `libs/contracts/src/patterns.ts`:

```ts
export const AUTH_PATTERNS = {
  health: 'auth.health',
  register: 'auth.register',
  login: 'auth.login',
  validateToken: 'auth.validate_token',
  getUser: 'auth.get_user',
  findByEmail: 'auth.find_by_email',
} as const;

export const WALLET_PATTERNS = {
  health: 'wallet.health',
  create: 'wallet.create',
  list: 'wallet.list',
  getBalance: 'wallet.get_balance',
  deposit: 'wallet.deposit',
  transfer: 'wallet.transfer',
  history: 'wallet.history',
} as const;

export const NOTIFICATION_PATTERNS = {
  health: 'notification.health',
  send: 'notification.send',
  list: 'notification.list',
  markRead: 'notification.mark_read',
} as const;

export const MOMO_PATTERNS = {
  health: 'momo.health',
  charge: 'momo.charge',
  payout: 'momo.payout',
  status: 'momo.status',
} as const;

export const HEALTH_PATTERNS = {
  AUTH_SERVICE: AUTH_PATTERNS.health,
  WALLET_SERVICE: WALLET_PATTERNS.health,
  NOTIFICATION_SERVICE: NOTIFICATION_PATTERNS.health,
  MOMO_SERVICE: MOMO_PATTERNS.health,
} as const;

export const ALL_PATTERNS: string[] = [
  ...Object.values(AUTH_PATTERNS),
  ...Object.values(WALLET_PATTERNS),
  ...Object.values(NOTIFICATION_PATTERNS),
  ...Object.values(MOMO_PATTERNS),
];
```

Create `libs/contracts/src/tokens.ts`:

```ts
import type { ServiceName } from '@app/common';

/** Injection tokens for ClientsModule. Identical to the ServiceName union. */
export const SERVICE_TOKENS: Record<ServiceName, ServiceName> = {
  AUTH_SERVICE: 'AUTH_SERVICE',
  WALLET_SERVICE: 'WALLET_SERVICE',
  NOTIFICATION_SERVICE: 'NOTIFICATION_SERVICE',
  MOMO_SERVICE: 'MOMO_SERVICE',
};

export type { ServiceName };

export interface HealthReport {
  service: string;
  status: 'ok';
}
```

- [ ] **Step 4: Run the pattern test to verify it passes**

Run: `pnpm jest libs/contracts/src/patterns.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the failing DTO test**

Create `libs/contracts/src/dto.spec.ts`:

```ts
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterDto } from './auth';
import { DepositDto, TransferDto } from './wallet';

function errorsFor<T extends object>(cls: new () => T, payload: object): string[] {
  const instance = plainToInstance(cls, payload);
  return validateSync(instance).map((e) => e.property);
}

describe('contract DTOs', () => {
  it('accepts a valid registration', () => {
    expect(
      errorsFor(RegisterDto, {
        email: 'ada@example.com',
        password: 'correct-horse',
        fullName: 'Ada Lovelace',
      }),
    ).toEqual([]);
  });

  it('rejects a bad email and a short password', () => {
    const errors = errorsFor(RegisterDto, {
      email: 'not-an-email',
      password: 'short',
      fullName: 'Ada Lovelace',
    });
    expect(errors).toContain('email');
    expect(errors).toContain('password');
  });

  it('accepts a well-formed deposit', () => {
    expect(
      errorsFor(DepositDto, {
        walletId: '11111111-1111-4111-8111-111111111111',
        userId: '22222222-2222-4222-8222-222222222222',
        amount: '1500.50',
        msisdn: '237600000001',
        idempotencyKey: 'dep-1',
      }),
    ).toEqual([]);
  });

  it('rejects an amount with three decimal places', () => {
    const errors = errorsFor(DepositDto, {
      walletId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      amount: '1500.505',
      msisdn: '237600000001',
      idempotencyKey: 'dep-1',
    });
    expect(errors).toContain('amount');
  });

  it('rejects a transfer with no recipient email', () => {
    const errors = errorsFor(TransferDto, {
      fromUserId: '22222222-2222-4222-8222-222222222222',
      toEmail: 'nope',
      amount: '10.00',
      idempotencyKey: 'tr-1',
    });
    expect(errors).toContain('toEmail');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm jest libs/contracts/src/dto.spec.ts`
Expected: FAIL — `Cannot find module './auth'`.

- [ ] **Step 7: Write the base DTO**

Create `libs/contracts/src/base.dto.ts`:

```ts
import { IsOptional, IsString } from 'class-validator';

/** Every message carries a correlation id, generated at the gateway. */
export class BaseMessageDto {
  @IsOptional()
  @IsString()
  correlationId?: string;
}
```

- [ ] **Step 8: Write the auth contracts**

Create `libs/contracts/src/auth/index.ts`:

```ts
import { IsEmail, IsNotEmpty, IsString, IsUUID, MinLength } from 'class-validator';
import { BaseMessageDto } from '../base.dto';

export class RegisterDto extends BaseMessageDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @IsNotEmpty() fullName!: string;
}

export class LoginDto extends BaseMessageDto {
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() password!: string;
}

export class FindByEmailDto extends BaseMessageDto {
  @IsEmail() email!: string;
}

export class GetUserDto extends BaseMessageDto {
  @IsUUID() userId!: string;
}

export class ValidateTokenDto extends BaseMessageDto {
  @IsString() @IsNotEmpty() token!: string;
}

export interface UserView {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface TokenClaims {
  userId: string;
  email: string;
}
```

- [ ] **Step 9: Write the wallet contracts**

Create `libs/contracts/src/wallet/index.ts`:

```ts
import { AMOUNT_PATTERN } from '@app/common';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { BaseMessageDto } from '../base.dto';

export const DEFAULT_CURRENCY = 'XAF';

export class CreateWalletDto extends BaseMessageDto {
  @IsUUID() userId!: string;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
}

export class ListWalletsDto extends BaseMessageDto {
  @IsUUID() userId!: string;
}

export class GetBalanceDto extends BaseMessageDto {
  @IsUUID() userId!: string;
  @IsUUID() walletId!: string;
}

export class DepositDto extends BaseMessageDto {
  @IsUUID() walletId!: string;
  @IsUUID() userId!: string;
  @Matches(AMOUNT_PATTERN, { message: 'amount must be a decimal string with at most 2 places' })
  amount!: string;
  @IsString() @IsNotEmpty() msisdn!: string;
  @IsString() @IsNotEmpty() idempotencyKey!: string;
}

export class TransferDto extends BaseMessageDto {
  @IsUUID() fromUserId!: string;
  @IsEmail() toEmail!: string;
  @Matches(AMOUNT_PATTERN, { message: 'amount must be a decimal string with at most 2 places' })
  amount!: string;
  @IsString() @IsNotEmpty() idempotencyKey!: string;
}

export class HistoryDto extends BaseMessageDto {
  @IsUUID() userId!: string;
  @IsUUID() walletId!: string;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
}

export type TxType = 'DEPOSIT' | 'TRANSFER_IN' | 'TRANSFER_OUT';
export type TxStatus = 'PENDING' | 'COMPLETED' | 'FAILED';
export type WalletStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';

/** balance is a decimal string: BigInt cannot be JSON-serialized. */
export interface WalletView {
  id: string;
  userId: string;
  currency: string;
  balance: string;
  status: WalletStatus;
  createdAt: string;
}

export interface TransactionView {
  id: string;
  walletId: string;
  type: TxType;
  status: TxStatus;
  amount: string;
  balanceAfter: string | null;
  counterpartyWalletId: string | null;
  providerRef: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface HistoryPage {
  items: TransactionView[];
  nextCursor: string | null;
}
```

- [ ] **Step 10: Write the notification contracts**

Create `libs/contracts/src/notification/index.ts`:

```ts
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { BaseMessageDto } from '../base.dto';

export class SendNotificationDto extends BaseMessageDto {
  @IsUUID() userId!: string;
  @IsString() @IsNotEmpty() type!: string;
  @IsString() @IsNotEmpty() title!: string;
  @IsString() @IsNotEmpty() body!: string;
}

export class ListNotificationsDto extends BaseMessageDto {
  @IsUUID() userId!: string;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
}

export class MarkReadDto extends BaseMessageDto {
  @IsUUID() userId!: string;
  @IsUUID() notificationId!: string;
}

export interface NotificationView {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  items: NotificationView[];
  nextCursor: string | null;
}
```

- [ ] **Step 11: Write the momo contracts**

Create `libs/contracts/src/momo/index.ts`:

```ts
import { AMOUNT_PATTERN } from '@app/common';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { BaseMessageDto } from '../base.dto';

export class ChargeDto extends BaseMessageDto {
  @IsString() @IsNotEmpty() msisdn!: string;
  @Matches(AMOUNT_PATTERN) amount!: string;
  @IsString() @IsNotEmpty() reference!: string;
}

export class PayoutDto extends BaseMessageDto {
  @IsString() @IsNotEmpty() msisdn!: string;
  @Matches(AMOUNT_PATTERN) amount!: string;
  @IsString() @IsNotEmpty() reference!: string;
}

export class ProviderStatusDto extends BaseMessageDto {
  @IsString() @IsNotEmpty() providerRef!: string;
}

export type ProviderOutcome = 'SUCCESS' | 'PENDING' | 'DECLINED';

export interface ProviderResult {
  providerRef: string;
  outcome: ProviderOutcome;
  reason: string | null;
}
```

- [ ] **Step 12: Replace the contracts barrel and delete the generator scaffold**

`libs/contracts/src/index.ts`:

```ts
export * from './patterns';
export * from './tokens';
export * from './base.dto';
export * from './auth';
export * from './wallet';
export * from './notification';
export * from './momo';
```

```bash
rm -f libs/contracts/src/contracts.module.ts \
      libs/contracts/src/contracts.service.ts \
      libs/contracts/src/contracts.service.spec.ts \
      libs/common/src/common.module.ts \
      libs/common/src/common.service.ts \
      libs/common/src/common.service.spec.ts
```

- [ ] **Step 13: Run all library tests to verify they pass**

Run: `pnpm jest libs/`
Expected: PASS — all of money, errors, transport.config, patterns and dto.

- [ ] **Step 14: Commit**

```bash
git add libs/contracts libs/common
git commit -m "feat(contracts): add message patterns, tokens and dtos"
```

---

### Task 6: Postgres, Prisma schemas and migrations

One container, four private schemas, four generated clients.

**Files:**
- Create: `docker-compose.yml`, `.env.example`
- Create: `prisma/auth/schema.prisma`, `prisma/wallet/schema.prisma`, `prisma/notification/schema.prisma`, `prisma/momo/schema.prisma`

**Interfaces:**
- Consumes: nothing
- Produces: the generated clients importable as `@db/auth`, `@db/wallet`, `@db/notification`, `@db/momo`, each exporting `PrismaClient` and its model types. Tasks 7–10 import these.

- [ ] **Step 1: Write the compose file**

Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: payflow-postgres
    environment:
      POSTGRES_USER: payflow
      POSTGRES_PASSWORD: payflow
      POSTGRES_DB: payflow
    ports:
      - '5432:5432'
    volumes:
      - payflow-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U payflow -d payflow']
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  payflow-pgdata:
```

- [ ] **Step 2: Write the env template**

Create `.env.example`:

```dotenv
# One Postgres instance; each service owns a private schema inside it.
AUTH_DATABASE_URL=postgresql://payflow:payflow@localhost:5432/payflow?schema=auth
WALLET_DATABASE_URL=postgresql://payflow:payflow@localhost:5432/payflow?schema=wallet
NOTIFICATION_DATABASE_URL=postgresql://payflow:payflow@localhost:5432/payflow?schema=notification
MOMO_DATABASE_URL=postgresql://payflow:payflow@localhost:5432/payflow?schema=momo

# Auth
JWT_SECRET=dev-only-change-me
JWT_EXPIRES_IN=3600

# Gateway
GATEWAY_PORT=3000

# Service endpoints
AUTH_HOST=localhost
AUTH_PORT=4001
WALLET_HOST=localhost
WALLET_PORT=4002
NOTIFICATION_HOST=localhost
NOTIFICATION_PORT=4003
MOMO_HOST=localhost
MOMO_PORT=4004

RPC_TIMEOUT_MS=5000
```

Then `cp .env.example .env`. `.env` is gitignored (Task 1, Step 9).

- [ ] **Step 3: Write the auth schema**

Create `prisma/auth/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../../node_modules/@db/auth"
}

datasource db {
  provider = "postgresql"
  url      = env("AUTH_DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  fullName     String
  createdAt    DateTime @default(now())
}
```

- [ ] **Step 4: Write the wallet schema**

Create `prisma/wallet/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../../node_modules/@db/wallet"
}

datasource db {
  provider = "postgresql"
  url      = env("WALLET_DATABASE_URL")
}

enum WalletStatus {
  ACTIVE
  FROZEN
  CLOSED
}

enum TxType {
  DEPOSIT
  TRANSFER_IN
  TRANSFER_OUT
}

enum TxStatus {
  PENDING
  COMPLETED
  FAILED
}

model Wallet {
  id           String       @id @default(uuid())
  userId       String
  currency     String       @default("XAF")
  balanceMinor BigInt       @default(0)
  status       WalletStatus @default(ACTIVE)
  createdAt    DateTime     @default(now())
  transactions Transaction[]

  @@unique([userId, currency])
}

model Transaction {
  id                   String   @id @default(uuid())
  walletId             String
  wallet               Wallet   @relation(fields: [walletId], references: [id])
  type                 TxType
  status               TxStatus
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

`userId` is deliberately a plain `String` and not a foreign key — the user lives in another service's schema, and a cross-schema FK would break service independence.

- [ ] **Step 5: Write the notification schema**

Create `prisma/notification/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../../node_modules/@db/notification"
}

datasource db {
  provider = "postgresql"
  url      = env("NOTIFICATION_DATABASE_URL")
}

model Notification {
  id        String    @id @default(uuid())
  userId    String
  type      String
  title     String
  body      String
  readAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId, createdAt])
}
```

- [ ] **Step 6: Write the momo schema**

Create `prisma/momo/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../../node_modules/@db/momo"
}

datasource db {
  provider = "postgresql"
  url      = env("MOMO_DATABASE_URL")
}

model ProviderAccount {
  msisdn       String   @id
  balanceMinor BigInt   @default(1000000)
  createdAt    DateTime @default(now())
}

model ProviderCharge {
  providerRef String   @id
  msisdn      String
  amountMinor BigInt
  reference   String   @unique
  outcome     String
  reason      String?
  createdAt   DateTime @default(now())
}
```

- [ ] **Step 7: Start Postgres and run the migrations**

```bash
docker compose up -d postgres
docker compose exec postgres pg_isready -U payflow -d payflow
pnpm prisma:migrate
```

When prompted for a migration name, use `init` for each of the four.

- [ ] **Step 8: Verify all four schemas and their tables exist**

```bash
docker compose exec postgres psql -U payflow -d payflow -c "\dt auth.*; \dt wallet.*; \dt notification.*; \dt momo.*"
```

Expected: `auth.User`; `wallet.Wallet` and `wallet.Transaction`; `notification.Notification`; `momo.ProviderAccount` and `momo.ProviderCharge`.

- [ ] **Step 9: Verify the clients generated and are reachable by alias**

```bash
pnpm prisma:generate
ls node_modules/@db
node -e "const {PrismaClient}=require('@db/wallet'); console.log(typeof PrismaClient)"
```

Expected: `ls` shows `auth wallet notification momo`, and the node call prints `function`. The `require` uses the bare specifier deliberately — that is the thing that has to work at runtime.

Note that `pnpm install` can prune these, since nothing in `package.json` declares them. Re-running `pnpm prisma:generate` restores them; this is the same arrangement Prisma uses by default with `node_modules/.prisma/client`.

- [ ] **Step 10: Commit**

```bash
git add docker-compose.yml .env.example prisma
git commit -m "feat(db): add postgres compose and per-service prisma schemas"
```

---

### Task 7: momo-sim service

A leaf service with no outbound dependencies — the simplest end-to-end proof that a microservice boots, listens and answers.

**Files:**
- Create: `apps/momo-sim/src/prisma.service.ts`, `momo.service.ts`, `momo.controller.ts`
- Modify: `apps/momo-sim/src/main.ts`, `apps/momo-sim/src/momo-sim.module.ts`
- Test: `apps/momo-sim/src/momo.controller.spec.ts`
- Delete: `apps/momo-sim/src/momo-sim.controller.ts`, `momo-sim.service.ts`, `momo-sim.controller.spec.ts`

**Interfaces:**
- Consumes: `MOMO_PATTERNS`, `ChargeDto`, `PayoutDto`, `ProviderStatusDto`, `ProviderResult`, `HealthReport` from `@app/contracts`; `microserviceOptions` from `@app/common`
- Produces: a TCP listener on port 4004 answering `momo.health`, `momo.charge`, `momo.payout`, `momo.status`

- [ ] **Step 1: Write the failing test**

Create `apps/momo-sim/src/momo.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { MomoController } from './momo.controller';
import { MomoService } from './momo.service';
import { PrismaService } from './prisma.service';

describe('MomoController', () => {
  let controller: MomoController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MomoController],
      providers: [MomoService, { provide: PrismaService, useValue: {} }],
    }).compile();

    controller = moduleRef.get(MomoController);
  });

  it('reports health without touching the database', () => {
    expect(controller.health()).toEqual({ service: 'momo-sim', status: 'ok' });
  });

  it('returns a typed stub for charge', async () => {
    const result = await controller.charge({
      msisdn: '237600000001',
      amount: '10.00',
      reference: 'ref-1',
    });
    expect(result).toMatchObject({ outcome: 'SUCCESS', reason: null });
    expect(typeof result.providerRef).toBe('string');
  });

  it('returns a typed stub for payout', async () => {
    const result = await controller.payout({
      msisdn: '237600000001',
      amount: '10.00',
      reference: 'ref-2',
    });
    expect(result.outcome).toBe('SUCCESS');
  });

  it('returns a typed stub for status', async () => {
    const result = await controller.status({ providerRef: 'pr-1' });
    expect(result.providerRef).toBe('pr-1');
    expect(result.outcome).toBe('SUCCESS');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest apps/momo-sim`
Expected: FAIL — `Cannot find module './momo.controller'`.

- [ ] **Step 3: Write the Prisma service**

Create `apps/momo-sim/src/prisma.service.ts`:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@db/momo';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

- [ ] **Step 4: Write the business service with stubbed behaviour**

Create `apps/momo-sim/src/momo.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ChargeDto, PayoutDto, ProviderStatusDto, ProviderResult } from '@app/contracts';

/**
 * Skeleton stub. Milestone 3 replaces these bodies with the MSISDN-suffix
 * behaviour table from the spec (00 declined, 99 timeout, 11 pending) and
 * per-account balance enforcement, backed by PrismaService.
 */
@Injectable()
export class MomoService {
  async charge(dto: ChargeDto): Promise<ProviderResult> {
    return { providerRef: `chg_${randomUUID()}`, outcome: 'SUCCESS', reason: null };
  }

  async payout(dto: PayoutDto): Promise<ProviderResult> {
    return { providerRef: `pay_${randomUUID()}`, outcome: 'SUCCESS', reason: null };
  }

  async status(dto: ProviderStatusDto): Promise<ProviderResult> {
    return { providerRef: dto.providerRef, outcome: 'SUCCESS', reason: null };
  }
}
```

- [ ] **Step 5: Write the message controller**

Create `apps/momo-sim/src/momo.controller.ts`:

```ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  MOMO_PATTERNS,
  ChargeDto,
  PayoutDto,
  ProviderStatusDto,
  type ProviderResult,
  type HealthReport,
} from '@app/contracts';
import { MomoService } from './momo.service';

/** Handlers unwrap the payload and delegate. No business logic lives here. */
@Controller()
export class MomoController {
  constructor(private readonly momo: MomoService) {}

  @MessagePattern(MOMO_PATTERNS.health)
  health(): HealthReport {
    return { service: 'momo-sim', status: 'ok' };
  }

  @MessagePattern(MOMO_PATTERNS.charge)
  charge(@Payload() dto: ChargeDto): Promise<ProviderResult> {
    return this.momo.charge(dto);
  }

  @MessagePattern(MOMO_PATTERNS.payout)
  payout(@Payload() dto: PayoutDto): Promise<ProviderResult> {
    return this.momo.payout(dto);
  }

  @MessagePattern(MOMO_PATTERNS.status)
  status(@Payload() dto: ProviderStatusDto): Promise<ProviderResult> {
    return this.momo.status(dto);
  }
}
```

- [ ] **Step 6: Wire the module**

Replace `apps/momo-sim/src/momo-sim.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MomoController } from './momo.controller';
import { MomoService } from './momo.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [MomoController],
  providers: [MomoService, PrismaService],
})
export class MomoSimModule {}
```

- [ ] **Step 7: Write the bootstrap**

Replace `apps/momo-sim/src/main.ts`:

```ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { microserviceOptions } from '@app/common';
import { MomoSimModule } from './momo-sim.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    MomoSimModule,
    microserviceOptions('MOMO_SERVICE'),
  );
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  await app.listen();
}
void bootstrap();
```

The service validates its own message payloads, because a message can arrive from something other than the gateway.

- [ ] **Step 8: Delete the generator scaffold**

```bash
rm -f apps/momo-sim/src/momo-sim.controller.ts \
      apps/momo-sim/src/momo-sim.service.ts \
      apps/momo-sim/src/momo-sim.controller.spec.ts
```

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm jest apps/momo-sim`
Expected: PASS, 4 tests.

- [ ] **Step 10: Verify it boots and listens**

```bash
pnpm nest start momo-sim &
sleep 4 && nc -z localhost 4004 && echo "momo-sim listening on 4004"
kill %1
```

Expected: `momo-sim listening on 4004`.

- [ ] **Step 11: Commit**

```bash
git add apps/momo-sim
git commit -m "feat(momo-sim): add provider simulator service skeleton"
```

---

### Task 8: notification-service

**Files:**
- Create: `apps/notification-service/src/prisma.service.ts`, `notification.service.ts`, `notification.controller.ts`
- Modify: `apps/notification-service/src/main.ts`, `notification-service.module.ts`
- Test: `apps/notification-service/src/notification.controller.spec.ts`
- Delete: the generator's `notification-service.controller.ts`, `notification-service.service.ts`, `notification-service.controller.spec.ts`

**Interfaces:**
- Consumes: `NOTIFICATION_PATTERNS`, `SendNotificationDto`, `ListNotificationsDto`, `MarkReadDto`, `NotificationView`, `NotificationPage`, `HealthReport` from `@app/contracts`; `microserviceOptions` from `@app/common`
- Produces: a TCP listener on 4003 answering `notification.health`, `notification.send`, `notification.list`, `notification.mark_read`

- [ ] **Step 1: Write the failing test**

Create `apps/notification-service/src/notification.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { PrismaService } from './prisma.service';

const USER_ID = '22222222-2222-4222-8222-222222222222';

describe('NotificationController', () => {
  let controller: NotificationController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = moduleRef.get(NotificationController);
  });

  it('reports health', () => {
    expect(controller.health()).toEqual({
      service: 'notification-service',
      status: 'ok',
    });
  });

  it('returns a typed stub for send', async () => {
    const result = await controller.send({
      userId: USER_ID,
      type: 'DEPOSIT_COMPLETED',
      title: 'Deposit received',
      body: 'Your deposit completed.',
    });
    expect(result).toMatchObject({
      userId: USER_ID,
      type: 'DEPOSIT_COMPLETED',
      readAt: null,
    });
  });

  it('returns an empty page for list', async () => {
    expect(await controller.list({ userId: USER_ID })).toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it('returns a typed stub for markRead', async () => {
    const result = await controller.markRead({
      userId: USER_ID,
      notificationId: '33333333-3333-4333-8333-333333333333',
    });
    expect(result.readAt).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest apps/notification-service`
Expected: FAIL — `Cannot find module './notification.controller'`.

- [ ] **Step 3: Write the Prisma service**

Create `apps/notification-service/src/prisma.service.ts`:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@db/notification';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

- [ ] **Step 4: Write the business service with stubbed behaviour**

Create `apps/notification-service/src/notification.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  SendNotificationDto,
  ListNotificationsDto,
  MarkReadDto,
  NotificationView,
  NotificationPage,
} from '@app/contracts';

/** Skeleton stub. Milestone 6 replaces these bodies with PrismaService calls. */
@Injectable()
export class NotificationService {
  async send(dto: SendNotificationDto): Promise<NotificationView> {
    return {
      id: randomUUID(),
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      body: dto.body,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
  }

  async list(dto: ListNotificationsDto): Promise<NotificationPage> {
    return { items: [], nextCursor: null };
  }

  async markRead(dto: MarkReadDto): Promise<NotificationView> {
    const now = new Date().toISOString();
    return {
      id: dto.notificationId,
      userId: dto.userId,
      type: 'STUB',
      title: 'Stub notification',
      body: 'Replaced in milestone 6.',
      readAt: now,
      createdAt: now,
    };
  }
}
```

- [ ] **Step 5: Write the message controller**

Create `apps/notification-service/src/notification.controller.ts`:

```ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  NOTIFICATION_PATTERNS,
  SendNotificationDto,
  ListNotificationsDto,
  MarkReadDto,
  type NotificationView,
  type NotificationPage,
  type HealthReport,
} from '@app/contracts';
import { NotificationService } from './notification.service';

@Controller()
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @MessagePattern(NOTIFICATION_PATTERNS.health)
  health(): HealthReport {
    return { service: 'notification-service', status: 'ok' };
  }

  @MessagePattern(NOTIFICATION_PATTERNS.send)
  send(@Payload() dto: SendNotificationDto): Promise<NotificationView> {
    return this.notifications.send(dto);
  }

  @MessagePattern(NOTIFICATION_PATTERNS.list)
  list(@Payload() dto: ListNotificationsDto): Promise<NotificationPage> {
    return this.notifications.list(dto);
  }

  @MessagePattern(NOTIFICATION_PATTERNS.markRead)
  markRead(@Payload() dto: MarkReadDto): Promise<NotificationView> {
    return this.notifications.markRead(dto);
  }
}
```

- [ ] **Step 6: Wire the module**

Replace `apps/notification-service/src/notification-service.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [NotificationController],
  providers: [NotificationService, PrismaService],
})
export class NotificationServiceModule {}
```

- [ ] **Step 7: Write the bootstrap**

Replace `apps/notification-service/src/main.ts`:

```ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { microserviceOptions } from '@app/common';
import { NotificationServiceModule } from './notification-service.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    NotificationServiceModule,
    microserviceOptions('NOTIFICATION_SERVICE'),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen();
}
void bootstrap();
```

- [ ] **Step 8: Delete the generator scaffold**

```bash
rm -f apps/notification-service/src/notification-service.controller.ts \
      apps/notification-service/src/notification-service.service.ts \
      apps/notification-service/src/notification-service.controller.spec.ts
```

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm jest apps/notification-service`
Expected: PASS, 4 tests.

- [ ] **Step 10: Commit**

```bash
git add apps/notification-service
git commit -m "feat(notification): add notification service skeleton"
```

---

### Task 9: auth-service

**Files:**
- Create: `apps/auth-service/src/prisma.service.ts`, `auth.service.ts`, `auth.controller.ts`
- Modify: `apps/auth-service/src/main.ts`, `auth-service.module.ts`
- Test: `apps/auth-service/src/auth.controller.spec.ts`
- Delete: the generator's `auth-service.controller.ts`, `auth-service.service.ts`, `auth-service.controller.spec.ts`

**Interfaces:**
- Consumes: `AUTH_PATTERNS`, `RegisterDto`, `LoginDto`, `FindByEmailDto`, `GetUserDto`, `ValidateTokenDto`, `UserView`, `AuthTokens`, `TokenClaims`, `HealthReport` from `@app/contracts`; `microserviceOptions` from `@app/common`
- Produces: a TCP listener on 4001 answering `auth.health`, `auth.register`, `auth.login`, `auth.validate_token`, `auth.get_user`, `auth.find_by_email`

- [ ] **Step 1: Write the failing test**

Create `apps/auth-service/src/auth.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from './prisma.service';

const USER_ID = '22222222-2222-4222-8222-222222222222';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [AuthController],
      providers: [AuthService, { provide: PrismaService, useValue: {} }],
    }).compile();

    controller = moduleRef.get(AuthController);
  });

  it('reports health', () => {
    expect(controller.health()).toEqual({ service: 'auth-service', status: 'ok' });
  });

  it('returns a typed stub for register and never echoes the password', async () => {
    const result = await controller.register({
      email: 'ada@example.com',
      password: 'correct-horse',
      fullName: 'Ada Lovelace',
    });
    expect(result).toMatchObject({
      email: 'ada@example.com',
      fullName: 'Ada Lovelace',
    });
    expect(JSON.stringify(result)).not.toContain('correct-horse');
  });

  it('returns a token for login', async () => {
    const result = await controller.login({
      email: 'ada@example.com',
      password: 'correct-horse',
    });
    expect(typeof result.accessToken).toBe('string');
    expect(result.expiresIn).toBeGreaterThan(0);
  });

  it('returns claims for validateToken', async () => {
    expect(await controller.validateToken({ token: 'stub' })).toMatchObject({
      userId: expect.any(String),
      email: expect.any(String),
    });
  });

  it('returns a typed stub for getUser', async () => {
    expect((await controller.getUser({ userId: USER_ID })).id).toBe(USER_ID);
  });

  it('returns a typed stub for findByEmail', async () => {
    expect((await controller.findByEmail({ email: 'ada@example.com' })).email).toBe(
      'ada@example.com',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest apps/auth-service`
Expected: FAIL — `Cannot find module './auth.controller'`.

- [ ] **Step 3: Write the Prisma service**

Create `apps/auth-service/src/prisma.service.ts`:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@db/auth';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

- [ ] **Step 4: Write the business service with stubbed behaviour**

Create `apps/auth-service/src/auth.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type {
  RegisterDto,
  LoginDto,
  FindByEmailDto,
  GetUserDto,
  ValidateTokenDto,
  UserView,
  AuthTokens,
  TokenClaims,
} from '@app/contracts';

/**
 * Skeleton stub. Milestone 1 replaces these bodies with bcrypt hashing and
 * PrismaService lookups. The shapes returned here are already final.
 */
@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  private stubUser(id: string, email: string): UserView {
    return { id, email, fullName: 'Stub User', createdAt: new Date().toISOString() };
  }

  async register(dto: RegisterDto): Promise<UserView> {
    return {
      id: randomUUID(),
      email: dto.email,
      fullName: dto.fullName,
      createdAt: new Date().toISOString(),
    };
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const expiresIn = Number(process.env.JWT_EXPIRES_IN ?? 3600);
    const claims: TokenClaims = { userId: randomUUID(), email: dto.email };
    return { accessToken: await this.jwt.signAsync(claims, { expiresIn }), expiresIn };
  }

  async validateToken(dto: ValidateTokenDto): Promise<TokenClaims> {
    return { userId: randomUUID(), email: 'stub@example.com' };
  }

  async getUser(dto: GetUserDto): Promise<UserView> {
    return this.stubUser(dto.userId, 'stub@example.com');
  }

  async findByEmail(dto: FindByEmailDto): Promise<UserView> {
    return this.stubUser(randomUUID(), dto.email);
  }
}
```

- [ ] **Step 5: Write the message controller**

Create `apps/auth-service/src/auth.controller.ts`:

```ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AUTH_PATTERNS,
  RegisterDto,
  LoginDto,
  FindByEmailDto,
  GetUserDto,
  ValidateTokenDto,
  type UserView,
  type AuthTokens,
  type TokenClaims,
  type HealthReport,
} from '@app/contracts';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @MessagePattern(AUTH_PATTERNS.health)
  health(): HealthReport {
    return { service: 'auth-service', status: 'ok' };
  }

  @MessagePattern(AUTH_PATTERNS.register)
  register(@Payload() dto: RegisterDto): Promise<UserView> {
    return this.auth.register(dto);
  }

  @MessagePattern(AUTH_PATTERNS.login)
  login(@Payload() dto: LoginDto): Promise<AuthTokens> {
    return this.auth.login(dto);
  }

  @MessagePattern(AUTH_PATTERNS.validateToken)
  validateToken(@Payload() dto: ValidateTokenDto): Promise<TokenClaims> {
    return this.auth.validateToken(dto);
  }

  @MessagePattern(AUTH_PATTERNS.getUser)
  getUser(@Payload() dto: GetUserDto): Promise<UserView> {
    return this.auth.getUser(dto);
  }

  @MessagePattern(AUTH_PATTERNS.findByEmail)
  findByEmail(@Payload() dto: FindByEmailDto): Promise<UserView> {
    return this.auth.findByEmail(dto);
  }
}
```

- [ ] **Step 6: Wire the module**

Replace `apps/auth-service/src/auth-service.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-only-change-me',
      signOptions: { expiresIn: Number(process.env.JWT_EXPIRES_IN ?? 3600) },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService],
})
export class AuthServiceModule {}
```

- [ ] **Step 7: Write the bootstrap**

Replace `apps/auth-service/src/main.ts`:

```ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { microserviceOptions } from '@app/common';
import { AuthServiceModule } from './auth-service.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AuthServiceModule,
    microserviceOptions('AUTH_SERVICE'),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen();
}
void bootstrap();
```

- [ ] **Step 8: Delete the generator scaffold**

```bash
rm -f apps/auth-service/src/auth-service.controller.ts \
      apps/auth-service/src/auth-service.service.ts \
      apps/auth-service/src/auth-service.controller.spec.ts
```

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm jest apps/auth-service`
Expected: PASS, 6 tests.

- [ ] **Step 10: Commit**

```bash
git add apps/auth-service
git commit -m "feat(auth): add auth service skeleton"
```

---

### Task 10: wallet-service

The only service that is itself a client of other services. Its `ClientsModule` registration is what proves service-to-service calls work.

**Files:**
- Create: `apps/wallet-service/src/prisma.service.ts`, `wallet.service.ts`, `deposit.service.ts`, `transfer.service.ts`, `ledger.service.ts`, `wallet.controller.ts`
- Modify: `apps/wallet-service/src/main.ts`, `wallet-service.module.ts`
- Test: `apps/wallet-service/src/wallet.controller.spec.ts`
- Delete: the generator's `wallet-service.controller.ts`, `wallet-service.service.ts`, `wallet-service.controller.spec.ts`

**Interfaces:**
- Consumes: `WALLET_PATTERNS`, `SERVICE_TOKENS`, all wallet DTOs and views, `DEFAULT_CURRENCY`, `HealthReport` from `@app/contracts`; `microserviceOptions`, `clientOptions`, `toDecimal` from `@app/common`
- Produces: a TCP listener on 4002 answering `wallet.health`, `wallet.create`, `wallet.list`, `wallet.get_balance`, `wallet.deposit`, `wallet.transfer`, `wallet.history`

- [ ] **Step 1: Write the failing test**

Create `apps/wallet-service/src/wallet.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { SERVICE_TOKENS } from '@app/contracts';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { DepositService } from './deposit.service';
import { TransferService } from './transfer.service';
import { LedgerService } from './ledger.service';
import { PrismaService } from './prisma.service';

const USER_ID = '22222222-2222-4222-8222-222222222222';
const WALLET_ID = '11111111-1111-4111-8111-111111111111';

describe('WalletController', () => {
  let controller: WalletController;

  beforeEach(async () => {
    const clientMock: Partial<ClientProxy> = { send: jest.fn(), emit: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [
        WalletService,
        DepositService,
        TransferService,
        LedgerService,
        { provide: PrismaService, useValue: {} },
        { provide: SERVICE_TOKENS.MOMO_SERVICE, useValue: clientMock },
        { provide: SERVICE_TOKENS.NOTIFICATION_SERVICE, useValue: clientMock },
        { provide: SERVICE_TOKENS.AUTH_SERVICE, useValue: clientMock },
      ],
    }).compile();

    controller = moduleRef.get(WalletController);
  });

  it('reports health', () => {
    expect(controller.health()).toEqual({ service: 'wallet-service', status: 'ok' });
  });

  it('defaults a created wallet to XAF with a zero balance', async () => {
    const result = await controller.create({ userId: USER_ID });
    expect(result).toMatchObject({
      userId: USER_ID,
      currency: 'XAF',
      balance: '0.00',
      status: 'ACTIVE',
    });
  });

  it('honours an explicit currency', async () => {
    expect((await controller.create({ userId: USER_ID, currency: 'EUR' })).currency).toBe('EUR');
  });

  it('returns balances as decimal strings, never BigInt', async () => {
    const result = await controller.getBalance({ userId: USER_ID, walletId: WALLET_ID });
    expect(typeof result.balance).toBe('string');
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('returns a pending deposit stub', async () => {
    const result = await controller.deposit({
      walletId: WALLET_ID,
      userId: USER_ID,
      amount: '25.00',
      msisdn: '237600000001',
      idempotencyKey: 'dep-1',
    });
    expect(result).toMatchObject({ type: 'DEPOSIT', status: 'PENDING', amount: '25.00' });
  });

  it('returns a transfer stub', async () => {
    const result = await controller.transfer({
      fromUserId: USER_ID,
      toEmail: 'grace@example.com',
      amount: '25.00',
      idempotencyKey: 'tr-1',
    });
    expect(result.type).toBe('TRANSFER_OUT');
  });

  it('returns an empty history page', async () => {
    expect(await controller.history({ userId: USER_ID, walletId: WALLET_ID })).toEqual({
      items: [],
      nextCursor: null,
    });
  });
});
```

The `JSON.stringify` assertion is the regression guard for the `BigInt` trap: a `BigInt` leaking into a view type throws `TypeError: Do not know how to serialize a BigInt` only at runtime, on the wire.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest apps/wallet-service`
Expected: FAIL — `Cannot find module './wallet.controller'`.

- [ ] **Step 3: Write the Prisma service**

Create `apps/wallet-service/src/prisma.service.ts`:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@db/wallet';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

- [ ] **Step 4: Write the wallet service**

Create `apps/wallet-service/src/wallet.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { toDecimal } from '@app/common';
import {
  DEFAULT_CURRENCY,
  type CreateWalletDto,
  type ListWalletsDto,
  type GetBalanceDto,
  type WalletView,
} from '@app/contracts';

/** Skeleton stub. Milestone 2 replaces these bodies with PrismaService calls. */
@Injectable()
export class WalletService {
  private stubWallet(id: string, userId: string, currency: string): WalletView {
    return {
      id,
      userId,
      currency,
      balance: toDecimal(0n),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
  }

  async create(dto: CreateWalletDto): Promise<WalletView> {
    return this.stubWallet(randomUUID(), dto.userId, dto.currency ?? DEFAULT_CURRENCY);
  }

  async list(dto: ListWalletsDto): Promise<WalletView[]> {
    return [];
  }

  async getBalance(dto: GetBalanceDto): Promise<WalletView> {
    return this.stubWallet(dto.walletId, dto.userId, DEFAULT_CURRENCY);
  }
}
```

- [ ] **Step 5: Write the ledger service**

Create `apps/wallet-service/src/ledger.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { HistoryDto, HistoryPage } from '@app/contracts';

/** Skeleton stub. Milestone 5 replaces this with cursor-paginated queries. */
@Injectable()
export class LedgerService {
  async history(dto: HistoryDto): Promise<HistoryPage> {
    return { items: [], nextCursor: null };
  }
}
```

- [ ] **Step 6: Write the deposit service**

Create `apps/wallet-service/src/deposit.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { SERVICE_TOKENS, type DepositDto, type TransactionView } from '@app/contracts';

/**
 * Skeleton stub. Milestone 3 implements the spec's deposit flow:
 * insert PENDING, call momo.charge, settle in one DB transaction, notify.
 * The clients are injected now so the wiring is proven by the module test.
 */
@Injectable()
export class DepositService {
  constructor(
    @Inject(SERVICE_TOKENS.MOMO_SERVICE) private readonly momo: ClientProxy,
    @Inject(SERVICE_TOKENS.NOTIFICATION_SERVICE) private readonly notifications: ClientProxy,
  ) {}

  async deposit(dto: DepositDto): Promise<TransactionView> {
    return {
      id: randomUUID(),
      walletId: dto.walletId,
      type: 'DEPOSIT',
      status: 'PENDING',
      amount: dto.amount,
      balanceAfter: null,
      counterpartyWalletId: null,
      providerRef: null,
      failureReason: null,
      createdAt: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 7: Write the transfer service**

Create `apps/wallet-service/src/transfer.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { SERVICE_TOKENS, type TransferDto, type TransactionView } from '@app/contracts';

/**
 * Skeleton stub. Milestone 4 implements the spec's transfer flow: resolve the
 * recipient via auth.find_by_email, then debit and credit both wallets inside
 * a single Prisma $transaction, then notify both users.
 */
@Injectable()
export class TransferService {
  constructor(
    @Inject(SERVICE_TOKENS.AUTH_SERVICE) private readonly auth: ClientProxy,
    @Inject(SERVICE_TOKENS.NOTIFICATION_SERVICE) private readonly notifications: ClientProxy,
  ) {}

  async transfer(dto: TransferDto): Promise<TransactionView> {
    return {
      id: randomUUID(),
      walletId: randomUUID(),
      type: 'TRANSFER_OUT',
      status: 'PENDING',
      amount: dto.amount,
      balanceAfter: null,
      counterpartyWalletId: null,
      providerRef: null,
      failureReason: null,
      createdAt: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 8: Write the message controller**

Create `apps/wallet-service/src/wallet.controller.ts`:

```ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  WALLET_PATTERNS,
  CreateWalletDto,
  ListWalletsDto,
  GetBalanceDto,
  DepositDto,
  TransferDto,
  HistoryDto,
  type WalletView,
  type TransactionView,
  type HistoryPage,
  type HealthReport,
} from '@app/contracts';
import { WalletService } from './wallet.service';
import { DepositService } from './deposit.service';
import { TransferService } from './transfer.service';
import { LedgerService } from './ledger.service';

@Controller()
export class WalletController {
  constructor(
    private readonly wallets: WalletService,
    private readonly deposits: DepositService,
    private readonly transfers: TransferService,
    private readonly ledger: LedgerService,
  ) {}

  @MessagePattern(WALLET_PATTERNS.health)
  health(): HealthReport {
    return { service: 'wallet-service', status: 'ok' };
  }

  @MessagePattern(WALLET_PATTERNS.create)
  create(@Payload() dto: CreateWalletDto): Promise<WalletView> {
    return this.wallets.create(dto);
  }

  @MessagePattern(WALLET_PATTERNS.list)
  list(@Payload() dto: ListWalletsDto): Promise<WalletView[]> {
    return this.wallets.list(dto);
  }

  @MessagePattern(WALLET_PATTERNS.getBalance)
  getBalance(@Payload() dto: GetBalanceDto): Promise<WalletView> {
    return this.wallets.getBalance(dto);
  }

  @MessagePattern(WALLET_PATTERNS.deposit)
  deposit(@Payload() dto: DepositDto): Promise<TransactionView> {
    return this.deposits.deposit(dto);
  }

  @MessagePattern(WALLET_PATTERNS.transfer)
  transfer(@Payload() dto: TransferDto): Promise<TransactionView> {
    return this.transfers.transfer(dto);
  }

  @MessagePattern(WALLET_PATTERNS.history)
  history(@Payload() dto: HistoryDto): Promise<HistoryPage> {
    return this.ledger.history(dto);
  }
}
```

- [ ] **Step 9: Wire the module with its three outbound clients**

Replace `apps/wallet-service/src/wallet-service.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { clientOptions } from '@app/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { DepositService } from './deposit.service';
import { TransferService } from './transfer.service';
import { LedgerService } from './ledger.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClientsModule.register([
      clientOptions('MOMO_SERVICE'),
      clientOptions('NOTIFICATION_SERVICE'),
      clientOptions('AUTH_SERVICE'),
    ]),
  ],
  controllers: [WalletController],
  providers: [WalletService, DepositService, TransferService, LedgerService, PrismaService],
})
export class WalletServiceModule {}
```

- [ ] **Step 10: Write the bootstrap**

Replace `apps/wallet-service/src/main.ts`:

```ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { microserviceOptions } from '@app/common';
import { WalletServiceModule } from './wallet-service.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    WalletServiceModule,
    microserviceOptions('WALLET_SERVICE'),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen();
}
void bootstrap();
```

- [ ] **Step 11: Delete the generator scaffold**

```bash
rm -f apps/wallet-service/src/wallet-service.controller.ts \
      apps/wallet-service/src/wallet-service.service.ts \
      apps/wallet-service/src/wallet-service.controller.spec.ts
```

- [ ] **Step 12: Run test to verify it passes**

Run: `pnpm jest apps/wallet-service`
Expected: PASS, 7 tests.

- [ ] **Step 13: Commit**

```bash
git add apps/wallet-service
git commit -m "feat(wallet): add wallet service skeleton with outbound clients"
```

---

### Task 11: api-gateway

The HTTP surface: clients for all four services, the RPC→HTTP error filter, a JWT guard, and the health fan-out.

**Files:**
- Create: `apps/api-gateway/src/filters/rpc-exception.filter.ts`
- Create: `apps/api-gateway/src/auth/jwt.guard.ts`, `auth/current-user.decorator.ts`, `auth/auth.controller.ts`
- Create: `apps/api-gateway/src/wallets/wallets.controller.ts`, `transfers/transfers.controller.ts`, `notifications/notifications.controller.ts`, `health/health.controller.ts`
- Create: `apps/api-gateway/src/rpc.ts`
- Modify: `apps/api-gateway/src/main.ts`, `api-gateway.module.ts`
- Test: `apps/api-gateway/src/filters/rpc-exception.filter.spec.ts`, `apps/api-gateway/src/health/health.controller.spec.ts`
- Delete: `apps/api-gateway/src/api-gateway.controller.ts`, `api-gateway.service.ts`, `api-gateway.controller.spec.ts`

**Interfaces:**
- Consumes: everything exported by `@app/contracts`; `clientOptions`, `rpcTimeoutMs`, `httpStatusForCode`, `isRpcErrorPayload`, `ErrorCode` from `@app/common`
- Produces: HTTP routes `POST /auth/register`, `POST /auth/login`, `GET /wallets`, `POST /wallets`, `GET /wallets/:walletId/balance`, `POST /wallets/:walletId/deposits`, `GET /wallets/:walletId/transactions`, `POST /transfers`, `GET /notifications`, `POST /notifications/:id/read`, `GET /health`

- [ ] **Step 1: Write the failing filter test**

Create `apps/api-gateway/src/filters/rpc-exception.filter.spec.ts`:

```ts
import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { RpcExceptionFilter } from './rpc-exception.filter';

function hostWithResponse() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/wallets', correlationId: 'cid-1' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('RpcExceptionFilter', () => {
  it('maps a structured rpc payload to its http status', () => {
    const { host, status, json } = hostWithResponse();

    new RpcExceptionFilter().catch(
      { code: 'INSUFFICIENT_FUNDS', message: 'Balance too low' },
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'INSUFFICIENT_FUNDS',
        message: 'Balance too low',
        correlationId: 'cid-1',
      }),
    );
  });

  it('maps an unrecognised code to 500', () => {
    const { host, status } = hostWithResponse();
    new RpcExceptionFilter().catch({ code: 'WAT', message: 'unknown' }, host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('maps a client timeout to 504', () => {
    const { host, status, json } = hostWithResponse();
    const timeout = new Error('Timeout has occurred');
    timeout.name = 'TimeoutError';

    new RpcExceptionFilter().catch(timeout, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.GATEWAY_TIMEOUT);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'PROVIDER_TIMEOUT' }),
    );
  });

  it('maps a refused connection to 502', () => {
    const { host, status, json } = hostWithResponse();
    const refused = Object.assign(new Error('connect ECONNREFUSED'), {
      code: 'ECONNREFUSED',
    });

    new RpcExceptionFilter().catch(refused, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_GATEWAY);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SERVICE_UNAVAILABLE' }),
    );
  });
});
```

The timeout and ECONNREFUSED cases are the ones that actually happen while developing: a service you forgot to start must produce a clear 502, not an opaque 500.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest apps/api-gateway/src/filters`
Expected: FAIL — `Cannot find module './rpc-exception.filter'`.

- [ ] **Step 3: Write the filter**

Create `apps/api-gateway/src/filters/rpc-exception.filter.ts`:

```ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ErrorCode, httpStatusForCode, isRpcErrorPayload } from '@app/common';

/**
 * A microservice throws AppRpcException, but the calling ClientProxy rejects
 * with the serialized payload object, not with the class. So this filter
 * identifies errors structurally rather than by instanceof.
 */
@Catch()
export class RpcExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(RpcExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<{ status: (code: number) => { json: (b: unknown) => void } }>();
    const request = http.getRequest<{ url?: string; correlationId?: string }>();

    const { status, code, message, details } = this.describe(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request?.url ?? 'unknown'} -> ${code}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      statusCode: status,
      code,
      message,
      ...(details === undefined ? {} : { details }),
      correlationId: request?.correlationId,
      timestamp: new Date().toISOString(),
    });
  }

  private describe(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    if (isRpcErrorPayload(exception)) {
      return {
        status: httpStatusForCode(exception.code),
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      return {
        status: exception.getStatus(),
        code: ErrorCode.VALIDATION_FAILED,
        message: exception.message,
        details: typeof body === 'object' ? body : undefined,
      };
    }

    if (exception instanceof Error && exception.name === 'TimeoutError') {
      return {
        status: httpStatusForCode(ErrorCode.PROVIDER_TIMEOUT),
        code: ErrorCode.PROVIDER_TIMEOUT,
        message: 'Downstream service did not respond in time',
      };
    }

    if (
      exception instanceof Error &&
      (exception as NodeJS.ErrnoException).code === 'ECONNREFUSED'
    ) {
      return {
        status: httpStatusForCode(ErrorCode.SERVICE_UNAVAILABLE),
        code: ErrorCode.SERVICE_UNAVAILABLE,
        message: 'Downstream service is not reachable',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Unexpected error',
    };
  }
}
```

- [ ] **Step 4: Run the filter test to verify it passes**

Run: `pnpm jest apps/api-gateway/src/filters`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the RPC call helper**

Create `apps/api-gateway/src/rpc.ts`:

```ts
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { rpcTimeoutMs } from '@app/common';

/** Every outbound call gets an explicit timeout so a dead service surfaces as 504. */
export function call<TResult>(
  client: ClientProxy,
  pattern: string,
  payload: unknown,
): Promise<TResult> {
  return firstValueFrom(
    client.send<TResult>(pattern, payload).pipe(timeout(rpcTimeoutMs())),
  );
}
```

- [ ] **Step 6: Write the failing health test**

Create `apps/api-gateway/src/health/health.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { SERVICE_TOKENS } from '@app/contracts';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  function clientReturning(service: string) {
    return { send: jest.fn().mockReturnValue(of({ service, status: 'ok' })) };
  }

  async function build(overrides: Record<string, unknown> = {}) {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: SERVICE_TOKENS.AUTH_SERVICE, useValue: overrides.AUTH_SERVICE ?? clientReturning('auth-service') },
        { provide: SERVICE_TOKENS.WALLET_SERVICE, useValue: overrides.WALLET_SERVICE ?? clientReturning('wallet-service') },
        { provide: SERVICE_TOKENS.NOTIFICATION_SERVICE, useValue: overrides.NOTIFICATION_SERVICE ?? clientReturning('notification-service') },
        { provide: SERVICE_TOKENS.MOMO_SERVICE, useValue: overrides.MOMO_SERVICE ?? clientReturning('momo-sim') },
      ],
    }).compile();
    return moduleRef.get(HealthController);
  }

  it('reports ok when every service answers', async () => {
    const result = await (await build()).check();
    expect(result.status).toBe('ok');
    expect(result.services).toEqual({
      AUTH_SERVICE: 'ok',
      WALLET_SERVICE: 'ok',
      NOTIFICATION_SERVICE: 'ok',
      MOMO_SERVICE: 'ok',
    });
  });

  it('degrades and names the failing service rather than throwing', async () => {
    const controller = await build({
      MOMO_SERVICE: { send: () => throwError(() => new Error('ECONNREFUSED')) },
    });
    const result = await controller.check();
    expect(result.status).toBe('degraded');
    expect(result.services.MOMO_SERVICE).toBe('unreachable');
    expect(result.services.AUTH_SERVICE).toBe('ok');
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `pnpm jest apps/api-gateway/src/health`
Expected: FAIL — `Cannot find module './health.controller'`.

- [ ] **Step 8: Write the health controller**

Create `apps/api-gateway/src/health/health.controller.ts`:

```ts
import { Controller, Get, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { HEALTH_PATTERNS, SERVICE_TOKENS, type ServiceName } from '@app/contracts';
import { call } from '../rpc';

type ServiceHealth = 'ok' | 'unreachable';

interface HealthResponse {
  status: 'ok' | 'degraded';
  services: Record<ServiceName, ServiceHealth>;
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject(SERVICE_TOKENS.AUTH_SERVICE) private readonly auth: ClientProxy,
    @Inject(SERVICE_TOKENS.WALLET_SERVICE) private readonly wallet: ClientProxy,
    @Inject(SERVICE_TOKENS.NOTIFICATION_SERVICE) private readonly notification: ClientProxy,
    @Inject(SERVICE_TOKENS.MOMO_SERVICE) private readonly momo: ClientProxy,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const clients: Record<ServiceName, ClientProxy> = {
      AUTH_SERVICE: this.auth,
      WALLET_SERVICE: this.wallet,
      NOTIFICATION_SERVICE: this.notification,
      MOMO_SERVICE: this.momo,
    };

    const names = Object.keys(clients) as ServiceName[];
    const results = await Promise.all(
      names.map(async (name): Promise<ServiceHealth> => {
        try {
          await call(clients[name], HEALTH_PATTERNS[name], {});
          return 'ok';
        } catch {
          return 'unreachable';
        }
      }),
    );

    const services = Object.fromEntries(
      names.map((name, index) => [name, results[index]]),
    ) as Record<ServiceName, ServiceHealth>;

    return {
      status: results.every((r) => r === 'ok') ? 'ok' : 'degraded',
      services,
    };
  }
}
```

Health deliberately reports per-service status instead of throwing, so the endpoint stays useful precisely when something is broken.

- [ ] **Step 9: Run the health test to verify it passes**

Run: `pnpm jest apps/api-gateway/src/health`
Expected: PASS, 2 tests.

- [ ] **Step 10: Write the JWT guard and current-user decorator**

Create `apps/api-gateway/src/auth/jwt.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppRpcException, ErrorCode } from '@app/common';
import type { TokenClaims } from '@app/contracts';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: TokenClaims;
    }>();

    const header = request.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new AppRpcException(ErrorCode.UNAUTHORIZED, 'Missing bearer token');
    }

    try {
      request.user = await this.jwt.verifyAsync<TokenClaims>(token);
      return true;
    } catch {
      throw new AppRpcException(ErrorCode.UNAUTHORIZED, 'Invalid or expired token');
    }
  }
}
```

The guard throws `AppRpcException` so its `{ code, message }` payload flows through the same filter as every service error, giving one error shape across the whole API.

**This requires the filter to unwrap `RpcException` first.** A service error crosses the wire and arrives as a plain object, but this one is thrown *inside* the gateway and arrives as the class instance — and `isRpcErrorPayload` rejects anything `instanceof Error`. Without the unwrap in Step 3, a bad token returns 500 `INTERNAL_ERROR` instead of 401 `UNAUTHORIZED`. The filter's Step 1 test covers it.

Create `apps/api-gateway/src/auth/current-user.decorator.ts`:

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { TokenClaims } from '@app/contracts';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TokenClaims => {
    return context.switchToHttp().getRequest<{ user: TokenClaims }>().user;
  },
);
```

- [ ] **Step 11: Write the HTTP controllers**

Create `apps/api-gateway/src/auth/auth.controller.ts`:

```ts
import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AUTH_PATTERNS,
  WALLET_PATTERNS,
  SERVICE_TOKENS,
  RegisterDto,
  LoginDto,
  DEFAULT_CURRENCY,
  type UserView,
  type AuthTokens,
} from '@app/contracts';
import { call } from '../rpc';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(SERVICE_TOKENS.AUTH_SERVICE) private readonly auth: ClientProxy,
    @Inject(SERVICE_TOKENS.WALLET_SERVICE) private readonly wallet: ClientProxy,
  ) {}

  /**
   * The gateway orchestrates both calls: auth-service must never call
   * wallet-service, because wallet-service already calls auth-service and the
   * reverse edge would create a cycle. wallet.create is idempotent on
   * (userId, currency), so a failure here self-heals on first wallet access.
   */
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<UserView> {
    const user = await call<UserView>(this.auth, AUTH_PATTERNS.register, dto);
    await call(this.wallet, WALLET_PATTERNS.create, {
      userId: user.id,
      currency: DEFAULT_CURRENCY,
    });
    return user;
  }

  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthTokens> {
    return call<AuthTokens>(this.auth, AUTH_PATTERNS.login, dto);
  }
}
```

Create `apps/api-gateway/src/wallets/wallets.controller.ts`:

```ts
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import {
  WALLET_PATTERNS,
  SERVICE_TOKENS,
  type WalletView,
  type TransactionView,
  type HistoryPage,
  type TokenClaims,
} from '@app/contracts';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { call } from '../rpc';

@UseGuards(JwtGuard)
@Controller('wallets')
export class WalletsController {
  constructor(
    @Inject(SERVICE_TOKENS.WALLET_SERVICE) private readonly wallet: ClientProxy,
  ) {}

  @Get()
  list(@CurrentUser() user: TokenClaims): Promise<WalletView[]> {
    return call<WalletView[]>(this.wallet, WALLET_PATTERNS.list, { userId: user.userId });
  }

  @Post()
  create(
    @CurrentUser() user: TokenClaims,
    @Body('currency') currency?: string,
  ): Promise<WalletView> {
    return call<WalletView>(this.wallet, WALLET_PATTERNS.create, {
      userId: user.userId,
      currency,
    });
  }

  @Get(':walletId/balance')
  balance(
    @CurrentUser() user: TokenClaims,
    @Param('walletId', ParseUUIDPipe) walletId: string,
  ): Promise<WalletView> {
    return call<WalletView>(this.wallet, WALLET_PATTERNS.getBalance, {
      userId: user.userId,
      walletId,
    });
  }

  @Post(':walletId/deposits')
  deposit(
    @CurrentUser() user: TokenClaims,
    @Param('walletId', ParseUUIDPipe) walletId: string,
    @Body() body: { amount: string; msisdn: string; idempotencyKey?: string },
  ): Promise<TransactionView> {
    return call<TransactionView>(this.wallet, WALLET_PATTERNS.deposit, {
      userId: user.userId,
      walletId,
      amount: body.amount,
      msisdn: body.msisdn,
      idempotencyKey: body.idempotencyKey ?? randomUUID(),
    });
  }

  @Get(':walletId/transactions')
  history(
    @CurrentUser() user: TokenClaims,
    @Param('walletId', ParseUUIDPipe) walletId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<HistoryPage> {
    return call<HistoryPage>(this.wallet, WALLET_PATTERNS.history, {
      userId: user.userId,
      walletId,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
```

Create `apps/api-gateway/src/transfers/transfers.controller.ts`:

```ts
import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import {
  WALLET_PATTERNS,
  SERVICE_TOKENS,
  type TransactionView,
  type TokenClaims,
} from '@app/contracts';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { call } from '../rpc';

@UseGuards(JwtGuard)
@Controller('transfers')
export class TransfersController {
  constructor(
    @Inject(SERVICE_TOKENS.WALLET_SERVICE) private readonly wallet: ClientProxy,
  ) {}

  @Post()
  transfer(
    @CurrentUser() user: TokenClaims,
    @Body() body: { toEmail: string; amount: string; idempotencyKey?: string },
  ): Promise<TransactionView> {
    return call<TransactionView>(this.wallet, WALLET_PATTERNS.transfer, {
      fromUserId: user.userId,
      toEmail: body.toEmail,
      amount: body.amount,
      idempotencyKey: body.idempotencyKey ?? randomUUID(),
    });
  }
}
```

Create `apps/api-gateway/src/notifications/notifications.controller.ts`:

```ts
import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  NOTIFICATION_PATTERNS,
  SERVICE_TOKENS,
  type NotificationView,
  type NotificationPage,
  type TokenClaims,
} from '@app/contracts';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { call } from '../rpc';

@UseGuards(JwtGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    @Inject(SERVICE_TOKENS.NOTIFICATION_SERVICE) private readonly notifications: ClientProxy,
  ) {}

  @Get()
  list(
    @CurrentUser() user: TokenClaims,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<NotificationPage> {
    return call<NotificationPage>(this.notifications, NOTIFICATION_PATTERNS.list, {
      userId: user.userId,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post(':notificationId/read')
  markRead(
    @CurrentUser() user: TokenClaims,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ): Promise<NotificationView> {
    return call<NotificationView>(this.notifications, NOTIFICATION_PATTERNS.markRead, {
      userId: user.userId,
      notificationId,
    });
  }
}
```

- [ ] **Step 12: Wire the gateway module**

Replace `apps/api-gateway/src/api-gateway.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule } from '@nestjs/microservices';
import { clientOptions } from '@app/common';
import { AuthController } from './auth/auth.controller';
import { WalletsController } from './wallets/wallets.controller';
import { TransfersController } from './transfers/transfers.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-only-change-me',
    }),
    ClientsModule.register([
      clientOptions('AUTH_SERVICE'),
      clientOptions('WALLET_SERVICE'),
      clientOptions('NOTIFICATION_SERVICE'),
      clientOptions('MOMO_SERVICE'),
    ]),
  ],
  controllers: [
    AuthController,
    WalletsController,
    TransfersController,
    NotificationsController,
    HealthController,
  ],
})
export class ApiGatewayModule {}
```

The gateway's JWT secret must match `auth-service`'s — both read `JWT_SECRET`, so a single `.env` keeps them aligned.

**Known gap, deliberately deferred:** spec §10 calls for the correlation id to travel in every message payload. The skeleton generates it, echoes it in the `x-correlation-id` response header, and includes it in error bodies, but does not yet thread it into outbound message payloads — doing so needs a request-scoped value inside `call()`, which is Milestone 1 work. Every DTO already carries the optional `correlationId` field, so that change touches only the gateway.

- [ ] **Step 13: Write the gateway bootstrap**

Replace `apps/api-gateway/src/main.ts`:

```ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { ApiGatewayModule } from './api-gateway.module';
import { RpcExceptionFilter } from './filters/rpc-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ApiGatewayModule);

  app.use((req: Request & { correlationId?: string }, res: Response, next: NextFunction) => {
    req.correlationId = (req.headers['x-correlation-id'] as string) ?? randomUUID();
    res.setHeader('x-correlation-id', req.correlationId);
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new RpcExceptionFilter());

  await app.listen(Number(process.env.GATEWAY_PORT ?? 3000));
}
void bootstrap();
```

- [ ] **Step 14: Delete the generator scaffold**

```bash
rm -f apps/api-gateway/src/api-gateway.controller.ts \
      apps/api-gateway/src/api-gateway.service.ts \
      apps/api-gateway/src/api-gateway.controller.spec.ts
```

- [ ] **Step 15: Run the full unit suite and the build**

Run: `pnpm jest && pnpm build`
Expected: PASS for all suites, and `pnpm build` completes with all five apps in `dist/apps`.

- [ ] **Step 16: Commit**

```bash
git add apps/api-gateway
git commit -m "feat(gateway): add http surface, rpc error filter and health fan-out"
```

---

### Task 12: End-to-end health smoke test and documentation

The acceptance criterion for the whole skeleton: a real HTTP request producing four real TCP round trips.

**Files:**
- Create: `apps/api-gateway/test/health.e2e-spec.ts`
- Modify: `apps/api-gateway/test/jest-e2e.json`
- Delete: `apps/api-gateway/test/app.e2e-spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: all five application modules and `microserviceOptions` from `@app/common`
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Point the e2e jest config at the workspace aliases**

Replace `apps/api-gateway/test/jest-e2e.json`:

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "../../..",
  "testEnvironment": "node",
  "testRegex": "apps/api-gateway/test/.*\\.e2e-spec\\.ts$",
  "testTimeout": 30000,
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^@app/common(|/.*)$": "<rootDir>/libs/common/src/$1",
    "^@app/contracts(|/.*)$": "<rootDir>/libs/contracts/src/$1"
  }
}
```

`rootDir` moves up to the repo root so the alias mappings resolve; without that the e2e run cannot find `@app/contracts`.

- [ ] **Step 2: Write the failing e2e test**

Create `apps/api-gateway/test/health.e2e-spec.ts`:

```ts
import { INestApplication, INestMicroservice } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import request from 'supertest';
import { microserviceOptions, type ServiceName } from '@app/common';
import { ApiGatewayModule } from '../src/api-gateway.module';
import { AuthServiceModule } from '../../auth-service/src/auth-service.module';
import { WalletServiceModule } from '../../wallet-service/src/wallet-service.module';
import { NotificationServiceModule } from '../../notification-service/src/notification-service.module';
import { MomoSimModule } from '../../momo-sim/src/momo-sim.module';

describe('GET /health (e2e)', () => {
  let gateway: INestApplication;
  const services: INestMicroservice[] = [];

  async function startService(module: unknown, name: ServiceName): Promise<void> {
    const service = await NestFactory.createMicroservice<MicroserviceOptions>(
      module as never,
      microserviceOptions(name),
    );
    await service.listen();
    services.push(service);
  }

  beforeAll(async () => {
    await startService(AuthServiceModule, 'AUTH_SERVICE');
    await startService(WalletServiceModule, 'WALLET_SERVICE');
    await startService(NotificationServiceModule, 'NOTIFICATION_SERVICE');
    await startService(MomoSimModule, 'MOMO_SERVICE');

    gateway = await NestFactory.create(ApiGatewayModule, { logger: false });
    await gateway.init();
  });

  afterAll(async () => {
    await gateway?.close();
    await Promise.all(services.map((s) => s.close()));
  });

  it('reports every service healthy over real TCP', async () => {
    const response = await request(gateway.getHttpServer()).get('/health').expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      services: {
        AUTH_SERVICE: 'ok',
        WALLET_SERVICE: 'ok',
        NOTIFICATION_SERVICE: 'ok',
        MOMO_SERVICE: 'ok',
      },
    });
  });
});
```

The health handlers never touch Prisma, so this test needs no database — it is a pure transport smoke test.

- [ ] **Step 3: Remove the scaffold e2e test and run the new one to verify it fails**

```bash
rm -f apps/api-gateway/test/app.e2e-spec.ts
pnpm test:e2e
```

Expected: FAIL — `Cannot find module '../../auth-service/src/auth-service.module'` if Tasks 7–10 are incomplete, or an assertion failure showing `unreachable` services.

- [ ] **Step 4: Run the e2e test to verify it passes**

Run: `pnpm test:e2e`
Expected: PASS, 1 test, with all four services reporting `ok`.

If a service reports `unreachable`, its port is already taken — check for a stray `pnpm dev:all` still running.

- [ ] **Step 5: Verify the full acceptance criteria by hand**

```bash
docker compose up -d postgres
pnpm prisma:migrate
pnpm dev:all
```

In another terminal:

```bash
curl -s localhost:3000/health | jq
curl -s -X POST localhost:3000/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"ada@example.com","password":"correct-horse","fullName":"Ada Lovelace"}' | jq
curl -s -X POST localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"ada@example.com","password":"correct-horse"}' | jq -r .accessToken
```

Expected: health is `ok` for all four; register returns a `UserView` with no password field; login returns an `accessToken`. Then, using that token:

```bash
TOKEN=<paste the accessToken>
curl -s localhost:3000/wallets -H "authorization: Bearer $TOKEN" | jq
curl -s localhost:3000/wallets -H "authorization: Bearer wrong" | jq
```

Expected: the first returns `[]`; the second returns HTTP 401 with `{"code":"UNAUTHORIZED",...}` — which confirms the guard and the error filter agree on one error shape.

- [ ] **Step 6: Write the README**

Replace `README.md`:

````markdown
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
   contract type.
4. Every message pattern string is defined once, in
   `libs/contracts/src/patterns.ts`.
5. Every mutating operation carries an idempotency key.
6. Transport is described in exactly one file,
   `libs/common/src/transport.config.ts`.

## Testing

```bash
pnpm test       # unit tests, no database required
pnpm test:e2e   # boots all five apps and asserts GET /health
```

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
full design.
````

- [ ] **Step 7: Run everything one final time**

```bash
pnpm lint && pnpm test && pnpm test:e2e && pnpm build
```

Expected: all four commands pass.

- [ ] **Step 8: Commit**

```bash
git add apps/api-gateway/test README.md
git commit -m "test(gateway): add health e2e smoke test and document the skeleton"
```
