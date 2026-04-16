import { useNavigate } from "react-router-dom";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { SiftForm } from "@/components/SiftForm";
import { useSifts } from "@/hooks/useExtractions";

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SiftsPage() {
  const navigate = useNavigate();
  const { data: sifts, isLoading, error } = useSifts();

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sifts</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            AI-powered extraction pipelines for your documents
          </p>
        </div>
        <SiftForm
          trigger={
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New Sift
            </Button>
          }
          onCreated={(id) => navigate(`/sifts/${id}`)}
        />
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" style={{ opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load sifts: {(error as Error).message}
        </div>
      )}

      {sifts && sifts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 border border-primary/10">
            <FileText className="h-6 w-6 text-primary/60" />
          </div>
          <p className="text-sm font-medium">No sifts yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Create your first sift to define what to extract from your documents
          </p>
          <SiftForm
            trigger={
              <Button size="sm" className="mt-5 gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                New Sift
              </Button>
            }
            onCreated={(id) => navigate(`/sifts/${id}`)}
          />
        </div>
      )}

      {sifts && sifts.length > 0 && (
        <div className="rounded-lg border border-border/70 overflow-hidden shadow-[0_1px_4px_0_hsl(var(--foreground)/0.04)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/60">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Name
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Documents
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {sifts.map((ext, i) => {
                const progress =
                  ext.total_documents > 0
                    ? (ext.processed_documents / ext.total_documents) * 100
                    : 0;
                const isIndexing = ext.status === "indexing";
                return (
                  <tr
                    key={ext.id}
                    className={`border-b last:border-0 cursor-pointer transition-colors hover:bg-primary/[0.03] ${
                      i % 2 === 1 ? "bg-muted/20" : ""
                    }`}
                    onClick={() => navigate(`/sifts/${ext.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm leading-none">{ext.name}</div>
                      {ext.description && (
                        <div className="text-muted-foreground text-xs mt-1 leading-none">
                          {ext.description}
                        </div>
                      )}
                      {isIndexing && ext.total_documents > 0 && (
                        <div className="mt-2 w-40 h-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-400 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ext.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs tabular-nums">
                      {isIndexing && ext.total_documents > 0 ? (
                        <span className="text-amber-600">
                          {ext.processed_documents}
                          <span className="text-muted-foreground/60">/{ext.total_documents}</span>
                        </span>
                      ) : (
                        <span>
                          {ext.processed_documents}
                          {ext.total_documents > 0 && (
                            <span className="text-muted-foreground/60">/{ext.total_documents}</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatDate(ext.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
