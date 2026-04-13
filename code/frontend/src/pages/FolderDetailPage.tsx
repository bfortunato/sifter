import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  FileUp,
  Link as LinkIcon,
  Loader2,
  Pencil,
  Unlink,
} from "lucide-react";
import {
  fetchFolder,
  fetchFolderDocuments,
  linkExtractor,
  unlinkExtractor,
  updateFolder,
  uploadDocument,
} from "../api/folders";
import { fetchSifts } from "../api/extractions";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { DocumentWithStatuses } from "../api/folders";
import { DocumentSiftStatus } from "../api/types";

function statusColor(status: string) {
  switch (status) {
    case "done": return "default";
    case "processing": return "secondary";
    case "error": return "destructive";
    default: return "outline";
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={statusColor(status) as any} className="capitalize text-xs">
      {status === "processing" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
      {status}
    </Badge>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function FolderDetailPage() {
  const { id: folderId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [selectedSiftId, setSelectedSiftId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const { data: folder, isLoading: folderLoading } = useQuery({
    queryKey: ["folder", folderId],
    queryFn: () => fetchFolder(folderId!),
    enabled: !!folderId,
  });

  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["folder-documents", folderId],
    queryFn: () => fetchFolderDocuments(folderId!),
    enabled: !!folderId,
    refetchInterval: (query) => {
      const docs = query.state.data as DocumentWithStatuses[] | undefined;
      const hasProcessing = docs?.some((d) =>
        d.sift_statuses?.some((s) => s.status === "processing" || s.status === "pending")
      );
      return hasProcessing ? 2000 : false;
    },
  });

  const { data: allSifts = [] } = useQuery({
    queryKey: ["sifts"],
    queryFn: fetchSifts,
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) => updateFolder(folderId!, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folder", folderId] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      setEditingName(false);
    },
  });

  const linkMutation = useMutation({
    mutationFn: () => linkExtractor(folderId!, selectedSiftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folder", folderId] });
      setShowLinkDialog(false);
      setSelectedSiftId("");
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (siftId: string) => unlinkExtractor(folderId!, siftId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["folder", folderId] }),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !folderId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadDocument(folderId, file);
      }
      queryClient.invalidateQueries({ queryKey: ["folder-documents", folderId] });
      queryClient.invalidateQueries({ queryKey: ["folder", folderId] });
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const linkedSiftIds = folder?.extractors?.map((e) => e.sift_id) ?? [];
  const availableToLink = allSifts.filter(
    (e) => !linkedSiftIds.includes(e.id)
  );

  if (folderLoading) {
    return (
      <div className="container mx-auto py-8 max-w-4xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <p className="text-destructive">Folder not found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-8">
      {/* Header */}
      <div>
        {editingName ? (
          <div className="flex items-center gap-2">
            <Input
              className="text-2xl font-bold h-auto py-0 px-1 w-64"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nameInput.trim()) renameMutation.mutate(nameInput.trim());
                if (e.key === "Escape") setEditingName(false);
              }}
              autoFocus
            />
            <Button
              size="sm"
              onClick={() => nameInput.trim() && renameMutation.mutate(nameInput.trim())}
              disabled={renameMutation.isPending || !nameInput.trim()}
            >
              {renameMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{folder.name}</h1>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => { setNameInput(folder.name); setEditingName(true); }}
              title="Rename"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {folder.description && (
          <p className="text-muted-foreground">{folder.description}</p>
        )}
      </div>

      {/* Linked Sifts */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Linked Sifts</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLinkDialog(true)}
            className="flex items-center gap-1"
          >
            <LinkIcon className="h-4 w-4" /> Link Sift
          </Button>
        </div>
        {folder.extractors?.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sifts linked. Link a sift to auto-process uploaded documents.
          </p>
        ) : (
          <div className="space-y-2">
            {folder.extractors?.map((link) => {
              const ext = allSifts.find((e) => e.id === link.sift_id);
              return (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <span className="text-sm font-medium">
                    {ext?.name ?? link.sift_id}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => unlinkMutation.mutate(link.sift_id)}
                    disabled={unlinkMutation.isPending}
                  >
                    <Unlink className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload */}
      <div className="space-y-3">
        <h2 className="font-semibold">Documents</h2>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="h-4 w-4" />
            )}
            {uploading ? "Uploading..." : "Upload Documents"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.webp"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {docsLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No documents yet. Upload some files to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 cursor-pointer"
                onClick={() => navigate(`/documents/${doc.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{doc.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(doc.size_bytes)}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {doc.sift_statuses?.map((s: DocumentSiftStatus) => {
                    const ext = allSifts.find((e) => e.id === s.sift_id);
                    return (
                      <div key={s.sift_id} className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">
                          {ext?.name?.substring(0, 12) ?? s.sift_id.substring(0, 8)}:
                        </span>
                        <StatusBadge status={s.status} />
                      </div>
                    );
                  })}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Link Sift Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Sift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {availableToLink.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All sifts are already linked to this folder.
              </p>
            ) : (
              <div className="space-y-2">
                {availableToLink.map((ext) => (
                  <button
                    key={ext.id}
                    className={`w-full text-left p-3 border rounded-md hover:bg-muted/50 text-sm ${
                      selectedSiftId === ext.id ? "border-primary bg-muted" : ""
                    }`}
                    onClick={() => setSelectedSiftId(ext.id)}
                  >
                    <span className="font-medium">{ext.name}</span>
                    {ext.description && (
                      <p className="text-xs text-muted-foreground">{ext.description}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
            <Button
              onClick={() => linkMutation.mutate()}
              disabled={!selectedSiftId || linkMutation.isPending}
              className="w-full"
            >
              {linkMutation.isPending ? "Linking..." : "Link Sift"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
