# @u17g/deferrable

A tiny `defer` utility for JavaScript/TypeScript: register cleanup/rollback callbacks that run in LIFO order. Works in any runtime (Node.js, Bun, Deno, browsers).

## Installation

```sh
npm install -S @u17g/deferrable
pnpm add @u17g/deferrable
bun add @u17g/deferrable
```

## Usage

```ts
import { deferrable } from "@u17g/deferrable";

await deferrable(async (defer): Promise<string> => {
  defer(async ([result, err]) => {
    if (err) {
      console.error(err);
    } else {
      console.log(result);
    }
  });
  return "Hello, World!";
});
```

### CommonJS

```js
const { deferrable } = require("@u17g/deferrable");
```

## TypeScript notes

### Annotate the callback's return type (recommended)

When using TypeScript, prefer annotating the return type of the callback you pass to `deferrable`:

```ts
await deferrable(async (defer): Promise<number> => {
  defer(([value, err]) => {
    // value: number | undefined
    // err: Error | undefined
  });
  return 42;
});
```

**Why**: `defer` is typed in terms of the generic `T` (the value that the callback returns). If you omit the return type annotation, TypeScript can fail to infer `T` correctly, which may surface as confusing type errors inside `defer(([value, err]) => ...)`.

## Behavior

`deferrable(callback)` runs `callback(defer)` and guarantees that deferred callbacks registered via `defer(...)` are executed **after** the callback finishes (either resolved or rejected).

- **Execution order (LIFO)**: deferred callbacks run in reverse order of registration (stack behavior).
- **Result passed to deferred callbacks**: each deferred callback receives a tuple `[value, error]`:
  - `[value, undefined]` when the callback resolved
  - `[undefined, error]` when the callback threw / rejected
- **Error propagation (main callback)**: if the callback fails, deferred callbacks still run; if none of them fails, the original error is thrown. (If a deferred callback fails, see below.)
- **Awaited sequentially**: deferred callbacks are awaited one by one (no parallel execution).
- **Deferred callback errors**: if a deferred callback throws/rejects, `deferrable` fails fast with that error (remaining deferred callbacks are not executed) — even if the main callback already failed.
  - If you want **all** deferred callbacks to run even if one of them fails, catch errors inside the deferred callback itself.

### Example: always run all deferred callbacks (catch inside defer)

```ts
await deferrable(async (defer): Promise<void> => {
  defer(async () => {
    await cleanupA().catch((err) => {
      // ignore / log
      console.error("cleanupA failed:", err);
    });
  });

  defer(async () => {
    await cleanupB().catch((err) => {
      console.error("cleanupB failed:", err);
    });
  });
});
```

### Example: LIFO order

```ts
await deferrable(async (defer): Promise<string> => {
  defer(() => console.log("first"));
  defer(() => console.log("second"));
  // Output:
  // second
  // first
  return "ok";
});
```

### Example: observing success/failure

```ts
await deferrable(async (defer): Promise<number> => {
  defer(([value, err]) => {
    if (err) {
      console.error("failed:", err);
    } else {
      console.log("ok:", value);
    }
  });

  // throw new Error("boom");
  return 42;
});
```

### Example: catching errors at the call site

```ts
await deferrable(async (_defer): Promise<void> => {
  // Simulate failure
  throw new Error("boom");
}).catch((err) => {
  console.error("caught:", err);
});
```

## Patterns

### Saga / compensating actions (transaction-like cleanup)

Because deferred callbacks run **in reverse order (LIFO)** and still run even if the callback fails, you can use `deferrable` to implement a lightweight saga pattern: after each step succeeds, register its compensation. On failure, compensations run in reverse order automatically.

```ts
await deferrable(async (defer): Promise<void> => {
  const orderId = await createOrder();
  defer(async ([_, err]) => {
    if (err) await cancelOrder(orderId);
  });

  const paymentId = await chargeCard();
  defer(async ([_, err]) => {
    if (err) await refundPayment(paymentId);
  });

  await reserveInventory(orderId);
  defer(async ([_, err]) => {
    if (err) await releaseInventory(orderId);
  });
}).catch((err) => {
  // If anything throws above, the registered compensations will run:
  // releaseInventory -> refundPayment -> cancelOrder
  console.error("saga failed:", err);
});

async function createOrder(): Promise<string> {
  return "order_123";
}
async function cancelOrder(_orderId: string): Promise<void> {}
async function chargeCard(): Promise<string> {
  return "payment_123";
}
async function refundPayment(_paymentId: string): Promise<void> {}
async function reserveInventory(_orderId: string): Promise<void> {
  throw new Error("out of stock");
}
async function releaseInventory(_orderId: string): Promise<void> {}
```
