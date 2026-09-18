"use client";
import { useSession } from "@/hooks/useSession";
import StepIndicator from "@/components/StepIndicator";
import { use } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Shield, Scale, Zap } from "lucide-react";

const TABS = [
  { label: "Upload", path: "upload" },
  { label: "Mapping", path: "mapping" },
  { label: "Review", path: "review" },
  { label: "Push", path: "push" },
  { label: "Audit", path: "audit" },
];

export default function SessionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { session, loading } = useSession(id);
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-32">
        <p className="text-slate-500">Session not found</p>
        <Link href="/" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">Go back</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors shrink-0" aria-label="Back to sessions">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{session.name}</h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{session.id.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Autonomy level badge */}
          {session.autonomy_level && (
            <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-medium ${
              session.autonomy_level === "conservative" ? "bg-indigo-50 text-indigo-600" :
              session.autonomy_level === "aggressive" ? "bg-amber-50 text-amber-600" :
              "bg-emerald-50 text-emerald-600"
            }`}>
              {session.autonomy_level === "conservative" ? <Shield className="w-3 h-3" /> :
               session.autonomy_level === "aggressive" ? <Zap className="w-3 h-3" /> :
               <Scale className="w-3 h-3" />}
              {session.autonomy_level}
            </span>
          )}
          <span className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${
            session.status === "completed" ? "bg-emerald-50 text-emerald-600" :
            session.status === "awaiting_review" ? "bg-amber-50 text-amber-600" :
            session.status === "processing" ? "bg-indigo-50 text-indigo-600" :
            session.status === "error" ? "bg-red-50 text-red-600" :
            session.status === "cancelled" ? "bg-red-50 text-red-500" :
            session.status === "ready_to_push" ? "bg-blue-50 text-blue-600" :
            "bg-slate-100 text-slate-500"
          }`}>
            {session.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Step indicator */}
      <div className="bg-white rounded-2xl border border-slate-200 px-8 py-5 shadow-sm">
        <StepIndicator currentPhase={session.current_phase} status={session.status} />
      </div>

      {/* Tab nav */}
      <nav className="flex gap-1 bg-slate-100 rounded-xl p-1" role="tablist">
        {TABS.map((tab) => {
          const isActive = pathname?.endsWith(tab.path) ?? false;
          return (
            <Link
              key={tab.path}
              href={`/session/${id}/${tab.path}`}
              role="tab"
              aria-selected={isActive}
              className={`flex-1 text-center py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
