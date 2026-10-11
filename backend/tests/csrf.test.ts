import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, csrfOriginCheck } from "../src/lib/auth.js";

const ALLOWED = "http://127.0.0.1:5173";

function req(
  method: string,
  headers: Record<string, string> = {},
  cookie = true,
): Request {
  return {
    method,
    headers: {
      ...(cookie ? { cookie: `${SESSION_COOKIE}=raw-token-value` } : {}),
      ...headers,
    },
  } as unknown as Request;
}

function res() {
  const r = {
    statusCode: 0,
    body: null as unknown,
    status(c: number) {
      r.statusCode = c;
      return r;
    },
    json(b: unknown) {
      r.body = b;
      return r;
    },
  };
  return r as unknown as Response & { statusCode: number; body: unknown };
}

function run(method: string, headers: Record<string, string> = {}, cookie = true) {
  const response = res();
  const next = vi.fn();
  csrfOriginCheck(req(method, headers, cookie), response, next);
  return { next, response };
}

describe("csrfOriginCheck", () => {
  it("passes safe methods without inspection", () => {
    for (const m of ["GET", "HEAD", "OPTIONS"]) {
      const { next, response } = run(m, {}, true);
      expect(next).toHaveBeenCalledOnce();
      expect(response.statusCode).toBe(0);
    }
  });

  it("permits cookie mutations with the configured Origin", () => {
    const { next, response } = run("POST", { origin: ALLOWED }, true);
    expect(next).toHaveBeenCalledOnce();
    expect(response.statusCode).toBe(0);
  });

  it("rejects cookie mutations with a foreign Origin", () => {
    const { next, response } = run("POST", { origin: "http://evil.example" }, true);
    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(403);
  });

  it("rejects cookie mutations with missing Origin and Referer", () => {
    const { next, response } = run("PATCH", {}, true);
    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(403);
  });

  it("accepts a matching Referer when Origin is absent", () => {
    const { next, response } = run(
      "POST",
      { referer: `${ALLOWED}/mirror` },
      true,
    );
    expect(next).toHaveBeenCalledOnce();
    expect(response.statusCode).toBe(0);
  });

  it("rejects a foreign Referer when Origin is absent", () => {
    const { next, response } = run("POST", { referer: "http://evil.example/x" }, true);
    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(403);
  });

  it("lets headerless non-cookie mutations through to authentication", () => {
    const { next, response } = run("POST", {}, false);
    expect(next).toHaveBeenCalledOnce();
    expect(response.statusCode).toBe(0);
  });

  it("still refuses foreign origins without a cookie (defense in depth)", () => {
    const { next, response } = run("POST", { origin: "http://evil.example" }, false);
    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(403);
  });
});
