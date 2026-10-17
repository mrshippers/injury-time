/** The shapes the No.2 answers in. Kept out of the "use server" actions file, which may only export functions. */
import { z } from "zod";

export const ReportSchema = z.object({
  headline: z.string().describe("a club-website headline, under 10 words, no clickbait"),
  report: z.string().describe("the write-up: 3 short paragraphs, the facts given, nothing invented"),
  social: z.string().describe("one post for the club's socials, under 240 characters, score first, scorers named"),
});
export type MatchReport = z.infer<typeof ReportSchema>;

export const AnswerSchema = z.object({
  answer: z.string().describe("the answer in 1-3 sentences, plain football language"),
  figures: z.array(z.object({ label: z.string(), value: z.string() })).describe("the 2-4 numbers the answer rests on"),
  can_answer: z.boolean().describe("false when the data doesn't hold what the question needs"),
});
export type No2Answer = z.infer<typeof AnswerSchema>;

export const NudgeSchema = z.object({ message: z.string().describe("the group-chat message, under 320 characters") });
