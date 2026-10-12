import { describe, expect, it } from "vitest";
import { OTP_LENGTH, generateOtp, hashOtp, isOtpShape, verifyOtp } from "../src/lib/otp.js";
import {
  checkPassword,
  completeBody,
  hashCompletionToken,
  maskEmail,
  normaliseEnrollmentNo,
  normaliseText,
  prepareStart,
  startBody,
} from "../src/lib/registration.js";

describe("one-time codes", () => {
  it("generates six digits from the CSPRNG, not the weak Math.random", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      const code = generateOtp();
      expect(code).toMatch(/^\d{6}$/);
      expect(isOtpShape(code)).toBe(true);
      codes.add(code);
    }
    // Collisions in 500 draws from 10^6 are vanishingly unlikely; a constant
    // generator would collapse to one value immediately.
    expect(codes.size).toBeGreaterThan(400);
  });

  it("stores no plaintext and is stable for the same attempt and code", () => {
    const hash = hashOtp("attempt-1", "123456");
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("123456");
    expect(hash).toBe(hashOtp("attempt-1", "123456"));
  });

  it("binds a code to one attempt, so a code cannot be replayed elsewhere", () => {
    const hash = hashOtp("attempt-1", "123456");
    expect(verifyOtp("attempt-1", "123456", hash)).toBe(true);
    expect(verifyOtp("attempt-2", "123456", hash)).toBe(false);
    expect(verifyOtp("attempt-1", "654321", hash)).toBe(false);
  });

  it("never verifies against a missing or corrupt hash", () => {
    expect(verifyOtp("attempt-1", "123456", null)).toBe(false);
    expect(verifyOtp("attempt-1", "", null)).toBe(false);
    expect(verifyOtp("attempt-1", "123456", "not-hex")).toBe(false);
    expect(verifyOtp("attempt-1", "123456", "")).toBe(false);
  });

  it("rejects malformed code shapes", () => {
    expect(isOtpShape("12345")).toBe(false);
    expect(isOtpShape("1234567")).toBe(false);
    expect(isOtpShape("12345a")).toBe(false);
    expect(isOtpShape("")).toBe(false);
    expect(OTP_LENGTH).toBe(6);
  });
});

describe("registration normalisation", () => {
  it("canonicalises email so one address cannot exist in two casings", () => {
    expect(normaliseText("  Ada   Lovelace  ")).toBe("Ada Lovelace");
    // "Ada.Lovelace" is 12 characters; the first two stay, ten are masked.
    expect(maskEmail("Ada.Lovelace@Example.edu")).toBe("Ad**********@Example.edu");
    expect(maskEmail("nonsense")).toBe("your email address");
  });

  it("uppercases and trims registration numbers without altering their content", () => {
    expect(normaliseEnrollmentNo(" 21bfh987 ")).toBe("21BFH987");
    expect(normaliseEnrollmentNo("21bfh987")).toBe("21BFH987");
    // Internal separators are preserved so the format rule can reject them.
    expect(normaliseEnrollmentNo("21 BFH987")).toBe("21 BFH987");
    expect(normaliseEnrollmentNo("21-BFH987")).toBe("21-BFH987");
  });

  it("requires exactly 8 alphanumeric characters", () => {
    const base = { fullName: "Ada", graduationYear: 2027, branch: "CS", email: "a@b.co" };
    expect(startBody.safeParse({ ...base, enrollmentNo: "21BFH987" }).success).toBe(true);
    expect(startBody.safeParse({ ...base, enrollmentNo: "21bfh987" }).success).toBe(true);
    expect(startBody.safeParse({ ...base, enrollmentNo: "21BFH98" }).success).toBe(false);
    expect(startBody.safeParse({ ...base, enrollmentNo: "21BFH9871" }).success).toBe(false);
    expect(startBody.safeParse({ ...base, enrollmentNo: "21 BFH98" }).success).toBe(false);
    expect(startBody.safeParse({ ...base, enrollmentNo: "21-BFH98" }).success).toBe(false);
    expect(startBody.safeParse({ ...base, enrollmentNo: "21BFH98!" }).success).toBe(false);
  });
});

describe("password policy", () => {
  it("requires length, a letter and a digit", () => {
    expect(checkPassword("short1").ok).toBe(false);
    expect(checkPassword("alllettersonly").ok).toBe(false);
    expect(checkPassword("1234567890123").ok).toBe(false);
    expect(checkPassword("campuslink2026").ok).toBe(true);
  });

  it("rejects over-long passwords rather than truncating them", () => {
    expect(checkPassword(`${"a1".repeat(200)}`).ok).toBe(false);
  });

  it("reports every unmet requirement at once for the UI checklist", () => {
    // "abc" is long enough to have a letter, so it fails only length and digit.
    expect(checkPassword("abc").problems).toHaveLength(2);
    expect(checkPassword("abc").problems).toContain("At least 12 characters");
    expect(checkPassword("abc").problems).toContain("At least one number");
    expect(checkPassword("campuslink2026").problems).toHaveLength(0);
  });
});

describe("step bodies", () => {
  it("trims and normalises a valid step-1 payload", () => {
    const parsed = startBody.parse({
      fullName: "  Ada   Lovelace ",
      enrollmentNo: " 21bfh987 ",
      graduationYear: "2027",
      branch: " Computer Science ",
      institution: "  Ravenscourt Institute ",
      email: " Ada@Example.EDU ",
    });
    expect(prepareStart(parsed)).toEqual({
      email: "ada@example.edu",
      fullName: "Ada Lovelace",
      enrollmentNo: "21BFH987",
      branch: "Computer Science",
      institution: "Ravenscourt Institute",
      graduationYear: 2027,
    });
  });

  it("rejects whitespace-only names and malformed emails", () => {
    const base = { enrollmentNo: "21BFH987", graduationYear: 2027, branch: "CS", email: "a@b.co" };
    expect(startBody.safeParse({ ...base, fullName: "   " }).success).toBe(false);
    expect(startBody.safeParse({ ...base, fullName: " Ada " }).success).toBe(true);
    expect(startBody.safeParse({ ...base, fullName: "Ada", branch: "   " }).success).toBe(false);
    expect(startBody.safeParse({ ...base, fullName: "Ada", enrollmentNo: "  -  " }).success).toBe(false);
    expect(startBody.safeParse({ ...base, fullName: "Ada", enrollmentNo: "21" }).success).toBe(false);
    expect(startBody.safeParse({ ...base, fullName: "Ada", email: "not-an-email" }).success).toBe(false);
  });

  it("never stores a value that validation would have rejected once trimmed", () => {
    // Regression: .min(2) on the raw string let "   " through, and trimming
    // then persisted an empty full name.
    const attempt = startBody.safeParse({
      fullName: "   ",
      enrollmentNo: "21BFH987",
      graduationYear: 2027,
      branch: "CS",
      email: "a@b.co",
    });
    expect(attempt.success).toBe(false);
  });

  it("keeps graduation years inside a plausible window", () => {
    const base = { fullName: "Ada", enrollmentNo: "21BFH987", branch: "CS", email: "a@b.co" };
    expect(startBody.safeParse({ ...base, graduationYear: 1999 }).success).toBe(false);
    expect(startBody.safeParse({ ...base, graduationYear: 2099 }).success).toBe(false);
    expect(startBody.safeParse({ ...base, graduationYear: 2027 }).success).toBe(true);
  });

  it("refuses privilege fields in the public step-1 body", () => {
    const escalating = {
      fullName: "Ada Lovelace",
      enrollmentNo: "21BFH987",
      graduationYear: 2027,
      branch: "CS",
      email: "ada@example.edu",
      role: "ADMIN",
      isActive: true,
      companyId: "whatever",
      studentProfileId: "whatever",
    };
    // .strict() means these are unknown keys, not silently-ignored extras.
    expect(startBody.safeParse(escalating).success).toBe(false);
  });

  it("keeps the step-3 body free of profile fields", () => {
    const parsed = completeBody.parse({
      attemptId: "abc",
      completionToken: "tok",
      password: "campuslink2026",
    });
    expect(Object.keys(parsed)).toEqual(["attemptId", "completionToken", "password"]);
    expect(completeBody.safeParse({ ...parsed, role: "ADMIN" }).success).toBe(false);
  });

  it("hashes completion tokens without storing them", () => {
    const hash = hashCompletionToken("raw-token-value");
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("raw-token-value");
    expect(hash).toBe(hashCompletionToken("raw-token-value"));
  });
});
