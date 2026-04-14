import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/context/AuthContext";
import logo from "@/assets/logo.svg";

export default function SetupPage() {
  const [apiKey, setApiKeyInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { saveApiKey } = useAuthContext();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const key = apiKey.trim();
    if (!key) {
      setError("API key is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Verify the key works by hitting /health
      const res = await fetch("/health", {
        headers: { "X-API-Key": key },
      });
      if (res.status === 401) {
        setError("Invalid API key — check your SIFTER_API_KEY setting.");
        setLoading(false);
        return;
      }
      saveApiKey(key);
      navigate("/");
    } catch {
      setError("Could not connect to the Sifter server.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <img src={logo} alt="Sifter" className="h-10 w-10" />
          <span className="text-2xl font-bold text-primary">Sifter</span>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold mb-1">Connect to Sifter</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Enter your API key to get started. Set{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">SIFTER_API_KEY</code>{" "}
            in your server config (default: <code className="text-xs bg-muted px-1 py-0.5 rounded">sk-dev</code>).
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="api-key">
                API Key
              </label>
              <input
                id="api-key"
                type="text"
                value={apiKey}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="sk-dev"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Connecting…" : "Connect"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
