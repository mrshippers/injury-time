/**
 * The words a player agrees to before any health data about them is kept
 * (0014). The version is recorded with each consent, so changing a word means
 * a new version and asking again. Draft wording: a solicitor confirms it
 * before a real club goes live (docs/legal/dpia.md).
 */
export const CONSENT_VERSION = "v1";

export function consentWording(club: string): { heading: string; points: string[] } {
  return {
    heading: `Your health data at ${club}`,
    points: [
      `${club}'s staff (the manager, coaches and medical) can record injuries, whether you are fit, your return-to-play steps and your training load.`,
      "Medical staff can write short notes. Only medical staff and you can read them. The manager sees whether you are fit and when you are back, never the notes.",
      "Your teammates never see any of it.",
      "It is there so the staff can pick a side without guessing and look after your fitness. Nothing else, and it is never sold or shared outside the club.",
      "You can withdraw whenever you like, here: nothing new is recorded after that. You can also have all of it deleted, here, in one tap.",
      "You must be 18 or over. Injury Time does not hold health data for under-18s.",
    ],
  };
}

/** What the database said, in words a manager can act on. */
export function consentError(message: string, playerName?: string): string {
  const who = playerName ?? "This player";
  if (message.includes("health_consent_required")) {
    return `${who} has not given consent for health data yet, so injuries, doubts and notes cannot be recorded. Send them their consent link from their page. Fit and suspended still work.`;
  }
  if (message.includes("under_18")) return "Injury Time does not hold health data for under-18s.";
  return message;
}
