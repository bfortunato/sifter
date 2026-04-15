import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UploadCloud, X } from "lucide-react";
import { uploadDocument } from "@/api/folders";
import { Folder } from "@/api/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: Folder[];
  defaultFolderId?: string;
}

export function UploadModal({
  open,
  onOpenChange,
  folders,
  defaultFolderId,
}: UploadModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [targetFolderId, setTargetFolderId] = useState(defaultFolderId ?? folders[0]?.id ?? "");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const targetFolder = folders.find((f) => f.id === targetFolderId);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setSelectedFiles((prev) => [
      ...prev,
      ...Array.from(files).filter(
        (f) => !prev.some((p) => p.name === f.name && p.size === f.size)
      ),
    ]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (!targetFolderId || selectedFiles.length === 0) return;
    setUploading(true);
    try {
      for (const file of selectedFiles) {
        await uploadDocument(targetFolderId, file);
      }
      queryClient.invalidateQueries({ queryKey: ["folder-documents", targetFolderId] });
      queryClient.invalidateQueries({ queryKey: ["folder", targetFolderId] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      setSelectedFiles([]);
      onOpenChange(false);
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setSelectedFiles([]);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Folder selector */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Upload to:</span>
            {folders.length > 1 ? (
              <select
                className="flex h-8 rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={targetFolderId}
                onChange={(e) => setTargetFolderId(e.target.value)}
              >
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-medium">{targetFolder?.name ?? "—"}</span>
            )}
          </div>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Drag & drop PDF, PNG, JPG here</p>
            <p className="text-xs text-muted-foreground mt-1">or click to select files</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.webp"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          <p className="text-xs text-muted-foreground">Max file size: 50 MB per file</p>

          {/* Selected files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedFiles.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm p-2 border rounded-md"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                    className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {selectedFiles.length > 0 && (
            <Button
              onClick={handleUpload}
              disabled={uploading || !targetFolderId}
              className="w-full"
            >
              {uploading
                ? "Uploading..."
                : `Upload ${selectedFiles.length} file${selectedFiles.length !== 1 ? "s" : ""}`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
