"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { SSEEvent } from "@/lib/types";
import { API_BASE } from "@/lib/api";

const MAX_EVENTS = 500;
const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;

export function useSSE(sessionId: string | null) {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const intentional = useRef(false); // true when user calls disconnect()

  const cleanup = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!sessionId) return;
    cleanup();
    intentional.current = false;
    retryCount.current = 0;
    setReconnecting(false);

    const open = () => {
      const es = new EventSource(`${API_BASE}/sessions/${sessionId}/stream`);
      esRef.current = es;

      es.onopen = () => {
        setConnected(true);
        setReconnecting(false);
        retryCount.current = 0;
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        esRef.current = null;

        if (intentional.current) return;

        // Exponential backoff reconnect
        const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, retryCount.current), MAX_RECONNECT_DELAY);
        retryCount.current += 1;
        setReconnecting(true);
        reconnectTimer.current = setTimeout(open, delay);
      };

      const eventTypes = [
        "status", "phase", "log", "mapping", "awaiting_review",
        "error", "complete", "cancelled", "ping",
      ];
      eventTypes.forEach((type) => {
        es.addEventListener(type, (e: MessageEvent) => {
          if (type === "ping") return;
          try {
            const data = JSON.parse(e.data);
            setEvents((prev) => {
              const next = [...prev, { event: type, data }];
              return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
            });
          } catch { /* malformed event, skip */ }
        });
      });
    };

    open();
  }, [sessionId, cleanup]);

  const disconnect = useCallback(() => {
    intentional.current = true;
    cleanup();
    setConnected(false);
    setReconnecting(false);
  }, [cleanup]);

  useEffect(() => {
    return () => {
      intentional.current = true;
      cleanup();
    };
  }, [cleanup]);

  const setInitialEvents = useCallback((initial: SSEEvent[]) => {
    setEvents((prev) => prev.length === 0 ? initial : prev);
  }, []);

  return { events, connected, reconnecting, connect, disconnect, clearEvents: () => setEvents([]), setInitialEvents };
}
