"use client";
import { useState, useEffect, use } from "react";
import { api } from "@/lib/api";
import { ColumnMapping, Session } from "@/lib/types";
import MappingTable from "@/components/MappingTable";
import Link from "next/link";
import { ArrowRight, Loader2, Check, AlertTriangle, User, Eye } from "lucide-react";

export default function MappingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [session, setSession] = useState<Session | null>(null);

  const loadMappings = () => {
    Promise.all([api.getMappings(id), api.getSession(id)])
      .then(([maps, sess]) => { setMappings(maps); setSession(sess); })
      .catch((e: Error) => setError(e.message || "Failed to load mappings"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadMappings(); }, [id]);

  // Dynamic thresholds from session stats (set by agent based on autonomy level)
  const autoThreshold = session?.stats?.auto_threshold ?? 0.85;
  const escThreshold = session?.stats?.esc_threshold ?? 0.5;

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  }

  if (mappings.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <p className="text-slate-500 text-sm">No mappings yet. Upload files and start the agent first.</p>
      </div>
    );
  }

  const auto = mappings.filter((m) => m.status === "auto_accepted").length;
  const needsReview = mappings.filter((m) => m.status === "needs_review").length;
  const escalated = mappings.filter((m) => m.status === "escalated").length;
  const human = mappings.filter((m) => ["human_approved", "human_overridden"].includes(m.status)).length;

  const filteredMappings = filter === "all" ? mappings : mappings.filter((m) => {
    if (filter === "needs_review") return m.status === "needs_review";
    if (filter === "auto") return m.status === "auto_accepted";
    if (filter === "escalated") return m.status === "escalated";
    return true;
  });

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Check className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{auto}</p>
            <p className="text-xs text-slate-500">Auto-accepted</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <Eye className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{needsReview}</p>
            <p className="text-xs text-slate-500">Needs Review</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{escalated}</p>
            <p className="text-xs text-slate-500">Escalated</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <User className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{human}</p>
            <p className="text-xs text-slate-500">Human-resolved</p>
          </div>
        </div>
      </div>

      {/* Threshold Legend — dynamic based on autonomy level */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-3 flex items-center gap-6 text-xs text-slate-600 shadow-sm flex-wrap">
        <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Thresholds</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          &ge;{Math.round(autoThreshold * 100)}% Auto-accepted
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          {Math.round(escThreshold * 100)}&ndash;{Math.round(autoThreshold * 100 - 1)}% Reviewable
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          &lt;{Math.round(escThreshold * 100)}% Escalated
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Column Mappings</h2>
            <p className="text-xs text-slate-400 mt-0.5">{mappings.length} mappings across all files</p>
          </div>
          <Link
            href={`/session/${id}/review`}
            className="flex items-center gap-2 h-9 px-4 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Review <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {/* Filter pills */}
        <div className="px-6 py-3 border-b border-slate-100 flex gap-2 flex-wrap">
          {([
            { key: "all", label: "All", count: mappings.length },
            { key: "needs_review", label: "Needs Review", count: needsReview },
            { key: "auto", label: "Auto", count: auto },
            { key: "escalated", label: "Escalated", count: escalated },
          ] as const).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                filter === key
                  ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
        <MappingTable mappings={filteredMappings} sessionId={id} onUpdate={loadMappings} />
      </div>
    </div>
  );
}
