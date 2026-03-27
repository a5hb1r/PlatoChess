import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center gap-4 px-6 py-4">
          <Link
            to="/"
            className="flex items-center gap-2 font-body text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="font-display text-xl font-semibold">Privacy Policy</h1>
        </div>
      </nav>

      <main className="container mx-auto max-w-3xl px-6 py-10 font-body text-sm text-muted-foreground space-y-6">
        <p>Last updated: March 2026.</p>
        <section className="space-y-2">
          <h2 className="font-display text-lg text-foreground">What we collect</h2>
          <p>
            We collect account information you provide (such as email), gameplay activity (such as games, puzzles,
            and settings), and technical logs needed to operate, secure, and improve Platochess.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-lg text-foreground">How we use data</h2>
          <p>
            We use your data to run the app, personalize your experience, improve performance, and prevent abuse. We
            do not sell personal data.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-lg text-foreground">Third-party services</h2>
          <p>
            Platochess uses third-party providers (for example authentication, hosting, and analytics). These
            providers process data only as needed to provide their services.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-lg text-foreground">Contact</h2>
          <p>
            For privacy requests, contact{" "}
            <a className="text-foreground hover:underline" href="mailto:support@platochess.com">
              support@platochess.com
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
};

export default Privacy;
