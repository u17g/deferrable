import { describe, expect, it } from "bun:test";
import { deferrable } from "../src/index";

describe("deferrable", () => {
  it("returns the resolved value and runs deferred callbacks in LIFO order", async () => {
    const calls: string[] = [];

    const value = await deferrable(async (defer): Promise<number> => {
      defer(async ([v, err]) => {
        expect(err).toBeUndefined();
        expect(v).toBe(42);
        calls.push("a");
      });

      defer(async () => {
        calls.push("b");
      });

      defer(async () => {
        calls.push("c");
      });

      return 42;
    });

    expect(value).toBe(42);
    expect(calls).toEqual(["c", "b", "a"]);
  });

  it("runs deferred callbacks even when the main function rejects, then rethrows the error", async () => {
    const calls: string[] = [];
    const err = new Error("boom");

    await expect(
      deferrable(async (defer) => {
        defer(async ([v, e]) => {
          expect(v).toBeUndefined();
          expect(e).toBe(err);
          calls.push("first");
        });

        defer(async () => {
          calls.push("second");
        });

        throw err;
      }),
    ).rejects.toBe(err);

    expect(calls).toEqual(["second", "first"]);
  });

  it("awaits deferred callbacks sequentially (not in parallel)", async () => {
    const events: string[] = [];

    await deferrable(async (defer): Promise<string> => {
      defer(async () => {
        events.push("defer-1-start");
        await new Promise((r) => setTimeout(r, 20));
        events.push("defer-1-end");
      });

      defer(async () => {
        events.push("defer-2");
      });

      return "ok";
    });

    // LIFO means defer-2 runs before defer-1
    expect(events[0]).toBe("defer-2");
    // Sequential means defer-1-start is immediately followed by defer-1-end, not interleaved by anything else
    expect(events).toEqual(["defer-2", "defer-1-start", "defer-1-end"]);
  });

  it("swallows errors thrown by deferred callbacks", async () => {
    const calls: string[] = [];

    const value = await deferrable(async (defer): Promise<string> => {
      defer(async () => {
        calls.push("before-throw");
        throw new Error("ignored");
      });

      defer(async () => {
        calls.push("after-throw");
      });

      return "ok";
    });

    expect(value).toBe("ok");
    expect(calls).toEqual(["after-throw", "before-throw"]);
  });
});


