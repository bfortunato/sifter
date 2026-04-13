import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatInterface } from "@/components/ChatInterface";
import { useSifts } from "@/hooks/useExtractions";

export function ChatPage() {
  const [selectedExtractionId, setSelectedExtractionId] = useState<string | undefined>();
  const { data: extractions } = useSifts();

  return (
    <div className="container py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <MessageCircle className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Chat</h1>
          <p className="text-muted-foreground text-sm">Ask questions about your extracted data</p>
        </div>
      </div>

      {extractions && extractions.length > 0 && (
        <div className="mb-4">
          <label className="text-sm font-medium text-muted-foreground block mb-1">
            Extraction (optional — auto-detected if not set)
          </label>
          <select
            className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={selectedExtractionId ?? ""}
            onChange={(e) => setSelectedExtractionId(e.target.value || undefined)}
          >
            <option value="">Auto-detect</option>
            {extractions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <ChatInterface extractionId={selectedExtractionId} />
        </CardContent>
      </Card>
    </div>
  );
}
