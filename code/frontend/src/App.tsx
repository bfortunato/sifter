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
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProvider, useAuthContext } from "@/context/AuthContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors w-full ${
    isActive
      ? "bg-muted font-medium text-foreground"
      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
  }`;

function Sidebar() {
  const { isAuthenticated, user, logout } = useAuthContext();

  if (!isAuthenticated) return null;

  return (
    <aside className="w-56 h-screen sticky top-0 flex flex-col border-r bg-background shrink-0">
      {/* Logo */}
      <div className="px-4 py-4">
        <Link
          to="/"
          className="font-bold text-lg tracking-tight flex items-center gap-2.5"
        >
          <img src={logo} alt="Sifter" className="h-7 w-7" />
          <span className="text-primary">Sifter</span>
        </Link>
      </div>

      {/* Main nav */}
      <nav className="flex flex-col gap-1 px-2">
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
      <div className="mt-auto flex flex-col gap-1 px-2 pb-4">
        <NavLink to="/settings" className={navLinkClass}>
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </NavLink>
        {user?.email && (
          <p className="px-3 py-1 text-xs text-muted-foreground truncate">
            {user.email}
          </p>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors w-full text-left"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Logout
        </button>
      </div>
    </aside>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuthContext();

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
            {/* Fallback for public routes when already authenticated */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Routes>
        </main>
      </div>
    );
  }

  // Unauthenticated: no sidebar, full-screen public routes
  return (
    <div className="min-h-screen bg-background">
      <Routes>
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
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
