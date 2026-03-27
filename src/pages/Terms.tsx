import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Terms = () => {
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
          <h1 className="font-display text-xl font-semibold">Terms of Service</h1>
        </div>
      </nav>

      <main className="container mx-auto max-w-3xl px-6 py-10 font-body text-sm text-muted-foreground space-y-6">
        <p>Last updated: March 2026.</p>
        <section className="space-y-2">
          <h2 className="font-display text-lg text-foreground">Use of service</h2>
          <p>
            You may use Platochess for personal, non-abusive play and study. You agree not to disrupt service
            availability or misuse platform features.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-lg text-foreground">Accounts</h2>
          <p>
            You are responsible for your account credentials and activity. We may suspend accounts for abuse,
            impersonation, or harmful behavior.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-lg text-foreground">No warranty</h2>
          <p>
            Platochess is provided "as is." We work to keep the service reliable but do not guarantee uninterrupted
            availability.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-lg text-foreground">Contact</h2>
          <p>
            Questions about these terms can be sent to{" "}
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

export default Terms;
