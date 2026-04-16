import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  FileText,
  Folder,
  Link as LinkIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Unlink,
  Upload,
} from "lucide-react";
import {
  createFolder,
  fetchFolder,
  fetchFolderDocuments,
  fetchFolders,
  linkExtractor,
  unlinkExtractor,
  updateFolder,
} from "@/api/folders";
import { fetchSifts } from "@/api/extractions";
import { DocumentWithStatuses } from "@/api/folders";
import { DocumentSiftStatus } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UploadModal } from "@/components/UploadModal";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function statusColor(status: string) {
  switch (status) {
    case "done": return "success";
    case "processing": return "info";
    case "pending": return "pending";
    case "error": return "destructive";
    case "discarded": return "pending";
    default: return "outline";
  }
}

const STATUS_LABELS: Record<string, string> = {
  done: "Extracted",
  processing: "Processing",
  pending: "Pending",
  error: "Error",
  discarded: "Discarded",
};

function DocStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={statusColor(status) as any}>
      {status === "processing" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : status === "done" ? (
        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-500" />
      ) : status === "error" ? (
        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-red-500" />
      ) : status === "pending" || status === "discarded" ? (
        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-slate-400" />
      ) : null}
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export default function FolderBrowserPage() {
  const { id: folderId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // New folder dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Rename
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  // Upload modal
  const [showUpload, setShowUpload] = useState(false);

  // Link sift dialog
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [selectedSiftId, setSelectedSiftId] = useState("");

  // Search
  const [search, setSearch] = useState("");

  // Queries
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ["folders"],
    queryFn: fetchFolders,
  });

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

  // Mutations
  const createMutation = useMutation({
    mutationFn: () => createFolder(newName, newDescription),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      navigate(`/folders/${created.id}`);
    },
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

  const linkedSiftIds = folder?.extractors?.map((e) => e.sift_id) ?? [];
  const availableToLink = allSifts.filter((e) => !linkedSiftIds.includes(e.id));

  // Filter documents by search
  const filteredDocs = documents.filter((d) =>
    d.filename.toLowerCase().includes(search.toLowerCase())
  );

  const isAllDocs = !folderId;
  const title = folder?.name ?? "My Documents";

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="w-48 border-r flex flex-col p-3 gap-1 shrink-0">
        <button
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors w-full text-left ${
            isAllDocs
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
          onClick={() => navigate("/folders")}
        >
          All Documents
        </button>

        {foldersLoading ? (
          <div className="space-y-1 mt-1">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          folders.map((f) => (
            <button
              key={f.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors w-full text-left ${
                folderId === f.id
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              onClick={() => navigate(`/folders/${f.id}`)}
            >
              <Folder className="h-4 w-4 shrink-0" />
              <span className="truncate flex-1">{f.name}</span>
              {f.document_count > 0 && (
                <span className="text-xs text-muted-foreground shrink-0">
                  ({f.document_count})
                </span>
              )}
            </button>
          ))
        )}

        <div className="mt-auto pt-2">
          <button
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors w-full text-left text-muted-foreground hover:text-foreground hover:bg-muted/50"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4 shrink-0" />
            New Folder
          </button>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b flex-wrap">
          {/* Title / rename */}
          {folderId && editingName ? (
            <div className="flex items-center gap-2 mr-2">
              <Input
                className="h-8 text-sm w-48"
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
                className="h-8"
                onClick={() => nameInput.trim() && renameMutation.mutate(nameInput.trim())}
                disabled={renameMutation.isPending || !nameInput.trim()}
              >
                {renameMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingName(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mr-2">
              <h1 className="text-base font-semibold">{title}</h1>
              {folderId && (
                <button
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => { setNameInput(folder?.name ?? ""); setEditingName(true); }}
                  title="Rename folder"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-8 flex items-center gap-1"
              onClick={() => setShowUpload(true)}
              disabled={folders.length === 0}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 flex items-center gap-1"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              New Folder
            </Button>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search documents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-44 pl-8 pr-3 text-sm rounded-md border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Linked sifts section (folder only) */}
        {folderId && (
          <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Linked Sifts:</span>
            {folder?.extractors?.length === 0 ? (
              <span className="text-xs text-muted-foreground">None</span>
            ) : (
              folder?.extractors?.map((link) => {
                const ext = allSifts.find((e) => e.id === link.sift_id);
                return (
                  <div key={link.id} className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {ext?.name ?? link.sift_id}
                    </Badge>
                    <button
                      onClick={() => unlinkMutation.mutate(link.sift_id)}
                      className="text-muted-foreground hover:text-foreground"
                      title="Unlink"
                    >
                      <Unlink className="h-3 w-3" />
                    </button>
                  </div>
                );
              })
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2 flex items-center gap-1"
              onClick={() => setShowLinkDialog(true)}
            >
              <LinkIcon className="h-3 w-3" />
              Link Sift
            </Button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isAllDocs ? (
            /* All Documents: show folder rows */
            foldersLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : folders.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Folder className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-base font-medium">No folders yet</p>
                <p className="text-sm mt-1">Create a folder to start organizing your documents</p>
                <Button
                  className="mt-4"
                  onClick={() => setShowCreate(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Folder
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {folders
                  .filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
                  .map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/folders/${f.id}`)}
                    >
                      <input
                        type="checkbox"
                        className="shrink-0 rounded border-input"
                        onClick={(e) => e.stopPropagation()}
                        readOnly
                      />
                      <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm flex-1">{f.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {f.document_count} document{f.document_count !== 1 ? "s" : ""}
                      </span>
                      {f.created_at && (
                        <span className="text-xs text-muted-foreground w-20 text-right">
                          {new Date(f.created_at).toLocaleDateString()}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  ))}
              </div>
            )
          ) : (
            /* Folder selected: show document rows */
            docsLoading || folderLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-base font-medium">
                  {search ? "No documents match your search" : "No documents yet"}
                </p>
                {!search && (
                  <p className="text-sm mt-1">Upload documents to this folder to get started</p>
                )}
                {!search && (
                  <Button className="mt-4" onClick={() => setShowUpload(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Documents
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {filteredDocs.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    allSifts={allSifts}
                    onOpen={() => navigate(`/documents/${doc.id}`)}
                    onChat={() => navigate("/chat")}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* New Folder Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g. December Invoices"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim()) createMutation.mutate();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                placeholder="Brief description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newName.trim() || createMutation.isPending}
              className="w-full"
            >
              {createMutation.isPending ? "Creating..." : "Create Folder"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Modal */}
      <UploadModal
        open={showUpload}
        onOpenChange={setShowUpload}
        folders={folders}
        defaultFolderId={folderId}
      />

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

interface DocumentRowProps {
  doc: DocumentWithStatuses;
  allSifts: Array<{ id: string; name: string; description?: string }>;
  onOpen: () => void;
  onChat: () => void;
}

function DocumentRow({ doc, allSifts, onOpen, onChat }: DocumentRowProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
      <input
        type="checkbox"
        className="shrink-0 rounded border-input"
        readOnly
      />
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <button
        className="font-medium text-sm truncate text-left flex-1 hover:underline"
        onClick={onOpen}
      >
        {doc.filename}
      </button>
      <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">
        {formatBytes(doc.size_bytes)}
      </span>
      <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">
        {new Date(doc.uploaded_at).toLocaleDateString()}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        {doc.sift_statuses?.map((s: DocumentSiftStatus) => {
          const ext = allSifts.find((e) => e.id === s.sift_id);
          return (
            <div key={s.sift_id} className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground hidden lg:inline">
                {ext?.name?.substring(0, 10) ?? s.sift_id.substring(0, 6)}:
              </span>
              <DocStatusBadge status={s.status} />
            </div>
          );
        })}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs shrink-0"
        onClick={(e) => { e.stopPropagation(); onChat(); }}
      >
        Chat
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onOpen}>Open</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
