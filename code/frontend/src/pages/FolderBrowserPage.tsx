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

// Aggregate: what's the "loudest" status across all sifts for a document
function aggregateStatus(statuses: DocumentSiftStatus[]): string | null {
  if (!statuses?.length) return null;
  if (statuses.some((s) => s.status === "error")) return "error";
  if (statuses.some((s) => s.status === "processing")) return "processing";
  if (statuses.some((s) => s.status === "pending")) return "pending";
  if (statuses.every((s) => s.status === "discarded")) return "discarded";
  if (statuses.some((s) => s.status === "done")) return "done";
  return null;
}

function dotColor(status: string) {
  switch (status) {
    case "done": return "bg-emerald-400";
    case "processing": return "bg-amber-400";
    case "pending": return "bg-amber-300";
    case "error": return "bg-red-400";
    case "discarded": return "bg-slate-300";
    default: return "bg-slate-200";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "done": return "Extracted";
    case "processing": return "Processing";
    case "pending": return "Pending";
    case "error": return "Error";
    case "discarded": return "Discarded";
    default: return status;
  }
}

interface SiftDotsProps {
  statuses: DocumentSiftStatus[];
  sifts: Array<{ id: string; name: string }>;
}

function SiftDots({ statuses, sifts }: SiftDotsProps) {
  if (!statuses?.length) return null;

  const hasProcessing = statuses.some(
    (s) => s.status === "processing" || s.status === "pending"
  );

  return (
    <div className="flex items-center gap-1 shrink-0">
      {hasProcessing && (
        <Loader2 className="h-3 w-3 text-amber-500 animate-spin mr-0.5" />
      )}
      {statuses.map((s) => {
        const sift = sifts.find((e) => e.id === s.sift_id);
        const name = sift?.name ?? s.sift_id;
        const label = statusLabel(s.status);
        return (
          <span
            key={s.sift_id}
            className={`w-2 h-2 rounded-full shrink-0 ${dotColor(s.status)} transition-transform hover:scale-125`}
            title={`${name}: ${label}`}
          />
        );
      })}
    </div>
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
      <div className="w-48 border-r flex flex-col p-3 gap-0.5 shrink-0 bg-card">
        <button
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all w-full text-left border-l-2 ${
            isAllDocs
              ? "bg-primary/10 font-medium text-foreground border-primary pl-[10px]"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border-transparent pl-[10px]"
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
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all w-full text-left border-l-2 ${
                folderId === f.id
                  ? "bg-primary/10 font-medium text-foreground border-primary pl-[10px]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border-transparent pl-[10px]"
              }`}
              onClick={() => navigate(`/folders/${f.id}`)}
            >
              <Folder className="h-4 w-4 shrink-0" />
              <span className="truncate flex-1">{f.name}</span>
              {f.document_count > 0 && (
                <span className="font-mono text-[10px] text-muted-foreground shrink-0 tabular-nums">
                  {f.document_count}
                </span>
              )}
            </button>
          ))
        )}

        <div className="mt-auto pt-2 border-t border-border/50">
          <button
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors w-full text-left text-muted-foreground hover:text-foreground hover:bg-muted/60"
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
                      className="flex items-center gap-3 px-4 py-3 hover:bg-primary/[0.03] cursor-pointer transition-colors group"
                      onClick={() => navigate(`/folders/${f.id}`)}
                    >
                      <Folder className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                      <span className="font-medium text-sm flex-1">{f.name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground/60 tabular-nums">
                        {f.document_count} doc{f.document_count !== 1 ? "s" : ""}
                      </span>
                      {f.created_at && (
                        <span className="text-[11px] text-muted-foreground/60 w-20 text-right hidden sm:block">
                          {new Date(f.created_at).toLocaleDateString()}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
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
  const agg = aggregateStatus(doc.sift_statuses ?? []);

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-primary/[0.03] transition-colors group cursor-pointer"
      onClick={onOpen}
    >
      {/* File icon with aggregate status dot */}
      <div className="relative shrink-0">
        <FileText className="h-3.5 w-3.5 text-muted-foreground/50" />
        {agg && (
          <span
            className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-background ${dotColor(agg)}`}
          />
        )}
      </div>

      {/* Filename */}
      <span className="font-medium text-sm truncate flex-1 group-hover:text-primary transition-colors">
        {doc.filename}
      </span>

      {/* Sift dots */}
      {doc.sift_statuses?.length > 0 && (
        <SiftDots statuses={doc.sift_statuses} sifts={allSifts} />
      )}

      {/* Size */}
      <span className="font-mono text-[11px] text-muted-foreground/60 shrink-0 tabular-nums w-14 text-right hidden sm:block">
        {formatBytes(doc.size_bytes)}
      </span>

      {/* Date */}
      <span className="text-[11px] text-muted-foreground/60 shrink-0 w-20 text-right hidden md:block">
        {new Date(doc.uploaded_at).toLocaleDateString()}
      </span>

      {/* Hover actions */}
      <div
        className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={onChat}
        >
          Chat
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpen}>Open</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
