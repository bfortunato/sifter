import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { fetchDocument, reprocessDocument } from "../api/folders";
import { fetchExtractions } from "../api/extractions";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { DocumentExtractionStatus } from "../api/types";

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

export default function DocumentDetailPage() {
  const { id: documentId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: doc, isLoading } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => fetchDocument(documentId!),
    enabled: !!documentId,
    refetchInterval: (data) => {
      const hasProcessing = data?.extraction_statuses?.some(
        (s: DocumentExtractionStatus) => s.status === "processing" || s.status === "pending"
      );
      return hasProcessing ? 2000 : false;
    },
  });

  const { data: extractions = [] } = useQuery({
    queryKey: ["extractions"],
    queryFn: fetchExtractions,
  });

  const reprocessMutation = useMutation({
    mutationFn: (extractionId?: string) => reprocessDocument(documentId!, extractionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["document", documentId] }),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 max-w-4xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <p className="text-destructive">Document not found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-8">
      {/* Document metadata */}
      <div>
        <h1 className="text-2xl font-bold">{doc.filename}</h1>
        <div className="mt-2 text-sm text-muted-foreground space-y-1">
          <p>Type: {doc.content_type}</p>
          <p>Size: {formatBytes(doc.size_bytes)}</p>
          <p>Uploaded: {new Date(doc.uploaded_at).toLocaleString()}</p>
        </div>
      </div>

      {/* Per-extractor results */}
      <div className="space-y-4">
        <h2 className="font-semibold">Extraction Results</h2>
        {doc.extraction_statuses?.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No extractors linked to this document's folder.
          </p>
        ) : (
          doc.extraction_statuses?.map((s: DocumentExtractionStatus) => {
            const ext = extractions.find((e) => e.id === s.extraction_id);
            return (
              <div key={s.extraction_id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {ext?.name ?? s.extraction_id}
                    </span>
                    <Badge variant={statusVariant(s.status) as any} className="capitalize text-xs">
                      {s.status === "processing" && (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      )}
                      {s.status}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => reprocessMutation.mutate(s.extraction_id)}
                    disabled={reprocessMutation.isPending}
                    className="flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Reprocess
                  </Button>
                </div>

                {s.status === "error" && s.error_message && (
                  <p className="text-sm text-destructive">{s.error_message}</p>
                )}

                {s.completed_at && (
                  <p className="text-xs text-muted-foreground">
                    Completed: {new Date(s.completed_at).toLocaleString()}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
