import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { deleteDocument, fetchDocument, reprocessDocument } from "../api/folders";
import { fetchSifts } from "../api/extractions";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { DocumentSiftStatus } from "../api/types";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function statusVariant(status: string) {
  switch (status) {
    case "done": return "default";
    case "processing": return "secondary";
    case "error": return "destructive";
    default: return "outline";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "done": return "Extracted";
    case "processing": return "Processing";
    case "pending": return "Pending";
    case "error": return "Error";
    default: return status;
  }
}

export default function DocumentDetailPage() {
  const { id: documentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: doc, isLoading, error } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => fetchDocument(documentId!),
    enabled: !!documentId,
    refetchInterval: (query: any) => {
      const doc = query.state.data;
      const hasProcessing = doc?.sift_statuses?.some(
        (s: DocumentSiftStatus) => s.status === "processing" || s.status === "pending"
      );
      return hasProcessing ? 2000 : false;
    },
  });

  const { data: sifts = [] } = useQuery({
    queryKey: ["sifts"],
    queryFn: fetchSifts,
  });

  const reprocessMutation = useMutation({
    mutationFn: (siftId?: string) => reprocessDocument(documentId!, siftId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["document", documentId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(documentId!),
    onSuccess: () => navigate(-1),
  });

  const handleDelete = () => {
    if (!confirm(`Delete "${doc?.filename}"? This cannot be undone.`)) return;
    deleteMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="px-6 py-8 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="px-6 py-8 max-w-4xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Alert variant="destructive">
          <AlertDescription>
            {error ? (error as Error).message : "Document not found."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      {/* Back + header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="flex items-center gap-1 mb-3 -ml-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold break-all">{doc.filename}</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="shrink-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">File Info</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Type</dt>
            <dd className="font-mono">{doc.content_type}</dd>
            <dt className="text-muted-foreground">Size</dt>
            <dd>{formatBytes(doc.size_bytes)}</dd>
            <dt className="text-muted-foreground">Uploaded</dt>
            <dd>{new Date(doc.uploaded_at).toLocaleString()}</dd>
          </dl>
        </CardContent>
      </Card>

      {/* Per-sift results */}
      <div className="space-y-3">
        <h2 className="font-semibold">Sift Results</h2>

        {!doc.sift_statuses?.length ? (
          <p className="text-sm text-muted-foreground">
            This document isn't linked to any sifts. Link a sift to its folder to start extracting data.
          </p>
        ) : (
          doc.sift_statuses.map((s: DocumentSiftStatus) => {
            const sift = sifts.find((e) => e.id === s.sift_id);
            return (
              <Card key={s.sift_id}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {sift?.name ?? s.sift_id}
                      </span>
                      <Badge
                        variant={statusVariant(s.status) as any}
                        className="capitalize text-xs"
                      >
                        {s.status === "processing" && (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        )}
                        {statusLabel(s.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.status === "done" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/sifts/${s.sift_id}`)}
                          className="flex items-center gap-1 text-xs h-7"
                        >
                          View records
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => reprocessMutation.mutate(s.sift_id)}
                        disabled={reprocessMutation.isPending || s.status === "processing" || s.status === "pending"}
                        className="flex items-center gap-1 h-7 text-xs"
                        title="Reprocess this document"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Reprocess
                      </Button>
                    </div>
                  </div>

                  {s.status === "error" && s.error_message && (
                    <Alert variant="destructive" className="py-2">
                      <AlertDescription className="text-xs">{s.error_message}</AlertDescription>
                    </Alert>
                  )}

                  {s.completed_at && s.status === "done" && (
                    <p className="text-xs text-muted-foreground">
                      Extracted {new Date(s.completed_at).toLocaleString()}
                    </p>
                  )}

                  {(s.status === "processing" || s.status === "pending") && (
                    <p className="text-xs text-muted-foreground animate-pulse">
                      {s.status === "pending" ? "Queued for extraction…" : "Extracting data…"}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {reprocessMutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {(reprocessMutation.error as Error).message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
