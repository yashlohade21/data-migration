"use client";
import { useSession } from "@/hooks/useSession";
import StepIndicator from "@/components/StepIndicator";
import { use } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Shield, Scale, Zap, Upload, GitMerge, AlertCircle, Send, ClipboardList } from "lucide-react";

const TABS = [
  { label: "Upload", path: "upload", icon: Upload },
  { label: "Mapping", path: "mapping", icon: GitMerge },
  { label: "Review", path: "review", icon: AlertCircle },
  { label: "Push", path: "push", icon: Send },
  { label: "Audit", path: "audit", icon: ClipboardList },
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
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="text-sm text-slate-400">Loading session...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-32">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7 text-slate-300" />
        </div>
        <p className="text-slate-500 font-medium">Session not found</p>
        <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline mt-2 inline-block font-medium">
          Back to sessions
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0 shadow-sm" aria-label="Back to sessions">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{session.name}</h1>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">ID: {session.id.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.autonomy_level && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-semibold border ${
              session.autonomy_level === "conservative" ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
              session.autonomy_level === "aggressive" ? "bg-amber-50 text-amber-600 border-amber-100" :
              "bg-emerald-50 text-emerald-600 border-emerald-100"
            }`}>
              {session.autonomy_level === "conservative" ? <Shield className="w-3 h-3" /> :
               session.autonomy_level === "aggressive" ? <Zap className="w-3 h-3" /> :
               <Scale className="w-3 h-3" />}
              {session.autonomy_level}
            </span>
          )}
          <span className={`text-xs px-3 py-1.5 rounded-lg font-semibold border ${
            session.status === "completed" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
            session.status === "awaiting_review" ? "bg-amber-50 text-amber-600 border-amber-100" :
            session.status === "processing" ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
            session.status === "error" ? "bg-red-50 text-red-600 border-red-100" :
            session.status === "cancelled" ? "bg-red-50 text-red-500 border-red-100" :
            session.status === "ready_to_push" ? "bg-blue-50 text-blue-600 border-blue-100" :
            "bg-slate-50 text-slate-500 border-slate-200"
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
      <nav className="flex gap-1 bg-white rounded-xl p-1.5 border border-slate-200 shadow-sm" role="tablist">
        {TABS.map((tab) => {
          const isActive = pathname?.endsWith(tab.path) ?? false;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.path}
              href={`/session/${id}/${tab.path}`}
              role="tab"
              aria-selected={isActive}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-200/50"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
