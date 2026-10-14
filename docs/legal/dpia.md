# Data protection impact assessment: DRAFT

**Status: a working draft, not legal advice.** It records what the software does
with health data as of migration 0014, so a solicitor can confirm or correct it
before a real club goes live. Nothing in the brief's design gate (system 9)
passes until a solicitor's sign-off is recorded at the bottom of this file.

Prepared 4 Oct 2026 from the code in this repository. Every claim about access
is checked by `npm run db:probe` against a database with every migration applied.

## 1. What is processed, and why

Injury Time helps a non-league football club pick a side and look after its
players: who is fit, who is injured and roughly where, when they are expected
back, and how much training load they are carrying.

| data | table | about | why |
|---|---|---|---|
| injury: body region, side, severity, dates | `injuries` | a named player | pick a side; plan a return |
| availability: fit, doubt, injured, suspended | `availability_events` | a named player | pick a side |
| return-to-play stage and dates | `rtp_steps` | a named player's injury | plan a return |
| short medical note (max 280 characters) | `medical_notes` | a named player | the physio's working record |
| training load: perceived effort (RPE 1-10) x minutes | `session_loads` | a named player | spot overload |
| daily check-in: soreness, effort, available | `player_checkins` | a named player | spot soreness early |
| body measurements (cm) | `players.body_params` | a named player | the 3D figure |
| date of birth (consent only, adults check) | `health_consents` | a named player | prove the player is 18 or over |

Injury, availability (doubt/injured), return-to-play, notes and check-ins are
treated as **health data, special category under UK GDPR Article 9**. See
section 6 for the items this draft is unsure about.

## 2. Roles

- **Controller:** each club, for its own players. The club decides to record
  this and why.
- **Processor:** Injury Time (the operator), hosting and running the software for
  the club. *Needs:* a data processing agreement with each club.
- **Sub-processors:** Supabase (database and authentication), Vercel (hosting),
  Anthropic (film analysis, only when a club uses it: clip events, which may name
  players, go to the API). *Needs:* each one's region and transfer terms
  confirmed; this draft has not checked them.

## 3. Lawful basis

- Article 6: consent (6(1)(a)), the same consent as below. *Solicitor to
  confirm*: is legitimate interests better for the non-health parts?
- Article 9 condition: **explicit consent (9(2)(a))**, given by the player
  themself, recorded with the wording version (`health_consents.wording_version`,
  currently v1, in `src/lib/health/consent.ts`), the date, and the route (their
  own account or their private link). Staff cannot give it for a player; the
  database refuses (`give_health_consent` checks the caller is that player).

## 4. Controls the software enforces

All in the database, so no client, form or direct API call can get round them:

1. **No consent, no health row.** A trigger on `injuries`, `availability_events`
   (doubt, injured, or linked to an injury), `rtp_steps` and `medical_notes`
   refuses the write for a real club's player without live consent
   (`health_consent_required`). Fit and suspended are allowed: they say nothing
   about the body.
2. **Adults only.** Consent needs a date of birth 18 or more years ago. Sign-up
   needs the person to confirm the side is adult.
3. **Reads by role** (printed by the probe):

   | | anon | outsider | teammate | the player | coach | manager | medical |
   |---|---|---|---|---|---|---|---|
   | injuries, availability, loads, RTP, check-ins, consent | 0 | 0 | 0 | yes | yes | yes | yes |
   | medical notes | 0 | 0 | 0 | yes | 0 | 0 | yes |

   Before 0014, every club member, a player included, could read (and write)
   every teammate's injuries through the API; only the screens hid them.
4. **Withdrawal:** the player, signed in, withdraws; nothing new is written after.
5. **Erasure on request:** the player (signed in, or from their private link),
   or the manager or medical staff on their request, deletes every health row
   about them in one call (`erase_player_health`). What was deleted is logged as
   counts per table, never the content (`health_erasures`).
6. **Notes are short and structured to a player:** no free text anywhere else
   (the rule since 0001).
7. **Demo clubs** carry no real person's health data: Kilburn Athletic is
   invented; Belstone is read-only public league data with no injuries.

## 5. Risks and what reduces them

| risk | likelihood | impact | reduced by |
|---|---|---|---|
| a teammate sees an injury | was certain (pre-0014) | high | role-gated reads, probe in the verify step |
| staff record health data without the player agreeing | medium | high | database consent gate |
| an under-18 is recorded | low | high | adults-only sign-up and consent check |
| a private link is forwarded | medium | medium | the link can consent or erase, not read anything |
| data kept forever | high | medium | **not yet addressed: no retention period (see 6)** |
| a club's account is taken over | low | high | magic-link sign-in; **no 2FA yet** |

## 6. Open questions for the solicitor

1. **Training load.** `session_loads` holds perceived effort (RPE) alongside
   minutes and goals. Reads are role-gated, but **writes are not consent-gated**,
   because the same row carries match statistics. Is RPE health data? If so it
   needs splitting from the statistics, or gating.
2. **Body measurements** (`players.body_params`) are readable by every club
   member, teammates included. Is that health data? If so they move behind the
   same rules.
3. **Film analysis** sends tagged clip events (which can include an "injury"
   event naming a player) to Anthropic. Does that need its own consent line, or
   should injury events be stripped before analysis?
4. **Retention:** how long does a club keep a player's health data after they
   leave? Nothing deletes it automatically today.
5. **Processor terms and transfers:** Supabase and Vercel regions, Anthropic's
   terms; a DPA template for clubs.
6. **The consent wording** (v1, `src/lib/health/consent.ts`): fit for purpose?
7. **Under-18s:** out of scope until parental consent and safeguarding are
   specified in a brief of their own.

## Sign-off

| | name | date |
|---|---|---|
| solicitor reviewed | | |
| changes made for it | | |
