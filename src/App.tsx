import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import Index from "@/pages/Index";
import NotFound from "./pages/NotFound.tsx";

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
          <Route path="/" element={<Index />} />
          <Route path="/w/:spaceId" element={<Index />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
  </PersistQueryClientProvider>
);

export default App;
