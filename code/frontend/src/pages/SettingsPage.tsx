import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Key, Plus, Trash2, Users, Webhook } from "lucide-react";
import { createApiKey, fetchApiKeys, revokeApiKey } from "../api/keys";
import { addMember, fetchMembers } from "../api/orgs";
import { createWebhook, deleteWebhook, fetchWebhooks, type Webhook as WebhookType } from "../api/webhooks";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { useAuthContext } from "../context/AuthContext";
import { APIKey } from "../api/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

export default function SettingsPage() {
  const { user } = useAuthContext();

  return (
    <div className="container mx-auto py-8 max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>
      <ApiKeysSection />
      <WebhooksSection />
      <OrgSection />
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-4 w-4" /> API Keys
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No API keys yet.</p>
        ) : (
          <div className="space-y-2">
            {keys.map((key: APIKey) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-3 border rounded-md"
              >
                <div>
                  <p className="font-medium text-sm">{key.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {key.key_prefix}...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {formatDate(key.created_at)}
                    {key.last_used_at && ` · Last used ${formatDate(key.last_used_at)}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeMutation.mutate(key.id)}
                  disabled={revokeMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1"
        >
          <Plus className="h-4 w-4" /> Create Key
        </Button>

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
                <p className="text-sm text-destructive">
                  {createMutation.error?.message}
                </p>
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
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-4 w-4" /> Webhooks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : hooks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No webhooks registered.</p>
        ) : (
          <div className="space-y-2">
            {hooks.map((hook: WebhookType) => (
              <div key={hook.id} className="flex items-start justify-between p-3 border rounded-md gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{hook.url}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {hook.events.join(", ")}
                  </p>
                  {hook.sift_id && (
                    <p className="text-xs text-muted-foreground">Sift: {hook.sift_id}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Created {formatDate(hook.created_at)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(hook.id)}
                  disabled={deleteMutation.isPending}
                  className="shrink-0"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1"
        >
          <Plus className="h-4 w-4" /> Register Webhook
        </Button>

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
      </CardContent>
    </Card>
  );
}

function OrgSection() {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");

  // We'd need org_id from the token — for now use a placeholder approach
  // In a real app, org_id would come from auth context
  const { data: members = [] } = useQuery({
    queryKey: ["org-members"],
    queryFn: () =>
      // We don't have org_id directly here; this would need it from context
      // For now just return empty — a full implementation would store org_id in AuthContext
      Promise.resolve([]),
    enabled: false,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" /> Organization
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Logged in as <span className="font-medium">{user?.email}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Organization management (invite members, create organizations) coming soon.
        </p>
      </CardContent>
    </Card>
  );
}
