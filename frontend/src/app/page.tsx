"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Session } from "@/lib/types";
import {
  Plus, ArrowRight, Database, Clock, Layers,
  CheckCircle, AlertTriangle, Loader2,
  Shield, Zap, GitMerge, Users,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  created: { bg: "bg-slate-100", text: "text-slate-600", icon: Clock },
  uploading: { bg: "bg-blue-50", text: "text-blue-600", icon: Loader2 },
  processing: { bg: "bg-blue-50", text: "text-blue-600", icon: Loader2 },
  awaiting_review: { bg: "bg-amber-50", text: "text-amber-600", icon: AlertTriangle },
  ready_to_push: { bg: "bg-emerald-50", text: "text-emerald-600", icon: CheckCircle },
  pushing: { bg: "bg-blue-50", text: "text-blue-600", icon: Loader2 },
  completed: { bg: "bg-emerald-50", text: "text-emerald-600", icon: CheckCircle },
  error: { bg: "bg-red-50", text: "text-red-600", icon: AlertTriangle },
};

const FEATURES = [
  { icon: Zap, title: "Auto Schema Mapping", desc: "Intelligent column matching with confidence scores", color: "text-indigo-600", bg: "bg-indigo-50" },
  { icon: GitMerge, title: "Smart Deduplication", desc: "Fuzzy name + email matching across files", color: "text-violet-600", bg: "bg-violet-50" },
  { icon: Shield, title: "Data Validation", desc: "Per-field rules with auto-fix attempts", color: "text-emerald-600", bg: "bg-emerald-50" },
  { icon: Users, title: "Human-in-the-Loop", desc: "Review only what the agent can't decide", color: "text-blue-600", bg: "bg-blue-50" },
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
      <div className="text-center pt-10 pb-4 hero-gradient rounded-3xl -mx-2 px-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold mb-6 border border-indigo-100 shadow-sm">
          <Layers className="w-3.5 h-3.5" />
          AI-Powered Migration Pipeline
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight gradient-text leading-tight pb-1">
          Data Migration Agent
        </h1>
        <p className="text-slate-500 mt-4 text-[15px] max-w-lg mx-auto leading-relaxed">
          Transform messy HR data from multiple CSV and Excel files into a clean, unified schema — with intelligent automation and human oversight.
        </p>
      </div>

      {/* Feature pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="flex items-start gap-3 bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 group">
            <div className={`w-9 h-9 rounded-lg ${f.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
              <f.icon className={`w-4 h-4 ${f.color}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{f.title}</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Create */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-500" />
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
              className="flex-1 h-12 border border-slate-200 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition placeholder:text-slate-400 bg-slate-50/50 focus:bg-white"
              onKeyDown={(e) => e.key === "Enter" && createSession()}
            />
            <button
              onClick={createSession}
              disabled={creating || !name.trim()}
              className="h-12 px-7 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-semibold text-sm hover:from-indigo-700 hover:to-blue-700 active:from-indigo-800 active:to-blue-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-md shadow-indigo-200/50 hover:shadow-lg hover:shadow-indigo-200/60"
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

      {/* Sessions */}
      {loaded && sessions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Recent Sessions
              <span className="text-xs font-medium text-slate-400 ml-auto">{sessions.length} total</span>
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {sessions.map((s, i) => {
              const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.created;
              const Icon = cfg.icon;
              return (
                <Link
                  key={s.id}
                  href={getSessionHref(s)}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-indigo-50/40 transition-colors group"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200 flex items-center justify-center shrink-0 group-hover:border-indigo-200 group-hover:from-indigo-50 group-hover:to-blue-50 transition-all">
                    <Database className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900 truncate group-hover:text-indigo-900 transition-colors">{s.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(s.created_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                      {s.stats?.pushed != null && (
                        <span className="ml-2 text-emerald-500 font-medium">{s.stats.pushed} pushed</span>
                      )}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                    <Icon className={`w-3.5 h-3.5 ${s.status === "processing" ? "animate-spin" : ""}`} />
                    {s.status.replace(/_/g, " ")}
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {loaded && sessions.length === 0 && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Database className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm text-slate-400">No sessions yet. Create one above to get started.</p>
        </div>
      )}

      {/* Loading skeleton */}
      {!loaded && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6">
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
