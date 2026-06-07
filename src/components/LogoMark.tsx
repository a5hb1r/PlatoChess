import { Link } from "react-router-dom";

interface LogoProps {
  /** Size of the icon badge */
  iconSize?: "sm" | "md" | "lg";
  /** Font size class for the wordmark text */
  textClass?: string;
  /** Whether to wrap in a Link to "/" */
  asLink?: boolean;
  className?: string;
}

function Inner({ iconSize = "md", textClass = "text-xl" }: LogoProps) {
  const badge: Record<string, string> = {
    sm: "h-7 w-7 text-base rounded-md",
    md: "h-9 w-9 text-lg rounded-lg",
    lg: "h-12 w-12 text-2xl rounded-xl",
  };

  return (
    <>
      <span
        className={`inline-flex items-center justify-center shrink-0 border border-foreground/15 bg-foreground/[0.07] text-foreground select-none leading-none ${badge[iconSize]}`}
        aria-hidden="true"
      >
        ♝
      </span>
      <span className={`font-display font-semibold tracking-tight ${textClass}`}>
        Plato<span className="text-gradient-brand">Chess</span>
      </span>
    </>
  );
}

/** Full inline logo: badge + wordmark. Renders as a <Link> by default. */
export function LogoMark({ asLink = true, iconSize = "md", textClass = "text-xl", className = "" }: LogoProps) {
  const inner = <Inner iconSize={iconSize} textClass={textClass} />;
  if (asLink) {
    return (
      <Link to="/" className={`flex items-center gap-2.5 min-w-0 shrink ${className}`}>
        {inner}
      </Link>
    );
  }
  return <span className={`flex items-center gap-2.5 ${className}`}>{inner}</span>;
}
