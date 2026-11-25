// B2: one-time-code sign-up. Pure parts, and the promise that screens don't know
// which provider sends the code.
import { readFileSync, readdirSync } from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CODE_LENGTH, OTP_ERRORS, OTP_TEXT, OtpError, cleanCode, missingFor, otpText, phoneOf, skilledAccount, skilledJobProfile } from "../../src/utils/otp.js";
import { isApplyReady, splitProfile } from "../../src/utils/jobProfile.js";

const fake = vi.hoisted(() => ({ send: null }));
vi.mock("../../src/lib/otp/firebaseProvider.js", () => ({ send: (p) => fake.send(p) }));
const { sendOtp } = await import("../../src/lib/otp/index.js");

const F = { name: " Ramesh  Kumar ", trades: ["mason", "made_up"], city: " Thane ", openToEmployers: true };

describe("text", () => {
  it("every error has English and Hindi", () => {
    for (const [en, hi] of Object.values(OTP_TEXT)) {
      expect(en).toMatch(/[a-z]/i);
      expect(hi).toMatch(/[\u0900-\u097F]/);
    }
    expect(otpText("made_up")).toEqual(OTP_TEXT.failed);
  });
});

describe("input", () => {
  it("code: digits only, 6 at most", () => {
    expect([cleanCode("12 34-56"), cleanCode("1234567"), cleanCode("ab"), cleanCode(null)]).toEqual(["123456", "123456", "", ""]);
    expect(CODE_LENGTH).toBe(6);
  });
  it("only an Indian mobile counts as confirmed", () => {
    expect(phoneOf("+919876500001")).toBe("9876500001");
    for (const p of [null, "", "9876500001", "+915876500001", "+14155550100", "+9198765000011"]) expect(phoneOf(p)).toBeNull();
  });
  it("each question must be answered", () => {
    const empty = { name: " ", trades: [], city: "", openToEmployers: null };
    for (const k of ["name", "trade", "city", "choice"]) { expect(missingFor(k, empty)).toBe(k); expect(missingFor(k, F)).toBe(""); }
    expect(missingFor("trade", { trades: ["made_up"] })).toBe("trade");
    expect(missingFor("choice", { openToEmployers: false })).toBe("");
  });
});

describe("the account", () => {
  it("no email, an ordinary role, nothing privileged", () => {
    const u = skilledAccount(F, "u1", "9876500001", new Date("2026-11-25T00:00:00Z"));
    expect(u).toMatchObject({ uid: "u1", name: "Ramesh Kumar", phone: "9876500001", email: null, workEmail: null, role: "jobseeker", city: "Thane" });
    for (const k of ["storeId", "verificationStatus", "jobBusiness"]) expect(u).not.toHaveProperty(k);
  });
  it("a job profile ready to apply, with the answer they gave and no made-up email", () => {
    const pr = skilledJobProfile(F, "9876500001");
    expect(isApplyReady(pr, "skilled")).toBe(true);
    const { pub, priv } = splitProfile(pr);
    expect(pub).toMatchObject({ lane: "skilled", trades: ["mason"], city: "Thane", cityKey: "thane", openToEmployers: true, searchable: true });
    expect(priv).toMatchObject({ phone: "9876500001", email: "" });
    expect(splitProfile(skilledJobProfile({ ...F, openToEmployers: false }, "9876500001")).pub.searchable).toBe(false);
  });
});

describe("provider contract", () => {
  beforeEach(() => { fake.send = async () => ({ confirm: async () => {} }); });
  it("send → confirm", async () => {
    const seen = [];
    fake.send = async (p) => { seen.push(p); return { confirm: async (c) => { seen.push(c); }, secret: 1 }; };
    const s = await sendOtp("9876500001");
    expect(Object.keys(s)).toEqual(["confirm"]);
    await s.confirm("123456");
    expect(seen).toEqual(["9876500001", "123456"]);
  });
  it("only the fixed errors get out, from either step", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const code of OTP_ERRORS) {
      fake.send = async () => { throw new OtpError(code); };
      await expect(sendOtp("1")).rejects.toMatchObject({ name: "OtpError", code });
    }
    for (const bad of [new Error("msg91: 401"), Object.assign(new Error("x"), { code: "auth/internal-error" }), new OtpError("msg91_down"), "text"]) {
      fake.send = async () => { throw bad; };
      await expect(sendOtp("1")).rejects.toMatchObject({ name: "OtpError", code: "failed" });
      fake.send = async () => ({ confirm: async () => { throw bad; } });
      await expect((await sendOtp("1")).confirm("1")).rejects.toMatchObject({ code: "failed" });
    }
  });
  it("nothing outside src/lib/otp knows the provider", () => {
    const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
    for (const f of walk("src").filter(x => /\.jsx?$/.test(x) && !x.startsWith("src/lib/otp/"))) {
      expect([f, /signInWithPhoneNumber|RecaptchaVerifier|PhoneAuthProvider|firebaseProvider/.test(readFileSync(f, "utf8"))]).toEqual([f, false]);
    }
  });
});
