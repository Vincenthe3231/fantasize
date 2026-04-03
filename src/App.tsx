import { lazy, Suspense } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";

const IndexPage = lazy(() => import("@/pages/Index"));
const SignInPage = lazy(() => import("@/pages/SignIn"));
const NotFoundPage = lazy(() => import("./pages/NotFound.tsx"));

/** Common typo: `/siginin` → `/signin` (preserves query string). */
function SigininAliasRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: "/signin", search }} replace />;
}

function AppCanvasFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--canvas-bg)]">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-[var(--accent-color)]"
        aria-hidden
      />
      <span className="sr-only">Loading workspace…</span>
    </div>
  );
}

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  /** v2: prior cache held stale `canvas-space` (never refetched with staleTime:Infinity) */
  key: "vision-forge-rq-v2",
});

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister,
      maxAge: 1000 * 60 * 60 * 24,
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => query.queryKey[0] !== "canvas-space",
      },
    }}
  >
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <Suspense fallback={<AppCanvasFallback />}>
                <IndexPage />
              </Suspense>
            }
          />
          <Route
            path="/w/:spaceId"
            element={
              <Suspense fallback={<AppCanvasFallback />}>
                <IndexPage />
              </Suspense>
            }
          />
          <Route
            path="/signin"
            element={
              <Suspense fallback={null}>
                <SignInPage />
              </Suspense>
            }
          />
          <Route path="/siginin" element={<SigininAliasRedirect />} />
          <Route
            path="*"
            element={
              <Suspense fallback={null}>
                <NotFoundPage />
              </Suspense>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
  </PersistQueryClientProvider>
);

export default App;
