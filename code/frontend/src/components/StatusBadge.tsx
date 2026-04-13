import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SiftStatus } from "@/api/types";

const STATUS_CONFIG: Record<
  SiftStatus,
  { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "outline" }
> = {
  active: { label: "Active", variant: "success" },
  indexing: { label: "Indexing", variant: "warning" },
  paused: { label: "Paused", variant: "secondary" },
  error: { label: "Error", variant: "destructive" },
};

interface StatusBadgeProps {
  status: SiftStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, variant } = STATUS_CONFIG[status] ?? { label: status, variant: "outline" };
  return (
    <Badge variant={variant as any} className="gap-1">
      {status === "indexing" && <Loader2 className="h-3 w-3 animate-spin" />}
      {label}
    </Badge>
  );
}
