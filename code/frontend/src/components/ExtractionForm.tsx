import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCreateSift } from "@/hooks/useExtractions";
import type { CreateSiftPayload } from "@/api/types";

interface ExtractionFormProps {
  trigger: React.ReactNode;
  onCreated?: (id: string) => void;
}

export function ExtractionForm({ trigger, onCreated }: ExtractionFormProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateSiftPayload>({
    name: "",
    description: "",
    instructions: "",
  });
  const { mutate, isPending, error } = useCreateSift();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.instructions) return;
    mutate(form, {
      onSuccess: (sift) => {
        setOpen(false);
        setForm({ name: "", description: "", instructions: "" });
        onCreated?.(sift.id);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Sift</DialogTitle>
          <DialogDescription>
            Create a sift to process documents and extract structured data.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g. December Invoices"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Optional description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions *</Label>
            <Textarea
              id="instructions"
              placeholder="e.g. Extract: client name, invoice date, total amount, VAT number"
              value={form.instructions}
              onChange={(e) =>
                setForm((f) => ({ ...f, instructions: e.target.value }))
              }
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground">
              Describe what fields to extract in natural language.
            </p>
          </div>
          {error && (
            <p className="text-sm text-destructive">{(error as Error).message}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create Sift"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
