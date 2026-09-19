"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Session } from "@/lib/types";
import {
  Plus, ArrowRight, Database, Clock,
  CheckCircle, AlertTriangle, Loader2,
  Upload, GitMerge, Search, Send, ClipboardCheck,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  created: { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400" },
  uploading: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  processing: { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
  awaiting_review: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  ready_to_push: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  pushing: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  completed: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  error: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

const STEPS = [
  { num: 1, label: "Upload", desc: "CSV / Excel files", icon: Upload },
  { num: 2, label: "Map", desc: "Auto-match columns", icon: GitMerge },
  { num: 3, label: "Review", desc: "Fix edge cases", icon: Search },
  { num: 4, label: "Push", desc: "Send to target", icon: Send },
  { num: 5, label: "Audit", desc: "Full trail", icon: ClipboardCheck },
];

export default function Home() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listSessions().then(setSessions).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  const createSession = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const session = await api.createSession(name.trim());
      router.push(`/session/${session.id}/upload`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create session");
    } finally {
      setCreating(false);
    }
  };

  const getSessionHref = (s: Session) => {
    if (s.status === "created" || s.status === "uploading") return `/session/${s.id}/upload`;
    if (s.status === "completed" || s.status === "ready_to_push") return `/session/${s.id}/push`;
    return `/session/${s.id}/review`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      {/* Hero */}
      <div className="text-center pt-12 pb-6 hero-section rounded-3xl -mx-2 px-6 relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight gradient-text leading-tight pb-2">
            Data Migration Agent
          </h1>
          <p className="text-gray-500 mt-3 text-[15px] max-w-lg mx-auto leading-relaxed">
            Transform messy HR data from multiple CSV and Excel files into a clean,
            unified schema — with intelligent automation and human oversight.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center justify-between gap-1 px-2">
        {STEPS.map((step, i) => (
          <div key={step.num} className="flex items-center gap-1 flex-1 last:flex-none">
            <div className="flex flex-col items-center text-center">
              <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                <step.icon className="w-4 h-4 text-indigo-600" />
              </div>
              <span className="text-[11px] font-bold text-gray-900 mt-1.5">{step.label}</span>
              <span className="text-[10px] text-gray-400 leading-tight">{step.desc}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="h-px flex-1 bg-gray-200 mx-1 mt-[-20px]" />
            )}
          </div>
        ))}
      </div>

      {/* Create session */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-600" />
            New Session
          </h2>
        </div>
        <div className="px-6 py-5">
          <div className="flex gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q4 HR Data Migration"
              aria-label="Session name"
              className="flex-1 h-12 border border-gray-200 rounded-xl px-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition placeholder:text-gray-400 bg-white"
              onKeyDown={(e) => e.key === "Enter" && createSession()}
            />
            <button
              onClick={createSession}
              disabled={creating || !name.trim()}
              className="h-12 px-7 btn-primary flex items-center gap-2 text-sm"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Create
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-600 mt-3 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Session list */}
      {loaded && sessions.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              Recent Sessions
            </h2>
            <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">{sessions.length}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {sessions.map((s, i) => {
              const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.created;
              return (
                <Link
                  key={s.id}
                  href={getSessionHref(s)}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-indigo-50/40 transition-all duration-150 group"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0 group-hover:border-indigo-300 group-hover:bg-indigo-50 transition-all">
                    <Database className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[13px] text-gray-900 truncate group-hover:text-indigo-900 transition-colors">{s.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {new Date(s.created_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                      {s.stats?.pushed != null && (
                        <span className="ml-2 text-emerald-600 font-semibold">{s.stats.pushed} pushed</span>
                      )}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${cfg.bg} ${cfg.text} border border-transparent`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${s.status === "processing" ? "animate-pulse" : ""}`} />
                    {s.status.replace(/_/g, " ")}
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {loaded && sessions.length === 0 && (
        <div className="text-center py-10">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4 border border-gray-200">
            <Database className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm text-gray-500 font-medium">No sessions yet</p>
          <p className="text-xs text-gray-400 mt-1">Create one above to get started.</p>
        </div>
      )}

      {/* Loading skeleton */}
      {!loaded && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="card p-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl animate-shimmer" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded animate-shimmer" />
                  <div className="h-3 w-24 rounded animate-shimmer" />
                </div>
                <div className="h-6 w-20 rounded-lg animate-shimmer" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
