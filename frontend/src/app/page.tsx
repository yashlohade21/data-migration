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
  { icon: Zap, title: "Auto Schema Mapping", desc: "Intelligent column matching with confidence scores" },
  { icon: GitMerge, title: "Smart Deduplication", desc: "Fuzzy name + email matching across files" },
  { icon: Shield, title: "Data Validation", desc: "Per-field rules with auto-fix attempts" },
  { icon: Users, title: "Human-in-the-Loop", desc: "Review only what the agent can't decide" },
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
    <div className="max-w-2xl mx-auto space-y-10 animate-fade-in">
      {/* Hero */}
      <div className="text-center pt-8 pb-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold mb-5 border border-indigo-100">
          <Layers className="w-3.5 h-3.5" />
          AI-Powered Migration Pipeline
        </div>
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
          Data Migration Agent
        </h1>
        <p className="text-slate-500 mt-3 text-[15px] max-w-lg mx-auto leading-relaxed">
          Transform messy HR data from multiple CSV and Excel files into a clean, unified schema — with intelligent automation and human oversight.
        </p>
      </div>

      {/* Feature pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="flex items-start gap-3 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <f.icon className="w-4 h-4 text-indigo-600" />
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
              className="flex-1 h-11 border border-slate-200 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition placeholder:text-slate-400"
              onKeyDown={(e) => e.key === "Enter" && createSession()}
            />
            <button
              onClick={createSession}
              disabled={creating || !name.trim()}
              className="h-11 px-6 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-sm hover:shadow"
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
            <p className="text-sm text-red-600 mt-2">{error}</p>
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
                  className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/80 transition-colors group"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-slate-200/80 transition-colors">
                    <Database className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900 truncate">{s.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(s.created_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                      {s.stats?.pushed != null && (
                        <span className="ml-2 text-emerald-500">{s.stats.pushed} pushed</span>
                      )}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                    <Icon className={`w-3.5 h-3.5 ${s.status === "processing" ? "animate-spin" : ""}`} />
                    {s.status.replace(/_/g, " ")}
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {loaded && sessions.length === 0 && (
        <p className="text-center text-sm text-slate-400 py-4">No sessions yet. Create one above to get started.</p>
      )}
    </div>
  );
}
