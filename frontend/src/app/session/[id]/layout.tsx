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
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm text-gray-400 font-medium">Loading session...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-32">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4 border border-gray-200">
          <AlertCircle className="w-7 h-7 text-gray-300" />
        </div>
        <p className="text-gray-600 font-semibold">Session not found</p>
        <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline mt-2 inline-block font-medium">
          Back to sessions
        </Link>
      </div>
    );
  }

  const statusStyles: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    awaiting_review: "bg-amber-50 text-amber-700 border-amber-200",
    processing: "bg-indigo-50 text-indigo-700 border-indigo-200",
    error: "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-red-50 text-red-600 border-red-200",
    ready_to_push: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 hover:border-gray-300 transition-all shrink-0 shadow-sm" aria-label="Back">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">{session.name}</h1>
            <p className="text-[11px] text-gray-400 font-mono mt-0.5">ID: {session.id.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.autonomy_level && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-bold border ${
              session.autonomy_level === "conservative" ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
              session.autonomy_level === "aggressive" ? "bg-amber-50 text-amber-700 border-amber-200" :
              "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}>
              {session.autonomy_level === "conservative" ? <Shield className="w-3 h-3" /> :
               session.autonomy_level === "aggressive" ? <Zap className="w-3 h-3" /> :
               <Scale className="w-3 h-3" />}
              {session.autonomy_level}
            </span>
          )}
          <span className={`text-[11px] px-3 py-1.5 rounded-lg font-bold border ${
            statusStyles[session.status] || "bg-gray-50 text-gray-600 border-gray-200"
          }`}>
            {session.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Step indicator */}
      <div className="card px-8 py-5">
        <StepIndicator currentPhase={session.current_phase} status={session.status} />
      </div>

      {/* Tab nav */}
      <nav className="flex gap-1 bg-gray-100 rounded-xl p-1 border border-gray-200" role="tablist">
        {TABS.map((tab) => {
          const isActive = pathname?.endsWith(tab.path) ?? false;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.path}
              href={`/session/${id}/${tab.path}`}
              role="tab"
              aria-selected={isActive}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-semibold transition-all duration-150 ${
                isActive
                  ? "bg-white text-indigo-700 shadow-sm border border-gray-200/60"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? "text-indigo-600" : ""}`} />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
