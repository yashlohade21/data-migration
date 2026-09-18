"use client";
import { useState, useEffect, use } from "react";
import { api } from "@/lib/api";
import { DeltaReport as DeltaReportType, MigrationRecord } from "@/lib/types";
import DeltaReport from "@/components/DeltaReport";
import DataPreviewTable from "@/components/DataPreviewTable";
import {
  Send, RotateCcw, CheckCircle2, XCircle,
  TrendingUp, Table, Loader2, Rocket, ShieldAlert,
} from "lucide-react";

export default function PushPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [pushing, setPushing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [pushResult, setPushResult] = useState<{ total: number; success: number; failed: number } | null>(null);
  const [records, setRecords] = useState<MigrationRecord[]>([]);
  const [delta, setDelta] = useState<DeltaReportType | null>(null);
  const [counts, setCounts] = useState<{ total: number; active: number; duplicates: number } | null>(null);
  const [tab, setTab] = useState<"push" | "data" | "delta">("push");
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadData = async () => {
    try {
      const [recs, cnt, d] = await Promise.all([api.getRecords(id, 200), api.getRecordCount(id), api.getDelta(id)]);
      setRecords(recs);
      setCounts(cnt);
      setDelta(d);
      const pushed = recs.filter((r) => r.push_status === "success").length;
      const failed = recs.filter((r) => r.push_status === "failed").length;
      if (pushed > 0 || failed > 0) setPushResult({ total: pushed + failed, success: pushed, failed });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    }
  };

  useEffect(() => { loadData(); }, [id]);

  const handlePush = async () => {
    setShowConfirm(false);
    setPushing(true);
    setError(null);
    try {
      const result = await api.pushRecords(id);
      setPushResult(result);
      loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setPushing(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    setError(null);
    try {
      await api.retryFailed(id);
      loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setRetrying(false);
    }
  };

  const successPct = pushResult && pushResult.total > 0 ? (pushResult.success / pushResult.total) * 100 : 0;
  const failedPct = pushResult && pushResult.total > 0 ? (pushResult.failed / pushResult.total) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {[
          { key: "push", label: "Push", icon: Send },
          { key: "data", label: `Records (${records.length})`, icon: Table },
          { key: "delta", label: "Delta Report", icon: TrendingUp },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as "push" | "data" | "delta")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {tab === "push" && (
        <div className="space-y-6">
          {/* Stats */}
          {counts && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center shadow-sm">
                <p className="text-3xl font-bold text-slate-900 tabular-nums">{counts.total}</p>
                <p className="text-xs text-slate-500 mt-1">Total Records</p>
              </div>
              <div className="bg-white rounded-2xl border border-emerald-100 p-5 text-center shadow-sm">
                <p className="text-3xl font-bold text-emerald-600 tabular-nums">{counts.active}</p>
                <p className="text-xs text-slate-500 mt-1">Ready to Push</p>
              </div>
              <div className="bg-white rounded-2xl border border-purple-100 p-5 text-center shadow-sm">
                <p className="text-3xl font-bold text-purple-600 tabular-nums">{counts.duplicates}</p>
                <p className="text-xs text-slate-500 mt-1">Duplicates Removed</p>
              </div>
            </div>
          )}

          {/* Push results */}
          {pushResult && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
              <h3 className="font-semibold text-slate-900">Push Results</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">{pushResult.total}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600 tabular-nums flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5" /> {pushResult.success}
                  </p>
                  <p className="text-xs text-emerald-600">Succeeded</p>
                </div>
                <div className="bg-red-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-red-600 tabular-nums flex items-center justify-center gap-1.5">
                    <XCircle className="w-5 h-5" /> {pushResult.failed}
                  </p>
                  <p className="text-xs text-red-600">Failed</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 transition-all duration-700 rounded-l-full" style={{ width: `${successPct}%` }} />
                <div className="bg-red-400 transition-all duration-700 rounded-r-full" style={{ width: `${failedPct}%` }} />
              </div>

              {pushResult.failed > 0 && (
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className="flex items-center gap-2 h-10 px-5 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 disabled:opacity-40 transition-colors shadow-sm"
                >
                  <RotateCcw className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`} />
                  {retrying ? "Retrying..." : `Retry ${pushResult.failed} Failed`}
                </button>
              )}
            </div>
          )}

          {/* Push button with confirmation */}
          {!pushResult && (
            <>
              {showConfirm ? (
                <div className="bg-white rounded-2xl border-2 border-indigo-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-slate-900">Confirm Push</h3>
                      <p className="text-sm text-slate-500 mt-1">
                        You are about to push <strong>{counts?.active || 0} records</strong> to the target system. This action will create employee records in the destination.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 ml-9">
                    <button
                      onClick={handlePush}
                      disabled={pushing}
                      className="h-10 px-6 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-2 transition-colors shadow-sm"
                    >
                      {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                      Yes, Push Records
                    </button>
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="h-10 px-6 bg-white text-slate-600 border border-slate-200 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={pushing || !counts?.active}
                  className="w-full h-14 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl font-semibold hover:from-indigo-700 hover:to-blue-700 disabled:opacity-40 flex items-center justify-center gap-3 transition-all shadow-lg shadow-indigo-200/50"
                >
                  <Rocket className="w-5 h-5" /> Push to Target System
                </button>
              )}
            </>
          )}
        </div>
      )}

      {tab === "data" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <DataPreviewTable records={records} />
        </div>
      )}

      {tab === "delta" && delta && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <DeltaReport report={delta} />
        </div>
      )}
    </div>
  );
}
