import { Link } from "react-router-dom";
import logo from "@/assets/platochess-logo.png";

const Footer = () => {
  const appleStoreUrl = import.meta.env.VITE_APPLE_APP_STORE_URL?.trim();
  const googlePlayUrl = import.meta.env.VITE_GOOGLE_PLAY_URL?.trim();
  const hasStoreLinks = Boolean(appleStoreUrl || googlePlayUrl);

  return (
    <footer className="border-t border-border py-12">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded-lg object-cover opacity-90 ring-1 ring-border/30"
              decoding="async"
            />
            <span className="font-display text-sm text-muted-foreground">
              Platochess  2026
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 font-body text-xs text-muted-foreground">
            {hasStoreLinks && (
              <div className="flex items-center gap-4">
                <span>Get the app:</span>
                {appleStoreUrl && (
                  <a
                    href={appleStoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    App Store
                  </a>
                )}
                {googlePlayUrl && (
                  <a
                    href={googlePlayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    Google Play
                  </a>
                )}
              </div>
            )}
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <a
              href="mailto:support@platochess.com?subject=Platochess"
              className="hover:text-foreground transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
