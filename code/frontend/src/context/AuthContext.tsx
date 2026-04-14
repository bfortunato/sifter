import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { clearApiKey, getApiKey, setApiKey } from "../lib/apiFetch";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  apiKey: string | null;
  saveApiKey: (key: string) => void;
  logout: () => void;
  // Legacy shims (no-op for compat with pages that might reference them)
  user: null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = getApiKey();
    setKey(stored);
    setIsLoading(false);
  }, []);

  // Handle auth-expired events
  useEffect(() => {
    const handler = () => {
      setKey(null);
      navigate("/setup");
    };
    window.addEventListener("sifter:auth-expired", handler);
    return () => window.removeEventListener("sifter:auth-expired", handler);
  }, [navigate]);

  const saveApiKey = useCallback((key: string) => {
    setApiKey(key);
    setKey(key);
  }, []);

  const logout = useCallback(() => {
    clearApiKey();
    setKey(null);
    navigate("/setup");
  }, [navigate]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!apiKey,
        isLoading,
        apiKey,
        saveApiKey,
        logout,
        user: null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used inside AuthProvider");
  return ctx;
}
