import { BrowserRouter, Link, NavLink, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  FileText,
  Folder,
  LogOut,
  MessageCircle,
  Settings,
} from "lucide-react";
import logo from "@/assets/logo.svg";
import { SiftsPage } from "@/pages/SiftsPage";
import { SiftDetailPage } from "@/pages/SiftDetailPage";
import { ChatPage } from "@/pages/ChatPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import SettingsPage from "@/pages/SettingsPage";
import FolderBrowserPage from "@/pages/FolderBrowserPage";
import DocumentDetailPage from "@/pages/DocumentDetailPage";
import LandingPage from "@/pages/LandingPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProvider, useAuthContext } from "@/context/AuthContext";
import { ConfigProvider } from "@/context/ConfigContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all w-full ${
    isActive
      ? "bg-primary/10 font-medium text-foreground border-l-2 border-primary pl-[10px]"
      : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border-l-2 border-transparent pl-[10px]"
  }`;

function Sidebar() {
  const { isAuthenticated, user, logout } = useAuthContext();

  if (!isAuthenticated) return null;

  return (
    <aside className="w-56 h-screen sticky top-0 flex flex-col border-r bg-card shrink-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border/50">
        <Link
          to="/"
          className="font-bold text-lg tracking-tight flex items-center gap-2.5"
        >
          <img src={logo} alt="Sifter" className="h-7 w-7" />
          <span className="text-primary">Sifter</span>
        </Link>
      </div>

      {/* Main nav */}
      <nav className="flex flex-col gap-0.5 px-2 pt-3">
        <NavLink to="/" end className={navLinkClass}>
          <FileText className="h-4 w-4 shrink-0" />
          Sifts
        </NavLink>
        <NavLink to="/folders" className={navLinkClass}>
          <Folder className="h-4 w-4 shrink-0" />
          Folders
        </NavLink>
        <NavLink to="/chat" className={navLinkClass}>
          <MessageCircle className="h-4 w-4 shrink-0" />
          Chat
        </NavLink>
      </nav>

      {/* Bottom section */}
      <div className="mt-auto flex flex-col gap-0.5 px-2 pb-4 border-t border-border/50 pt-3">
        {user?.email && (
          <p className="px-3 py-1 text-xs text-muted-foreground truncate">
            {user.email}
          </p>
        )}
        <NavLink to="/settings" className={navLinkClass}>
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </NavLink>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all w-full text-left border-l-2 border-transparent pl-[10px]"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <SiftsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sifts/:id"
              element={
                <ProtectedRoute>
                  <SiftDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/folders"
              element={
                <ProtectedRoute>
                  <FolderBrowserPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/folders/:id"
              element={
                <ProtectedRoute>
                  <FolderBrowserPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents/:id"
              element={
                <ProtectedRoute>
                  <DocumentDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Routes>
        </main>
      </div>
    );
  }

  // Unauthenticated
  return (
    <div className="min-h-screen bg-background">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <SiftsPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ConfigProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ConfigProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
