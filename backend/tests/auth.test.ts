import { describe, expect, it } from "vitest";
import {
  hashPassword,
  hashSessionToken,
  newSessionToken,
  verifyPassword,
} from "../src/lib/password.js";

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct-horse-1234");
    expect(await verifyPassword("correct-horse-1234", hash)).toBe(true);
    expect(await verifyPassword("wrong-password-0000", hash)).toBe(false);
  });

  it("never stores plaintext and salts uniquely", async () => {
    const a = await hashPassword("same-password-here");
    const b = await hashPassword("same-password-here");
    expect(a).not.toContain("same-password-here");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$v1$")).toBe(true);
  });

  it("rejects malformed or foreign hash formats", async () => {
    expect(await verifyPassword("x", "NOT_SET_DEMO_SEED")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "scrypt$v1$bad")).toBe(false);
    expect(await verifyPassword("x", "$2b$10$abcdefghijklmnopqrstuu")).toBe(false);
  });
});

describe("session tokens", () => {
  it("issues unique tokens whose stored hash reveals nothing", () => {
    const t1 = newSessionToken();
    const t2 = newSessionToken();
    expect(t1).not.toBe(t2);
    const h = hashSessionToken(t1);
    expect(h).not.toContain(t1);
    expect(h).toBe(hashSessionToken(t1));
    expect(h).toHaveLength(64);
  });
});
