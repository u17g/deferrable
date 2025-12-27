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

  it("fails fast when a deferred callback throws (remaining deferred callbacks are not executed)", async () => {
    const calls: string[] = [];
    const deferErr = new Error("defer failed");

    await expect(
      deferrable(async (defer): Promise<string> => {
        defer(async () => {
          calls.push("first");
        });
        defer(async () => {
          calls.push("second");
          throw deferErr;
        });
        defer(async () => {
          calls.push("third");
        });
        return "ok";
      }),
    ).rejects.toBe(deferErr);

    // LIFO: third runs, then second throws -> first is not executed
    expect(calls).toEqual(["third", "second"]);
  });

  it("when the main function fails and a deferred callback fails, it throws an AggregateError containing both", async () => {
    const mainErr = new Error("main failed");
    const deferErr = new Error("defer failed");

    let thrown: unknown;
    try {
      await deferrable(
        async (defer): Promise<string> => {
          defer(async () => {
            throw deferErr;
          });
          throw mainErr;
        },
      );
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(AggregateError);
    const ae = thrown as AggregateError;
    expect(ae.errors.includes(mainErr)).toBe(true);
    expect(ae.errors.includes(deferErr)).toBe(true);
  });
});


