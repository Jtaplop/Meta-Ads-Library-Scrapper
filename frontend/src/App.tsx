import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/skeleton";

const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const NewScrapePage = lazy(() =>
  import("@/pages/NewScrapePage").then((m) => ({ default: m.NewScrapePage }))
);
const BatchPage = lazy(() =>
  import("@/pages/BatchPage").then((m) => ({ default: m.BatchPage }))
);
const JobsPage = lazy(() =>
  import("@/pages/JobsPage").then((m) => ({ default: m.JobsPage }))
);
const JobDetailPage = lazy(() =>
  import("@/pages/JobDetailPage").then((m) => ({ default: m.JobDetailPage }))
);
const ResultsPage = lazy(() =>
  import("@/pages/ResultsPage").then((m) => ({ default: m.ResultsPage }))
);
const ResultDetailPage = lazy(() =>
  import("@/pages/ResultDetailPage").then((m) => ({ default: m.ResultDetailPage }))
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);
const NotFoundPage = lazy(() =>
  import("@/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PageFallback() {
  return (
    <div className="space-y-6 p-2">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route
              index
              element={
                <Suspense fallback={<PageFallback />}>
                  <DashboardPage />
                </Suspense>
              }
            />
            <Route
              path="scrape/new"
              element={
                <Suspense fallback={<PageFallback />}>
                  <NewScrapePage />
                </Suspense>
              }
            />
            <Route
              path="scrape/batch"
              element={
                <Suspense fallback={<PageFallback />}>
                  <BatchPage />
                </Suspense>
              }
            />
            <Route
              path="jobs"
              element={
                <Suspense fallback={<PageFallback />}>
                  <JobsPage />
                </Suspense>
              }
            />
            <Route
              path="jobs/:jobId"
              element={
                <Suspense fallback={<PageFallback />}>
                  <JobDetailPage />
                </Suspense>
              }
            />
            <Route
              path="results"
              element={
                <Suspense fallback={<PageFallback />}>
                  <ResultsPage />
                </Suspense>
              }
            />
            <Route
              path="results/:filename"
              element={
                <Suspense fallback={<PageFallback />}>
                  <ResultDetailPage />
                </Suspense>
              }
            />
            <Route
              path="settings"
              element={
                <Suspense fallback={<PageFallback />}>
                  <SettingsPage />
                </Suspense>
              }
            />
            <Route
              path="*"
              element={
                <Suspense fallback={<PageFallback />}>
                  <NotFoundPage />
                </Suspense>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
