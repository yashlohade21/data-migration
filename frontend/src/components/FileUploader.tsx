"use client";
import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, X, Loader2 } from "lucide-react";

interface Props {
  onUpload: (files: File[]) => Promise<void>;
  disabled?: boolean;
}

export default function FileUploader({ onUpload, disabled }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith(".csv") || f.name.endsWith(".xlsx") || f.name.endsWith(".xls")
    );
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      await onUpload(files);
      setFiles([]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200
          ${dragging ? "border-indigo-400 bg-indigo-50/50 scale-[1.01]" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"}
          ${disabled ? "opacity-40 pointer-events-none" : ""}
        `}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Upload className="w-5 h-5 text-slate-500" />
        </div>
        <p className="text-sm text-slate-600">
          Drop files here, or <span className="text-indigo-600 font-medium">browse</span>
        </p>
        <p className="text-xs text-slate-400 mt-1.5">.csv, .xlsx, .xls files</p>
        <input
          id="file-input"
          type="file"
          multiple
          accept=".csv,.xlsx,.xls"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2 animate-fade-in">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{f.name}</p>
                <p className="text-[11px] text-slate-400">{(f.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={() => removeFile(i)} className="p-1 rounded-md hover:bg-slate-200/60 transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          ))}
          <button
            onClick={handleUpload}
            disabled={uploading || disabled}
            className="w-full h-11 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
            ) : (
              <><Upload className="w-4 h-4" /> Upload {files.length} file{files.length > 1 ? "s" : ""}</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
