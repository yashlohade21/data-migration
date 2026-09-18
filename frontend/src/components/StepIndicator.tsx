"use client";
import { PHASES, Phase } from "@/lib/types";
import { Check, Loader2, X } from "lucide-react";

const PHASE_LABELS: Record<string, string> = {
  ingest: "Ingest",
  map: "Map",
  clean: "Clean",
  dedup: "Dedup",
  validate: "Validate",
  push: "Push",
};

interface Props {
  currentPhase: string;
  status: string;
}

export default function StepIndicator({ currentPhase, status }: Props) {
  const currentIdx = PHASES.indexOf(currentPhase as Phase);
  const isCancelled = status === "cancelled";
  const isError = status === "error";

  return (
    <div className="flex items-center w-full">
      {PHASES.map((phase, idx) => {
        const isCompleted = (idx < currentIdx || status === "completed") && !isCancelled && !isError;
        const isCurrent = phase === currentPhase;
        const isAwaiting = isCurrent && status === "awaiting_review";
        const isProcessing = isCurrent && status === "processing";
        const isStoppedHere = isCurrent && (isCancelled || isError);

        return (
          <div key={phase} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`
                w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 border-2
                ${isCompleted ? "bg-emerald-500 border-emerald-500 text-white shadow-sm" : ""}
                ${isCurrent && isProcessing ? "bg-indigo-500 border-indigo-500 text-white shadow-sm shadow-indigo-200" : ""}
                ${isAwaiting ? "bg-amber-400 border-amber-400 text-white shadow-sm shadow-amber-200" : ""}
                ${isStoppedHere ? "bg-red-500 border-red-500 text-white shadow-sm shadow-red-200" : ""}
                ${!isCompleted && !isCurrent ? "bg-white border-slate-200 text-slate-400" : ""}
                ${isCancelled && idx < currentIdx ? "bg-emerald-500 border-emerald-500 text-white shadow-sm" : ""}
              `}>
                {isCompleted || (isCancelled && idx < currentIdx) ? (
                  <Check className="w-4 h-4" strokeWidth={3} />
                ) : isStoppedHere ? (
                  <X className="w-4 h-4" strokeWidth={3} />
                ) : isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <span className={`text-[11px] mt-1.5 font-medium tracking-wide ${
                isStoppedHere ? "text-red-600" :
                isCurrent ? "text-slate-900" :
                isCompleted || (isCancelled && idx < currentIdx) ? "text-emerald-600" :
                "text-slate-400"
              }`}>
                {PHASE_LABELS[phase]}
              </span>
            </div>
            {idx < PHASES.length - 1 && (
              <div className={`h-[2px] flex-1 mx-2 mt-[-18px] rounded-full transition-colors duration-300 ${
                (idx < currentIdx && !isCancelled) || status === "completed" ? "bg-emerald-400" :
                isCancelled && idx < currentIdx ? "bg-emerald-400" :
                "bg-slate-200"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
