"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useSSE } from "@/hooks/useSSE";
import { Escalation, MigrationRecord, ColumnMapping } from "@/lib/types";
import EscalationCard from "@/components/EscalationCard";
import MappingTable from "@/components/MappingTable";
import DataPreviewTable from "@/components/DataPreviewTable";
import AgentLog from "@/components/AgentLog";
import { AlertTriangle, Play, Table, CheckCircle2, Loader2, Inbox, XCircle, ListChecks } from "lucide-react";

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [records, setRecords] = useState<MigrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<string>("");
  const [allMappings, setAllMappings] = useState<ColumnMapping[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"escalations" | "data" | "decisions">("escalations");
  const sse = useSSE(id);

  const loadData = async () => {
    try {
      const [esc, recs, session, maps, audit] = await Promise.all([
        api.getEscalations(id), api.getRecords(id, 100), api.getSession(id), api.getMappings(id), api.getAudit(id),
      ]);
      setEscalations(esc);
      setRecords(recs);
      setSessionStatus(session.status);
      setAllMappings(maps);
      // Load audit log as initial agent log events if no SSE events yet
      if (sse.events.length === 0 && audit.length > 0) {
        const auditEvents = audit.map((a: { action: string; phase: string; details: Record<string, unknown> }) => ({
          event: "log" as const,
          data: { message: `[${a.phase || "agent"}] ${a.action.replace(/_/g, " ")}${a.details && Object.keys(a.details).length > 0 ? " — " + Object.entries(a.details).map(([k, v]) => `${k}: ${v}`).join(", ") : ""}` },
        }));
        sse.setInitialEvents(auditEvents);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const cancelAgent = async () => {
    setCancelling(true);
    try {
      await api.cancelAgent(id);
      setSessionStatus("cancelled");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  useEffect(() => {
    const last = sse.events[sse.events.length - 1];
    if (last?.event === "awaiting_review") loadData();
    if (last?.event === "complete" || last?.event === "status" && last?.data?.message?.includes("ready")) {
      loadData();
      setTimeout(() => router.push(`/session/${id}/push`), 800);
    }
  }, [sse.events, id, router]);

  const pending = escalations.filter((e) => e.status === "pending");
  const resolved = escalations.filter((e) => e.status !== "pending");

  const resumeAgent = async () => {
    setResuming(true);
    setError(null);
    sse.connect();
    try {
      await api.resumeAgent(id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setResuming(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setTab("escalations")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "escalations" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Escalations
            {pending.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">{pending.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab("data")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "data" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            Data ({records.length})
          </button>
          <button
            onClick={() => setTab("decisions")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "decisions" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            All Decisions
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {tab === "escalations" && (
          <div className="space-y-3">
            {pending.length === 0 && resolved.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No escalations yet</p>
                <p className="text-xs text-gray-400 mt-1">Start the agent from the Upload tab</p>
              </div>
            )}

            {pending.length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Needs Review</h3>
                  <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">{pending.length}</span>
                </div>
                {pending.map((esc) => (
                  <EscalationCard key={esc.id} escalation={esc} sessionId={id} onResolved={loadData} />
                ))}
              </>
            )}

            {/* Stop button */}
            {sessionStatus === "processing" && (
              <button
                onClick={cancelAgent}
                disabled={cancelling}
                className="w-full h-10 bg-red-50 border border-red-200 text-red-700 rounded-xl font-semibold text-sm hover:bg-red-100 disabled:opacity-40 flex items-center justify-center gap-2 transition-all"
              >
                {cancelling ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Stopping...</>
                ) : (
                  <><XCircle className="w-4 h-4" /> Stop Agent</>
                )}
              </button>
            )}

            {/* Resume button */}
            {pending.length === 0 && (sessionStatus === "awaiting_review" || resolved.length > 0) && (
              <button
                onClick={resumeAgent}
                disabled={resuming}
                className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-semibold text-sm hover:from-emerald-700 hover:to-green-700 disabled:opacity-40 flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-200/50"
              >
                {resuming ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Resuming...</>
                ) : (
                  <><Play className="w-4 h-4" /> Resume Agent</>
                )}
              </button>
            )}

            {resolved.length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-4">Resolved</h3>
                {resolved.map((esc) => (
                  <EscalationCard key={esc.id} escalation={esc} sessionId={id} onResolved={loadData} />
                ))}
              </>
            )}
          </div>
        )}

        {tab === "data" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <DataPreviewTable records={records} />
          </div>
        )}

        {tab === "decisions" && (
          <div className="space-y-4">
            {/* Mappings */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm">Column Mappings</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">{allMappings.length} mapping decisions</p>
              </div>
              <MappingTable mappings={allMappings} sessionId={id} readOnly />
            </div>

            {/* Escalation Summary */}
            {escalations.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900 text-sm">Escalation Summary</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">{escalations.length} total escalations</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {escalations.map((esc) => (
                    <div key={esc.id} className="px-6 py-3 flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        esc.status === "pending" ? "bg-amber-400" : "bg-emerald-400"
                      }`} />
                      <span className="text-xs text-gray-600 flex-1 truncate">{esc.description}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        esc.status === "pending"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-50 text-emerald-600"
                      }`}>
                        {esc.status}
                      </span>
                      <span className="text-[10px] text-gray-400">{esc.phase}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Agent log */}
      <div className="lg:col-span-2">
        <div className="sticky top-20">
          <AgentLog events={sse.events} connected={sse.connected} reconnecting={sse.reconnecting} />
        </div>
      </div>
    </div>
  );
}
