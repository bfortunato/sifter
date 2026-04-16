import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";
import type { SiftRecord } from "@/api/types";

interface RecordsTableProps {
  records: SiftRecord[];
  isLoading?: boolean;
}

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.85
      ? "bg-emerald-500"
      : value >= 0.6
      ? "bg-amber-400"
      : "bg-red-400";
  const textColor =
    value >= 0.85
      ? "text-emerald-700"
      : value >= 0.6
      ? "text-amber-700"
      : "text-red-600";
  return (
    <div className="flex items-center gap-1.5 min-w-[52px]">
      <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`font-mono text-[11px] tabular-nums ${textColor}`}>
        {pct}%
      </span>
    </div>
  );
}

function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/40 select-none">—</span>;
  }
  if (typeof value === "boolean") {
    return (
      <span className={value ? "text-emerald-600" : "text-slate-400"}>
        {value ? "true" : "false"}
      </span>
    );
  }
  if (typeof value === "number") {
    return (
      <span className="tabular-nums text-right block">
        {value.toLocaleString()}
      </span>
    );
  }
  if (typeof value === "object") {
    return (
      <span className="text-muted-foreground italic text-[11px]">
        {JSON.stringify(value)}
      </span>
    );
  }
  const str = String(value);
  return <span title={str}>{str}</span>;
}

export function RecordsTable({ records, isLoading }: RecordsTableProps) {
  const columns = useMemo(() => {
    if (!records.length) return [];
    const keys = new Set<string>();
    records.forEach((r) => Object.keys(r.extracted_data).forEach((k) => keys.add(k)));
    return Array.from(keys);
  }, [records]);

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </div>
    );
  }

  if (!records.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <FileText className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium text-foreground">No records yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Upload and process documents to see extracted data here
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/70 shadow-[0_1px_4px_0_hsl(var(--foreground)/0.04)]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/60">
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide text-[10px] whitespace-nowrap">
              Document
            </th>
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">
              Type
            </th>
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">
              Conf
            </th>
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide text-[10px] whitespace-nowrap"
              >
                {col.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record, i) => (
            <tr
              key={record.id}
              className={`border-b last:border-0 transition-colors hover:bg-primary/[0.03] ${
                i % 2 === 1 ? "bg-muted/20" : ""
              }`}
            >
              <td className="px-3 py-2 max-w-[160px]">
                <span
                  className="font-mono text-[11px] text-foreground/75 truncate block"
                  title={record.filename || record.document_id}
                >
                  {record.filename || record.document_id}
                </span>
              </td>
              <td className="px-3 py-2 text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                {record.document_type || "—"}
              </td>
              <td className="px-3 py-2">
                <ConfidencePill value={record.confidence} />
              </td>
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 font-mono text-[11px] text-foreground/80 max-w-[200px] truncate">
                  <CellValue value={record.extracted_data[col]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 border-t bg-muted/30 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground font-mono">
          {records.length} record{records.length !== 1 ? "s" : ""} · {columns.length} field{columns.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
