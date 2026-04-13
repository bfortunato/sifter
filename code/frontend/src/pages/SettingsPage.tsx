import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Copy, Plus, Trash2 } from "lucide-react";
import { createApiKey, fetchApiKeys, revokeApiKey } from "../api/keys";
import { createWebhook, deleteWebhook, fetchWebhooks, type Webhook as WebhookType } from "../api/webhooks";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { useAuthContext } from "../context/AuthContext";
import { APIKey } from "../api/types";

type Section = "profile" | "api-keys" | "webhooks" | "organization";

const sections: { id: Section; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "api-keys", label: "API Keys" },
  { id: "webhooks", label: "Webhooks" },
  { id: "organization", label: "Organization" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<Section>("profile");

  return (
    <div className="flex h-full">
      {/* Left nav */}
      <div className="w-44 border-r p-3 flex flex-col gap-1 shrink-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2">
          Settings
        </p>
        {sections.map((s) => (
          <button
            key={s.id}
            className={`flex items-center px-3 py-2 rounded-md text-sm transition-colors w-full text-left ${
              activeSection === s.id
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            onClick={() => setActiveSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-2xl">
          {activeSection === "profile" && <ProfileSection />}
          {activeSection === "api-keys" && <ApiKeysSection />}
          {activeSection === "webhooks" && <WebhooksSection />}
          {activeSection === "organization" && <OrganizationSection />}
        </div>
      </div>
    </div>
  );
}

function ProfileSection() {
  const { user } = useAuthContext();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground mt-1">Your account information</p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">Email</Label>
          <p className="text-sm font-medium">{user?.email ?? "—"}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">Full Name</Label>
          <p className="text-sm font-medium">{user?.full_name ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}

function ApiKeysSection() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: fetchApiKeys,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createApiKey(name),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      setCreatedKey(data.plaintext);
      setNewKeyName("");
      setShowCreate(false);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => revokeApiKey(keyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">API Keys</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage your API keys for programmatic access</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="flex items-center gap-1">
          <Plus className="h-4 w-4" /> Create API Key
        </Button>
      </div>

      {/* Warning callout */}
      <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <p className="text-sm">
          API keys are only shown once. If you didn&apos;t save yours, generate a new one and update your integration.
        </p>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">No API keys yet. Create one to get started.</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Key Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">API Key</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created At</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key: APIKey) => (
                <tr key={key.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{key.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {key.key_prefix}••••••••
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(key.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeMutation.mutate(key.id)}
                      disabled={revokeMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Key name</Label>
              <Input
                placeholder="e.g. Production SDK"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <Button
              onClick={() => createMutation.mutate(newKeyName)}
              disabled={!newKeyName.trim() || createMutation.isPending}
              className="w-full"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
            {createMutation.isError && (
              <p className="text-sm text-destructive">{createMutation.error?.message}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Show created key once */}
      <Dialog open={!!createdKey} onOpenChange={() => setCreatedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your new API key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Copy this key now — it will not be shown again.
            </p>
            <div className="flex gap-2 items-center">
              <code className="flex-1 text-xs bg-muted p-2 rounded font-mono break-all">
                {createdKey}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => createdKey && navigator.clipboard.writeText(createdKey)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={() => setCreatedKey(null)} className="w-full">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WebhooksSection() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState("**");

  const { data: hooks = [], isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: fetchWebhooks,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createWebhook({
        events: newEvents.split(",").map((e) => e.trim()).filter(Boolean),
        url: newUrl,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setShowCreate(false);
      setNewUrl("");
      setNewEvents("**");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (hookId: string) => deleteWebhook(hookId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhooks"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Webhooks</h2>
          <p className="text-sm text-muted-foreground mt-1">Receive event notifications via HTTP</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="flex items-center gap-1">
          <Plus className="h-4 w-4" /> Register Webhook
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : hooks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No webhooks registered.</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">URL</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Events</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created At</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {hooks.map((hook: WebhookType) => (
                <tr key={hook.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs truncate max-w-[200px]">{hook.url}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {hook.events.join(", ")}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(hook.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(hook.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register Webhook</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                placeholder="https://your-app.com/webhook"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              <Input
                placeholder="** or sift.*, sift.completed"
                value={newEvents}
                onChange={(e) => setNewEvents(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated patterns. Use <code>**</code> for all events,{" "}
                <code>sift.*</code> for all sift events.
              </p>
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newUrl.trim() || !newEvents.trim() || createMutation.isPending}
              className="w-full"
            >
              {createMutation.isPending ? "Registering..." : "Register"}
            </Button>
            {createMutation.isError && (
              <p className="text-sm text-destructive">{createMutation.error?.message}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrganizationSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Organization</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage your organization settings</p>
      </div>
      <p className="text-sm text-muted-foreground">Organization settings coming soon.</p>
    </div>
  );
}
