import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { SiftRecord } from "@/api/types";

interface RecordsTableProps {
  records: SiftRecord[];
  isLoading?: boolean;
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
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!records.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No records yet. Upload documents to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Document</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Conf.</th>
            {columns.map((col) => (
              <th key={col} className="px-4 py-3 text-left font-medium text-muted-foreground">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 text-xs truncate max-w-[180px]" title={record.document_id}>
                {record.filename || record.document_id}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{record.document_type}</td>
              <td className="px-4 py-3">
                <span
                  className={
                    record.confidence >= 0.8
                      ? "text-green-600"
                      : record.confidence >= 0.5
                      ? "text-yellow-600"
                      : "text-red-500"
                  }
                >
                  {(record.confidence * 100).toFixed(0)}%
                </span>
              </td>
              {columns.map((col) => (
                <td key={col} className="px-4 py-3">
                  {formatValue(record.extracted_data[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
