import { BrowserRouter, Link, NavLink, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  FileText,
  Folder,
  LogOut,
  MessageCircle,
  Settings,
} from "lucide-react";
import { SiftsPage } from "@/pages/SiftsPage";
import { SiftDetailPage } from "@/pages/SiftDetailPage";
import { ChatPage } from "@/pages/ChatPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import SettingsPage from "@/pages/SettingsPage";
import FoldersPage from "@/pages/FoldersPage";
import FolderDetailPage from "@/pages/FolderDetailPage";
import DocumentDetailPage from "@/pages/DocumentDetailPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProvider, useAuthContext } from "@/context/AuthContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors text-sm ${
    isActive
      ? "bg-muted font-medium"
      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
  }`;

function NavBar() {
  const { isAuthenticated, user, logout } = useAuthContext();

  if (!isAuthenticated) return null;

  return (
    <nav className="border-b bg-background sticky top-0 z-40">
      <div className="container max-w-5xl flex items-center h-14 gap-6">
        <Link to="/" className="font-bold text-lg tracking-tight flex items-center gap-2">
          <span className="text-primary">⬡</span> Sifter
        </Link>
        <div className="flex items-center gap-1 flex-1">
          <NavLink to="/" end className={navLinkClass}>
            <FileText className="h-4 w-4" />
            Sifts
          </NavLink>
          <NavLink to="/folders" className={navLinkClass}>
            <Folder className="h-4 w-4" />
            Folders
          </NavLink>
          <NavLink to="/chat" className={navLinkClass}>
            <MessageCircle className="h-4 w-4" />
            Chat
          </NavLink>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">
            {user?.email}
          </span>
          <NavLink to="/settings" className={navLinkClass}>
            <Settings className="h-4 w-4" />
          </NavLink>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}

function AppRoutes() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes */}
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
              <FoldersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/folders/:id"
          element={
            <ProtectedRoute>
              <FolderDetailPage />
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
