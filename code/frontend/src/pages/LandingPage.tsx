import { Link } from "react-router-dom";
import { Filter, Folder, MessageCircle } from "lucide-react";
import logo from "@/assets/logo.svg";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="bg-background border-b sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Sifter" className="h-7 w-7" />
            <span className="text-primary font-bold text-lg tracking-tight">Sifter</span>
          </div>
          <nav className="flex items-center gap-2">
            <a
              href="https://github.com/sifter-ai/sifter"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              Docs
            </a>
            <a
              href="https://github.com/sifter-ai/sifter"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              GitHub
            </a>
            <Link
              to="/setup"
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Get Started →
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="py-24 text-center">
        <div className="max-w-4xl mx-auto px-6">
          <span className="inline-block border border-primary/30 text-primary text-xs font-medium px-3 py-1 rounded-full bg-primary/5 mb-6">
            Open Source
          </span>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
            Turn documents into structured data — instantly
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mt-4 leading-relaxed">
            Upload PDFs and images. Sifter extracts structured fields with AI, stores them in a queryable database, and lets you chat with your data.
          </p>
          <div className="mt-8 flex gap-3 justify-center flex-wrap">
            <Link
              to="/setup"
              className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity"
            >
              Get Started →
            </Link>
            <a
              href="https://github.com/sifter-ai/sifter"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-input px-6 py-3 rounded-md font-medium text-sm hover:bg-muted/50 transition-colors"
            >
              View Docs
            </a>
          </div>

          {/* Code block */}
          <div className="mt-12 max-w-xl mx-auto">
            <div className="bg-muted rounded-lg p-4 text-left font-mono text-sm">
              <pre className="text-muted-foreground overflow-x-auto">
                <code>
                  <span className="text-primary">from</span>{" "}
                  {"sifter"}{" "}
                  <span className="text-primary">import</span>{" "}
                  {"Sifter\n\n"}
                  {"s = Sifter(api_key="}
                  <span className="text-primary">"sk-..."</span>
                  {")\n"}
                  {"records = s.sift("}
                  <span className="text-primary">"./invoices/"</span>
                  {", "}
                  <span className="text-primary">"client, date, total"</span>
                  {")"}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center mb-12">
            Everything you need to process documents at scale
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="border rounded-xl p-6 bg-card">
              <div className="bg-primary/10 text-primary rounded-lg p-2 w-fit">
                <Filter className="h-5 w-5" />
              </div>
              <h3 className="font-semibold mt-4">Define once, extract forever</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Write extraction instructions in plain English. Sifter infers the schema automatically and applies it to every new document.
              </p>
            </div>

            {/* Card 2 */}
            <div className="border rounded-xl p-6 bg-card">
              <div className="bg-primary/10 text-primary rounded-lg p-2 w-fit">
                <Folder className="h-5 w-5" />
              </div>
              <h3 className="font-semibold mt-4">Organise and automate</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Group documents in folders linked to multiple sifts. Upload once, process everywhere — automatically.
              </p>
            </div>

            {/* Card 3 */}
            <div className="border rounded-xl p-6 bg-card">
              <div className="bg-primary/10 text-primary rounded-lg p-2 w-fit">
                <MessageCircle className="h-5 w-5" />
              </div>
              <h3 className="font-semibold mt-4">Ask your documents anything</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Query results with natural language or SQL. Get structured tables or conversational answers powered by AI.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 border-t bg-muted/30">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center mb-12">
            Up and running in minutes
          </h2>
          <div className="flex flex-col md:flex-row gap-8 justify-center">
            {/* Step 1 */}
            <div className="flex-1 text-center">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center mx-auto">
                1
              </div>
              <h3 className="font-semibold mt-3">Create a sift</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Give it a name and describe what to extract in plain English.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex-1 text-center">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center mx-auto">
                2
              </div>
              <h3 className="font-semibold mt-3">Upload documents</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Drag and drop PDFs, images, or connect a folder for automatic processing.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex-1 text-center">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center mx-auto">
                3
              </div>
              <h3 className="font-semibold mt-3">Query your data</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Use natural language, SQL aggregations, or the Python SDK to get results.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SDK section */}
      <section className="py-20 border-t">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div>
              <h2 className="text-2xl font-bold">Python SDK included</h2>
              <p className="text-muted-foreground mt-3 leading-relaxed">
                Automate document processing pipelines with a few lines of code. Install from PyPI or use directly from your Sifter server.
              </p>
              <div className="mt-6 bg-muted rounded-lg px-4 py-3 font-mono text-sm inline-flex items-center gap-2">
                <span className="text-muted-foreground select-all">pip install sifter-ai</span>
              </div>
            </div>

            {/* Right */}
            <div className="bg-muted rounded-lg p-4 font-mono text-sm">
              <pre className="text-muted-foreground overflow-x-auto leading-relaxed">
                <code>
                  <span className="text-primary">from</span>{" sifter "}
                  <span className="text-primary">import</span>{" Sifter\n\n"}
                  {"s = Sifter(api_key="}
                  <span className="text-primary">"sk-..."</span>
                  {")\n\n"}
                  <span className="text-muted-foreground/60">{"# Create a folder and link sifts\n"}</span>
                  {"folder = s.create_folder("}
                  <span className="text-primary">"Contracts 2024"</span>
                  {")\n"}
                  {"parties = s.create_sift("}
                  <span className="text-primary">"Parties"</span>
                  {", "}
                  <span className="text-primary">"names, dates, signatories"</span>
                  {")\n"}
                  {"clauses = s.create_sift("}
                  <span className="text-primary">"Clauses"</span>
                  {", "}
                  <span className="text-primary">"non-compete, termination"</span>
                  {")\n\n"}
                  {"folder.add_sift(parties)\n"}
                  {"folder.add_sift(clauses)\n"}
                  {"folder.upload("}
                  <span className="text-primary">"./contracts/"</span>
                  {")\n\n"}
                  <span className="text-muted-foreground/60">{"# Wait and query\n"}</span>
                  {"parties.wait()\n"}
                  {"results = parties.query("}
                  <span className="text-primary">"List all contracts expiring this year"</span>
                  {")"}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="flex items-center justify-between max-w-5xl mx-auto px-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Sifter" className="h-5 w-5" />
            <span>Sifter — MIT License</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/sifter-ai/sifter"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://github.com/sifter-ai/sifter"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Docs
            </a>
            <Link
              to="/setup"
              className="hover:text-foreground transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
