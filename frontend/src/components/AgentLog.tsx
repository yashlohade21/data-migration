"use client";
import { SSEEvent } from "@/lib/types";
import { Terminal, AlertCircle, CheckCircle2, Clock, ArrowRight, Zap, WifiOff, Wifi } from "lucide-react";
import { useRef, useEffect } from "react";

interface Props {
  events: SSEEvent[];
  connected?: boolean;
  reconnecting?: boolean;
}

export default function AgentLog({ events, connected, reconnecting }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [events]);

  const getIcon = (event: string) => {
    switch (event) {
      case "error": return <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
      case "complete": return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case "awaiting_review": return <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case "phase": return <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
      case "mapping": return <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
      case "cancelled": return <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
      default: return <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-gray-500" /></span>;
    }
  };

  const getMessage = (e: SSEEvent) => {
    if (e.data.message) return e.data.message;
    if (e.event === "phase") return `${e.data.phase} — ${e.data.status}`;
    if (e.event === "mapping") return `${e.data.source} -> ${e.data.target} (${Math.round(e.data.confidence * 100)}%)`;
    return JSON.stringify(e.data);
  };

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-850">
        <div className="flex gap-1.5 mr-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
        </div>
        <Terminal className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-[12px] font-semibold text-gray-400 tracking-wide">Agent Log</span>
        <div className="flex-1" />
        {events.length > 0 && (
          <span className="text-[10px] font-mono font-medium text-gray-600 tabular-nums">{events.length} events</span>
        )}
        {reconnecting ? (
          <div className="flex items-center gap-1.5" title="Reconnecting...">
            <WifiOff className="w-3 h-3 text-amber-400 animate-pulse" />
            <span className="text-[10px] text-amber-400">Reconnecting</span>
          </div>
        ) : connected ? (
          <div className="flex items-center gap-1.5" title="Connected">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        ) : (
          <div className={`w-2 h-2 rounded-full ${events.length > 0 ? "bg-gray-600" : "bg-gray-700"}`} />
        )}
      </div>
      <div ref={scrollRef} className="max-h-80 overflow-y-auto p-4 space-y-2 font-mono text-[12px] leading-relaxed agent-log-scroll">
        {events.length === 0 ? (
          <div className="text-gray-600 flex items-center gap-2 py-8 justify-center">
            <Terminal className="w-4 h-4" />
            <span>Waiting for agent...</span>
          </div>
        ) : (
          events.map((e, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 animate-slide-in"
              style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}
            >
              <span className="mt-0.5">{getIcon(e.event)}</span>
              <span className={`
                ${e.event === "error" ? "text-red-300" : ""}
                ${e.event === "awaiting_review" ? "text-amber-300 font-semibold" : ""}
                ${e.event === "complete" ? "text-emerald-300 font-semibold" : ""}
                ${e.event === "cancelled" ? "text-red-300 font-semibold" : ""}
                ${e.event === "phase" ? "text-indigo-300" : ""}
                ${!["error", "awaiting_review", "complete", "phase", "cancelled"].includes(e.event) ? "text-gray-400" : ""}
              `}>
                {getMessage(e)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
