"use client";
import { useState, useEffect } from "react";
import { MigrationRecord, TARGET_FIELDS } from "@/lib/types";
import { Table, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  records: MigrationRecord[];
  showStatus?: boolean;
  pageSize?: number;
}

const STATUS_DOTS: Record<string, string> = {
  raw: "bg-gray-400",
  mapped: "bg-blue-400",
  cleaned: "bg-cyan-500",
  deduplicated: "bg-purple-500",
  validated: "bg-emerald-500",
  pushed: "bg-emerald-500",
  error: "bg-red-500",
};

export default function DataPreviewTable({ records, showStatus = true, pageSize = 25 }: Props) {
  const [page, setPage] = useState(0);

  // Reset page when records change
  useEffect(() => { setPage(0); }, [records.length]);

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <Table className="w-8 h-8 mb-2" />
        <p className="text-sm">No records to display</p>
      </div>
    );
  }

  const totalPages = Math.ceil(records.length / pageSize);
  const start = page * pageSize;
  const end = Math.min(start + pageSize, records.length);
  const pageRecords = records.slice(start, end);

  const getData = (r: MigrationRecord) => r.final_data || r.cleaned_data || r.mapped_data || r.raw_data || {};
  const firstData = getData(records[0]);
  const hasTargetFields = TARGET_FIELDS.some((f) => f in firstData);
  const columns = hasTargetFields
    ? TARGET_FIELDS.filter((f) => records.some((r) => getData(r)[f] !== undefined))
    : Object.keys(firstData);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50">
              {showStatus && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-20">Status</th>}
              {columns.map((col) => (
                <th key={col} className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {col.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageRecords.map((rec) => {
              const data = getData(rec);
              const hasErrors = rec.validation_errors && rec.validation_errors.length > 0;
              return (
                <tr
                  key={rec.id}
                  className={`hover:bg-gray-50/60 transition-colors ${
                    rec.is_duplicate ? "opacity-30" : ""
                  } ${hasErrors ? "bg-red-50/30" : ""}`}
                >
                  {showStatus && (
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[rec.status] || "bg-gray-300"}`} />
                        <span className="text-[11px] text-gray-500">{rec.push_status || rec.status}</span>
                      </div>
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col} className="px-3 py-2 whitespace-nowrap max-w-36 truncate text-gray-700">
                      {data[col] != null
                      ? typeof data[col] === "object" ? JSON.stringify(data[col]) : String(data[col])
                      : <span className="text-gray-300">—</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2.5 border-t border-gray-100">
          <span className="text-[11px] text-gray-400">
            {start + 1}–{end} of {records.length} records
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              First
            </button>
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[11px] font-medium text-gray-600">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
