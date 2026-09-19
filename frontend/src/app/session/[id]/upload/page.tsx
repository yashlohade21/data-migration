"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useSSE } from "@/hooks/useSSE";
import { UploadedFile } from "@/lib/types";
import FileUploader from "@/components/FileUploader";
import AgentLog from "@/components/AgentLog";
import { FileSpreadsheet, Play, Loader2, Hash, Columns, Shield, Zap, Scale, XCircle } from "lucide-react";

export default function UploadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [agentRunning, setAgentRunning] = useState(false);
  const [autonomyLevel, setAutonomyLevel] = useState<string>("balanced");
  const [error, setError] = useState<string | null>(null);
  const sse = useSSE(id);

  const loadFiles = () => api.listFiles(id).then(setFiles).catch(() => {});
  useEffect(() => { loadFiles(); }, [id]);

  const handleUpload = async (newFiles: File[]) => {
    setError(null);
    try {
      await api.uploadFiles(id, newFiles);
      loadFiles();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const startAgent = async () => {
    setStarting(true);
    setError(null);
    sse.connect();
    try {
      await api.startAgent(id, autonomyLevel);
      setAgentRunning(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setStarting(false);
    }
  };

  const cancelAgent = async () => {
    setCancelling(true);
    try {
      await api.cancelAgent(id);
      setAgentRunning(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    const last = sse.events[sse.events.length - 1];
    if (last?.event === "awaiting_review") {
      setTimeout(() => router.push(`/session/${id}/review`), 1200);
    }
    if (last?.event === "complete") {
      setAgentRunning(false);
      setTimeout(() => router.push(`/session/${id}/push`), 1200);
    }
    if (last?.event === "cancelled") {
      setAgentRunning(false);
    }
  }, [sse.events, id, router]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Left: upload + files */}
      <div className="lg:col-span-3 space-y-6">
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="font-bold text-gray-900 text-sm">Upload Files</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">CSV or Excel files with employee data</p>
          </div>
          <div className="p-6">
            <FileUploader onUpload={handleUpload} disabled={starting} />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
            {error}
          </div>
        )}

        {files.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-sm">Uploaded Files</h2>
              <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">{files.length} file{files.length > 1 ? "s" : ""}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {files.map((f) => (
                <div key={f.id} className="px-6 py-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{f.filename}</p>
                      <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                        <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{f.row_count} rows</span>
                        <span className="flex items-center gap-1"><Columns className="w-3 h-3" />{f.columns.length} columns</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {f.columns.map((col) => (
                      <code key={col} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-mono border border-indigo-100">
                        {col}
                      </code>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* Autonomy Level Selector */}
            <div className="px-6 pt-3">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Autonomy Level</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: "conservative", label: "Conservative", desc: "Escalate everything", icon: Shield,
                    active: "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200", iconActive: "text-indigo-700" },
                  { key: "balanced", label: "Balanced", desc: "Auto-accept >=85%", icon: Scale,
                    active: "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200", iconActive: "text-emerald-700" },
                  { key: "aggressive", label: "Aggressive", desc: "Auto-accept >=60%", icon: Zap,
                    active: "border-amber-400 bg-amber-50 ring-2 ring-amber-200", iconActive: "text-amber-700" },
                ] as const).map(({ key, label, desc, icon: Icon, active, iconActive }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAutonomyLevel(key)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                      autonomyLevel === key
                        ? active
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${autonomyLevel === key ? iconActive : "text-gray-400"}`} />
                    <span className={`text-xs font-bold ${autonomyLevel === key ? "text-gray-900" : "text-gray-600"}`}>{label}</span>
                    <span className="text-[10px] text-gray-400 leading-tight">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-6 pb-6 pt-3">
              <button
                onClick={startAgent}
                disabled={starting || files.length === 0}
                className="w-full h-12 btn-primary flex items-center justify-center gap-2 text-sm"
              >
                {starting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Starting Agent...</>
                ) : (
                  <><Play className="w-4 h-4" /> Start Migration Agent</>
                )}
              </button>
              {agentRunning && (
                <button
                  onClick={cancelAgent}
                  disabled={cancelling}
                  className="w-full h-10 mt-2 bg-red-50 border border-red-200 text-red-700 rounded-xl font-semibold text-sm hover:bg-red-100 disabled:opacity-40 flex items-center justify-center gap-2 transition-all"
                >
                  {cancelling ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Stopping...</>
                  ) : (
                    <><XCircle className="w-4 h-4" /> Stop Agent</>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: agent log */}
      <div className="lg:col-span-2">
        <div className="sticky top-20">
          <AgentLog events={sse.events} connected={sse.connected} reconnecting={sse.reconnecting} />
        </div>
      </div>
    </div>
  );
}
