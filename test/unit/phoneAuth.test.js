// Pure unit tests for src/utils/phoneAuth.js — the mobile-signup/login
// normalisation rule (no OTP/SMS, see that file's header comment).
import { describe, it, expect } from "vitest";
import { normalizeIndianMobile, phoneToSyntheticEmail, isSyntheticPhoneEmail, resolveAuthEmail } from "../../src/utils/phoneAuth.js";

describe("normalizeIndianMobile", () => {
  it("accepts a bare 10-digit mobile", () => {
    expect(normalizeIndianMobile("9876543210")).toBe("9876543210");
  });

  it("strips formatting punctuation", () => {
    expect(normalizeIndianMobile("98765-43210")).toBe("9876543210");
    expect(normalizeIndianMobile("+91 98765 43210")).toBe("9876543210");
    expect(normalizeIndianMobile("(987) 654-3210")).toBe("9876543210");
  });

  it("drops a leading 91 country code on a 12-digit input", () => {
    expect(normalizeIndianMobile("919876543210")).toBe("9876543210");
  });

  it("drops a leading 0 trunk prefix on an 11-digit input", () => {
    expect(normalizeIndianMobile("09876543210")).toBe("9876543210");
  });

  it("rejects a number that doesn't start with 6-9", () => {
    expect(normalizeIndianMobile("5876543210")).toBe(null);
  });

  it("rejects too few or too many digits", () => {
    expect(normalizeIndianMobile("987654321")).toBe(null);
    expect(normalizeIndianMobile("98765432100")).toBe(null);
  });

  it("rejects empty/garbage input rather than throwing", () => {
    expect(normalizeIndianMobile("")).toBe(null);
    expect(normalizeIndianMobile(undefined)).toBe(null);
    expect(normalizeIndianMobile("not a number")).toBe(null);
  });

  it("is deterministic — the same phone in different formats maps to the same digits", () => {
    const a = normalizeIndianMobile("+91-98765-43210");
    const b = normalizeIndianMobile("09876543210");
    const c = normalizeIndianMobile("9876543210");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

describe("phoneToSyntheticEmail / isSyntheticPhoneEmail", () => {
  it("maps normalised digits to the synthetic phone domain", () => {
    expect(phoneToSyntheticEmail("9876543210")).toBe("9876543210@phone.tinit.in");
  });

  it("round-trips through isSyntheticPhoneEmail", () => {
    expect(isSyntheticPhoneEmail(phoneToSyntheticEmail("9876543210"))).toBe(true);
    expect(isSyntheticPhoneEmail("real.person@gmail.com")).toBe(false);
  });
});

describe("resolveAuthEmail", () => {
  it("treats an '@'-containing identifier as a real email, unchanged", () => {
    const r = resolveAuthEmail("person@example.com");
    expect(r.email).toBe("person@example.com");
    expect(r.isPhone).toBe(false);
  });

  it("resolves a bare mobile number to its synthetic email", () => {
    const r = resolveAuthEmail("98765 43210");
    expect(r.email).toBe("9876543210@phone.tinit.in");
    expect(r.isPhone).toBe(true);
    expect(r.phone).toBe("9876543210");
  });

  it("errors on an empty identifier", () => {
    expect(resolveAuthEmail("").error).toBeTruthy();
  });

  it("errors on a malformed non-email identifier instead of silently resolving", () => {
    expect(resolveAuthEmail("12345").error).toBeTruthy();
  });
});
