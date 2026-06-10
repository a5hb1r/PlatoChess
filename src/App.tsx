import { Suspense, lazy, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { installAudioUnlockListeners } from "@/lib/sounds";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { GuestOnboarding } from "@/components/GuestOnboarding";
import { GuestBanner } from "@/components/GuestBanner";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index.tsx";
const Play = lazy(() => import("./pages/Play.tsx"));
const Game = lazy(() => import("./pages/Game.tsx"));
const Puzzles = lazy(() => import("./pages/Puzzles.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Analyze = lazy(() => import("./pages/Analyze.tsx"));
const AnalyzeGame = lazy(() => import("./pages/AnalyzeGame.tsx"));
const Openings = lazy(() => import("./pages/Openings.tsx"));
const Privacy = lazy(() => import("./pages/Privacy.tsx"));
const Terms = lazy(() => import("./pages/Terms.tsx"));
const Pricing = lazy(() => import("./pages/Pricing.tsx"));
const Bots = lazy(() => import("./pages/Bots.tsx"));
const ImportGame = lazy(() => import("./pages/ImportGame.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Pages that already embed AppLayout themselves (Dashboard, Play) are
// wrapped here too — they're excluded from the layout route below so
// the sidebar isn't doubled up.
const SidebarLayout = () => (
  <AppLayout>
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <Outlet />
    </Suspense>
  </AppLayout>
);

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    installAudioUnlockListeners();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <ErrorBoundary>
              <GuestOnboarding />
              <GuestBanner />
              <Routes>
                {/* ── Full-page / standalone routes (no sidebar) ── */}
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><Auth /></Suspense>} />
                <Route path="/game" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><Game /></Suspense>} />
                <Route path="/analyze-game" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><AnalyzeGame /></Suspense>} />
                <Route path="/privacy" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><Privacy /></Suspense>} />
                <Route path="/terms" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><Terms /></Suspense>} />

                {/* ── Dashboard & Play embed AppLayout themselves ── */}
                <Route path="/dashboard" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><Dashboard /></Suspense>} />
                <Route path="/play" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><Play /></Suspense>} />

                {/* ── Inner pages — sidebar via SidebarLayout ─────── */}
                <Route element={<SidebarLayout />}>
                  <Route path="/puzzles"  element={<Puzzles />} />
                  <Route path="/analyze"  element={<Analyze />} />
                  <Route path="/openings" element={<Openings />} />
                  <Route path="/bots"     element={<Bots />} />
                  <Route path="/import"   element={<ImportGame />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/pricing"  element={<Pricing />} />
                </Route>

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><NotFound /></Suspense>} />
              </Routes>
              </ErrorBoundary>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
