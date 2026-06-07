import { Suspense, lazy, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { installAudioUnlockListeners } from "@/lib/sounds";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { GuestOnboarding } from "@/components/GuestOnboarding";
import { GuestBanner } from "@/components/GuestBanner";
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
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

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
              <GuestOnboarding />
              <GuestBanner />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route
                  path="/play"
                  element={
                    <Suspense fallback={<div className="min-h-screen bg-background" />}>
                      <Play />
                    </Suspense>
                  }
                />
                <Route
                  path="/game"
                  element={
                    <Suspense fallback={<div className="min-h-screen bg-background" />}>
                      <Game />
                    </Suspense>
                  }
                />
                <Route
                  path="/analyze-game"
                  element={
                    <Suspense fallback={<div className="min-h-screen bg-background" />}>
                      <AnalyzeGame />
                    </Suspense>
                  }
                />
                <Route
                  path="/puzzles"
                  element={
                    <Suspense fallback={<div className="min-h-screen bg-background" />}>
                      <Puzzles />
                    </Suspense>
                  }
                />
                <Route
                  path="/analyze"
                  element={
                    <Suspense fallback={<div className="min-h-screen bg-background" />}>
                      <Analyze />
                    </Suspense>
                  }
                />
                <Route
                  path="/openings"
                  element={
                    <Suspense fallback={<div className="min-h-screen bg-background" />}>
                      <Openings />
                    </Suspense>
                  }
                />
                <Route
                  path="/privacy"
                  element={
                    <Suspense fallback={<div className="min-h-screen bg-background" />}>
                      <Privacy />
                    </Suspense>
                  }
                />
                <Route
                  path="/terms"
                  element={
                    <Suspense fallback={<div className="min-h-screen bg-background" />}>
                      <Terms />
                    </Suspense>
                  }
                />
                <Route
                  path="/auth"
                  element={
                    <Suspense fallback={<div className="min-h-screen bg-background" />}>
                      <Auth />
                    </Suspense>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <Suspense fallback={<div className="min-h-screen bg-background" />}>
                      <Dashboard />
                    </Suspense>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <Suspense fallback={<div className="min-h-screen bg-background" />}>
                      <Settings />
                    </Suspense>
                  }
                />
                <Route
                  path="/pricing"
                  element={
                    <Suspense fallback={<div className="min-h-screen bg-background" />}>
                      <Pricing />
                    </Suspense>
                  }
                />
                <Route
                  path="/bots"
                  element={
                    <Suspense fallback={<div className="min-h-screen bg-background" />}>
                      <Bots />
                    </Suspense>
                  }
                />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route
                  path="*"
                  element={
                    <Suspense fallback={<div className="min-h-screen bg-background" />}>
                      <NotFound />
                    </Suspense>
                  }
                />
              </Routes>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
