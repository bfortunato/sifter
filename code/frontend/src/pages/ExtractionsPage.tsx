import { useNavigate } from "react-router-dom";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { ExtractionForm } from "@/components/ExtractionForm";
import { useSifts } from "@/hooks/useExtractions";

export function ExtractionsPage() {
  const navigate = useNavigate();
  const { data: extractions, isLoading, error } = useSifts();

  return (
    <div className="container py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sifts</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Process documents and query structured data with AI
          </p>
        </div>
        <ExtractionForm
          trigger={
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Sift
            </Button>
          }
          onCreated={(id) => navigate(`/extractions/${id}`)}
        />
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-destructive">
            Failed to load sifts: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {extractions && extractions.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No sifts yet</p>
          <p className="text-sm mt-1">Create your first sift to start processing documents</p>
        </div>
      )}

      {extractions && extractions.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Documents</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody>
              {extractions.map((ext) => (
                <tr
                  key={ext.id}
                  className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/extractions/${ext.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{ext.name}</div>
                    {ext.description && (
                      <div className="text-muted-foreground text-xs mt-0.5">{ext.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={ext.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ext.processed_documents}
                    {ext.total_documents > 0 && ` / ${ext.total_documents}`}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(ext.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
