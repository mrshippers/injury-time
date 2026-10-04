import { describe, expect, it } from "vitest";

import { CONSENT_VERSION, consentError, consentWording } from "@/lib/health/consent";

describe("consent, in words", () => {
  it("turns the database's refusal into what the manager should do", () => {
    const pg = 'new row for relation "injuries" violates check constraint "health_consent_required"';
    const msg = consentError(`health_consent_required: this player has not given consent for health data (${pg})`, "Sam");
    expect(msg).toContain("Sam has not given consent for health data yet");
    expect(msg).toContain("consent link");
    expect(msg).toContain("Fit and suspended still work");
  });
  it("says the under-18 rule plainly, and passes anything else through", () => {
    expect(consentError("under_18: this club cannot hold health data for under-18s yet")).toBe("Injury Time does not hold health data for under-18s.");
    expect(consentError("duplicate key")).toBe("duplicate key");
  });
  it("the wording is versioned and names who sees what", () => {
    expect(CONSENT_VERSION).toMatch(/^v[0-9]{1,3}$/); // the database's check on health_consents.wording_version
    const w = consentWording("Probe FC").points.join(" ");
    expect(w).toContain("Only medical staff and you can read them");
    expect(w).toContain("teammates never see");
    expect(w).toContain("18 or over");
  });
});
