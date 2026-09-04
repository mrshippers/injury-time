import { redirect } from "next/navigation";

/** The lineup lives in the squad room now: list on the left, pitch on the right. */
export default function LineupPage() {
  redirect("/squad");
}
