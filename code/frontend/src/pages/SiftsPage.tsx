import { useNavigate } from "react-router-dom";
import { Plus, FileText, AlertCircle, Loader2, PauseCircle, CheckCircle2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SiftForm } from "@/components/SiftForm";
import { useSifts } from "@/hooks/useExtractions";
import type { Sift } from "@/api/types";

// Parse "client_name (string), date (string), amount (number)" → ["client_name", "date", "amount"]
function parseSchemaFields(schema: string | null): { name: string; type: string }[] {
  if (!schema) return [];
  return schema
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(.+?)\s*\((.+?)\)$/);
      return m ? { name: m[1].trim(), type: m[2].trim() } : { name: s, type: "string" };
    });
}

function typeColor(type: string) {
  switch (type) {
    case "number": return "text-blue-600 bg-blue-50 border-blue-100";
    case "boolean": return "text-violet-600 bg-violet-50 border-violet-100";
    case "array": return "text-orange-600 bg-orange-50 border-orange-100";
    case "object": return "text-pink-600 bg-pink-50 border-pink-100";
    default: return "text-slate-600 bg-slate-50 border-slate-200";
  }
}

function statusBorderColor(status: string) {
  switch (status) {
    case "active": return "border-l-emerald-400";
    case "indexing": return "border-l-amber-400";
    case "error": return "border-l-red-400";
    case "paused": return "border-l-slate-300";
    default: return "border-l-border";
  }
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "active":
      return <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_0] shadow-emerald-400/60 shrink-0" />;
    case "indexing":
      return <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin shrink-0" />;
    case "error":
      return <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
    case "paused":
      return <PauseCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
    default:
      return <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "active": return "Active";
    case "indexing": return "Indexing";
    case "error": return "Error";
    case "paused": return "Paused";
    default: return status;
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function SiftCard({ sift, onClick }: { sift: Sift; onClick: () => void }) {
  const fields = parseSchemaFields(sift.schema);
  const isIndexing = sift.status === "indexing";
  const progress =
    sift.total_documents > 0
      ? Math.round((sift.processed_documents / sift.total_documents) * 100)
      : 0;

  return (
    <div
      onClick={onClick}
      className={`
        group relative bg-card border border-border/70 rounded-xl cursor-pointer
        border-l-4 ${statusBorderColor(sift.status)}
        shadow-[0_1px_3px_0_hsl(var(--foreground)/0.05)]
        hover:shadow-[0_4px_16px_0_hsl(var(--foreground)/0.09)]
        hover:border-border
        transition-all duration-200
        flex flex-col gap-0
        overflow-hidden
      `}
    >
      {/* Indexing shimmer */}
      {isIndexing && (
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-t-xl">
          <div
            className="h-full bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-[shimmer_1.8s_ease-in-out_infinite]"
            style={{ width: "200%" }}
          />
        </div>
      )}

      {/* Main content */}
      <div className="px-5 pt-5 pb-4 flex-1 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-base leading-tight truncate group-hover:text-primary transition-colors">
                {sift.name}
              </h2>
              {sift.multi_record && (
                <span title="Multi-record extraction">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                </span>
              )}
            </div>
            {sift.description && (
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-1">
                {sift.description}
              </p>
            )}
          </div>
          {/* Status pill */}
          <div className="flex items-center gap-1.5 shrink-0 bg-muted/60 rounded-full px-2.5 py-1 border border-border/50">
            <StatusIcon status={sift.status} />
            <span className="text-[11px] font-medium text-foreground/70">
              {statusLabel(sift.status)}
            </span>
          </div>
        </div>

        {/* Instructions preview */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 min-h-[2.5rem]">
          {sift.instructions}
        </p>

        {/* Schema fields */}
        {fields.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {fields.slice(0, 8).map((f) => (
              <span
                key={f.name}
                className={`inline-flex items-center font-mono text-[10px] px-1.5 py-0.5 rounded border ${typeColor(f.type)}`}
              >
                {f.name}
              </span>
            ))}
            {fields.length > 8 && (
              <span className="inline-flex items-center font-mono text-[10px] px-1.5 py-0.5 rounded border text-muted-foreground bg-muted border-border/50">
                +{fields.length - 8} more
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center font-mono text-[10px] px-1.5 py-0.5 rounded border text-muted-foreground/50 bg-muted/40 border-dashed border-border/40">
              schema inferred after first document
            </span>
          </div>
        )}

        {/* Error */}
        {sift.status === "error" && sift.error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 leading-relaxed">
            {sift.error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border/50 bg-muted/20 flex items-center justify-between gap-4">
        {/* Doc/progress stats */}
        <div className="flex items-center gap-3 min-w-0">
          {isIndexing && sift.total_documents > 0 ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="font-mono text-[11px] text-amber-600 tabular-nums whitespace-nowrap">
                {sift.processed_documents}/{sift.total_documents} docs
              </span>
            </div>
          ) : (
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {sift.processed_documents > 0
                ? `${sift.processed_documents} doc${sift.processed_documents !== 1 ? "s" : ""}`
                : "No documents yet"}
              {sift.total_documents > sift.processed_documents && ` / ${sift.total_documents}`}
            </span>
          )}
          {fields.length > 0 && (
            <>
              <span className="text-muted-foreground/30 text-xs">·</span>
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {fields.length} field{fields.length !== 1 ? "s" : ""}
              </span>
            </>
          )}
        </div>
        {/* Date */}
        <span className="text-[11px] text-muted-foreground/60 shrink-0">
          {formatDate(sift.created_at)}
        </span>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card border border-border/70 rounded-xl border-l-4 border-l-border/30 overflow-hidden">
      <div className="px-5 pt-5 pb-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
        <div className="flex gap-1.5">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-5 w-16 rounded" />
          ))}
        </div>
      </div>
      <div className="px-5 py-3 border-t border-border/50 bg-muted/20">
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

export function SiftsPage() {
  const navigate = useNavigate();
  const { data: sifts, isLoading, error } = useSifts();

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sifts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI extraction pipelines — define once, run on every document
          </p>
        </div>
        <SiftForm
          trigger={
            <Button size="sm" className="gap-1.5 shrink-0">
              <Plus className="h-3.5 w-3.5" />
              New Sift
            </Button>
          }
          onCreated={(id) => navigate(`/sifts/${id}`)}
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load sifts: {(error as Error).message}
        </div>
      )}

      {/* Empty state */}
      {sifts && sifts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center">
              <FileText className="h-7 w-7 text-primary/50" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-100 border-2 border-background flex items-center justify-center">
              <Plus className="h-2.5 w-2.5 text-emerald-600" />
            </div>
          </div>
          <p className="text-base font-semibold">No sifts yet</p>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-sm leading-relaxed">
            A sift is an extraction pipeline. Define what fields to extract from your documents and Sifter will process them automatically.
          </p>
          <SiftForm
            trigger={
              <Button size="sm" className="mt-6 gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Create your first sift
              </Button>
            }
            onCreated={(id) => navigate(`/sifts/${id}`)}
          />
        </div>
      )}

      {/* Sift grid */}
      {sifts && sifts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sifts.map((sift) => (
            <SiftCard
              key={sift.id}
              sift={sift}
              onClick={() => navigate(`/sifts/${sift.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
