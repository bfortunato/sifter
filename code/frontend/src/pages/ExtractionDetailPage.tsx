import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { RecordsTable } from "@/components/RecordsTable";
import { QueryPanel } from "@/components/QueryPanel";
import { ChatInterface } from "@/components/ChatInterface";
import {
  useDeleteExtraction,
  useExportCsv,
  useExtraction,
  useExtractionRecords,
  useReindexExtraction,
  useUploadDocuments,
} from "@/hooks/useExtractions";

export function ExtractionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isIndexing = (status: string) => status === "indexing";

  // First load without polling
  const { data: extraction, isLoading, error } = useExtraction(id!);

  // When indexing, poll every 2s (this query stays enabled only during indexing)
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
        <TabsContent value="query" className="mt-4">
          <QueryPanel extractionId={id!} />
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
