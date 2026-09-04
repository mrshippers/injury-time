"use client";

/**
 * One channel per page: calls for this fixture and notices for this club.
 * Row-level security still applies to what the socket delivers, so a guest on
 * a demo club sees the demo, and a member sees their own club only.
 */
import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";
import type { MatchCall, Notification } from "@/lib/types";

export type TeamRealtimeHandlers = {
  onCall?: (call: MatchCall, event: "INSERT" | "UPDATE" | "DELETE") => void;
  onNotice?: (notice: Notification) => void;
};

export function useTeamRealtime(clubId: string, fixtureId: string | null, handlers: TeamRealtimeHandlers): void {
  // handlers change identity every render; the channel must not
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`team:${clubId}:${fixtureId ?? "none"}`);

    if (fixtureId) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_calls", filter: `fixture_id=eq.${fixtureId}` },
        (payload) => {
          const event = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
          const row = (event === "DELETE" ? payload.old : payload.new) as MatchCall;
          latest.current.onCall?.(row, event);
        },
      );
    }
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `club_id=eq.${clubId}` },
      (payload) => {
        latest.current.onNotice?.(payload.new as Notification);
      },
    );
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clubId, fixtureId]);
}
