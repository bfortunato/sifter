import { BrowserRouter, Link, NavLink, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FileText, MessageCircle } from "lucide-react";
import { ExtractionsPage } from "@/pages/ExtractionsPage";
import { ExtractionDetailPage } from "@/pages/ExtractionDetailPage";
import { ChatPage } from "@/pages/ChatPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

function NavBar() {
  return (
    <nav className="border-b bg-background sticky top-0 z-40">
      <div className="container max-w-5xl flex items-center h-14 gap-6">
        <Link to="/" className="font-bold text-lg tracking-tight flex items-center gap-2">
          <span className="text-primary">⬡</span> Sifter
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                isActive ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`
            }
          >
            <FileText className="h-4 w-4" />
            Extractions
          </NavLink>
          <NavLink
            to="/chat"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                isActive ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`
            }
          >
            <MessageCircle className="h-4 w-4" />
            Chat
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          <NavBar />
          <Routes>
            <Route path="/" element={<ExtractionsPage />} />
            <Route path="/extractions/:id" element={<ExtractionDetailPage />} />
            <Route path="/chat" element={<ChatPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
