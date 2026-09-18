"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Session } from "@/lib/types";

export function useSession(sessionId: string) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getSession(sessionId);
      setSession(data);
    } catch (err) {
      console.error("Failed to fetch session:", err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { session, loading, refresh };
}
