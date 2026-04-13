import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { RecordsTable } from "@/components/RecordsTable";
import { QueryPanel } from "@/components/QueryPanel";
import { ChatInterface } from "@/components/ChatInterface";
import {
  useAggregations,
  useCreateAggregation,
  useDeleteAggregation,
  useDeleteExtraction,
  useExportCsv,
  useExtraction,
  useExtractionRecords,
  useReindexExtraction,
  useRegenerateAggregation,
  useRunAggregation,
  useUploadDocuments,
} from "@/hooks/useExtractions";
import type { Aggregation, AggregationResult } from "@/api/types";

function AggregationStatusIcon({ status }: { status: string }) {
  if (status === "generating") return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (status === "ready" || status === "active") return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (status === "error") return <XCircle className="h-4 w-4 text-destructive" />;
  return null;
}

function AggregationResultTable({ result }: { result: AggregationResult }) {
  const { results } = result;
  if (!results.length) return <p className="text-sm text-muted-foreground mt-2">No results.</p>;
  const cols = Object.keys(results[0]);
  return (
    <div className="overflow-x-auto rounded-md border mt-3 text-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 text-left font-medium text-muted-foreground">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.slice(0, 50).map((row, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
              {cols.map((c) => (
                <td key={c} className="px-3 py-2">
                  {row[c] === null || row[c] === undefined ? "—" : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AggregationCard({
  agg,
  extractionId,
}: {
  agg: Aggregation;
  extractionId: string;
}) {
  const [result, setResult] = useState<AggregationResult | null>(null);
  const runMutation = useRunAggregation(extractionId);
  const regenerateMutation = useRegenerateAggregation(extractionId);
  const deleteMutation = useDeleteAggregation(extractionId);

  const handleRun = () => {
    runMutation.mutate(agg.id, {
      onSuccess: (data) => setResult(data),
    });
  };

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <AggregationStatusIcon status={agg.status} />
          <span className="font-medium text-sm truncate">{agg.name}</span>
          {agg.status === "error" && (
            <Badge variant="destructive" className="text-xs">error</Badge>
          )}
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRun}
            disabled={runMutation.isPending || agg.status === "generating"}
            className="text-xs h-7 px-2"
          >
            {runMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Run"
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => regenerateMutation.mutate(agg.id)}
            disabled={regenerateMutation.isPending || agg.status === "generating"}
            className="h-7 px-2"
            title="Regenerate pipeline"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteMutation.mutate(agg.id)}
            disabled={deleteMutation.isPending}
            className="h-7 px-2 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {agg.description && (
        <p className="text-xs text-muted-foreground">{agg.description}</p>
      )}
      {agg.aggregation_error && agg.status === "error" && (
        <p className="text-xs text-destructive">{agg.aggregation_error}</p>
      )}
      {agg.last_run_at && (
        <p className="text-xs text-muted-foreground">
          Last run: {new Date(agg.last_run_at).toLocaleString()}
        </p>
      )}
      {result && <AggregationResultTable result={result} />}
    </div>
  );
}

function AggregationsPanel({ extractionId }: { extractionId: string }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQuery, setNewQuery] = useState("");

  const { data: aggregations = [] } = useAggregations(extractionId, {
    refetchInterval: (data) => {
      const hasGenerating = (data as Aggregation[] | undefined)?.some((a) => a.status === "generating");
      return hasGenerating ? 2000 : false;
    },
  });

  const createMutation = useCreateAggregation(extractionId);

  const handleCreate = () => {
    if (!newName.trim() || !newQuery.trim()) return;
    createMutation.mutate(
      { name: newName, description: "", extraction_id: extractionId, aggregation_query: newQuery },
      {
        onSuccess: () => {
          setShowCreate(false);
          setNewName("");
          setNewQuery("");
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Named Aggregations</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 h-7 text-xs"
        >
          <Plus className="h-3 w-3" /> New Aggregation
        </Button>
      </div>

      {aggregations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No aggregations yet. Create one to build reusable queries.
        </p>
      ) : (
        <div className="space-y-3">
          {aggregations.map((agg) => (
            <AggregationCard key={agg.id} agg={agg} extractionId={extractionId} />
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Aggregation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Revenue by Client"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Query</Label>
              <Textarea
                placeholder="e.g. Total invoice amount grouped by client name"
                value={newQuery}
                onChange={(e) => setNewQuery(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || !newQuery.trim() || createMutation.isPending}
              className="w-full"
            >
              {createMutation.isPending ? "Creating..." : "Create Aggregation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ExtractionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isIndexing = (status: string) => status === "indexing";

  const { data: extraction, isLoading, error } = useExtraction(id!);

  useExtraction(id!, {
    refetchInterval: extraction && isIndexing(extraction.status) ? 2000 : false,
  });

  const { data: records, isLoading: recordsLoading } = useExtractionRecords(id!);
  const uploadMutation = useUploadDocuments(id!);
  const reindexMutation = useReindexExtraction(id!);
  const deleteMutation = useDeleteExtraction();
  const exportMutation = useExportCsv();

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));
    uploadMutation.mutate(formData);
    e.target.value = "";
  };

  const handleDelete = () => {
    if (!confirm(`Delete "${extraction?.name}" and all its records?`)) return;
    deleteMutation.mutate(id!, { onSuccess: () => navigate("/") });
  };

  if (isLoading) {
    return (
      <div className="container py-8 max-w-5xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !extraction) {
    return (
      <div className="container py-8 max-w-5xl">
        <Alert variant="destructive">
          <AlertDescription>
            {error ? (error as Error).message : "Extraction not found"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const progress =
    extraction.total_documents > 0
      ? (extraction.processed_documents / extraction.total_documents) * 100
      : 0;

  return (
    <div className="container py-8 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold truncate">{extraction.name}</h1>
            <StatusBadge status={extraction.status} />
          </div>
          {extraction.description && (
            <p className="text-muted-foreground text-sm mt-0.5">{extraction.description}</p>
          )}
        </div>
      </div>

      {/* Info card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Extraction Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <span className="font-medium text-muted-foreground">Instructions: </span>
            {extraction.extraction_instructions}
          </div>
          {extraction.extraction_schema && (
            <div>
              <span className="font-medium text-muted-foreground">Inferred Schema: </span>
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{extraction.extraction_schema}</code>
            </div>
          )}
          {extraction.extraction_error && (
            <Alert variant="destructive">
              <AlertDescription>{extraction.extraction_error}</AlertDescription>
            </Alert>
          )}
          {isIndexing(extraction.status) && extraction.total_documents > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Processing documents...</span>
                <span>{extraction.processed_documents} / {extraction.total_documents}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
          className="hidden"
          onChange={handleUpload}
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Documents
        </Button>
        <Button
          variant="outline"
          onClick={() => reindexMutation.mutate()}
          disabled={reindexMutation.isPending || isIndexing(extraction.status)}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Reindex
        </Button>
        <Button
          variant="outline"
          onClick={() => exportMutation.mutate({ id: id!, name: extraction.name })}
          disabled={exportMutation.isPending || !records?.length}
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <Button variant="outline" onClick={handleDelete} className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records">
            Records {records && `(${records.length})`}
          </TabsTrigger>
          <TabsTrigger value="query">Query</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
        </TabsList>
        <TabsContent value="records" className="mt-4">
          <RecordsTable records={records ?? []} isLoading={recordsLoading} />
        </TabsContent>
        <TabsContent value="query" className="mt-4 space-y-8">
          <AggregationsPanel extractionId={id!} />
          <div>
            <h3 className="font-medium text-sm mb-4">Ad-hoc Query</h3>
            <QueryPanel extractionId={id!} />
          </div>
        </TabsContent>
        <TabsContent value="chat" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <ChatInterface extractionId={id!} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
