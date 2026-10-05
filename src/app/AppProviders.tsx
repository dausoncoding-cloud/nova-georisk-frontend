import { useEffect, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ApiError } from "../shared/api/errors";
import { subscribeToUnauthorized } from "../shared/api/client";
import { clearCsrfToken } from "../shared/api/csrf";
import { queryKeys } from "../shared/api/queryKeys";
import { ToastProvider } from "../shared/ui/Toast";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnReconnect: true,
    },
    mutations: { retry: false },
  },
});

function SessionInvalidationBridge({ children }: PropsWithChildren) {
  useEffect(
    () =>
      subscribeToUnauthorized(() => {
        clearCsrfToken();
        queryClient.removeQueries({ queryKey: queryKeys.organization });
        queryClient.removeQueries({ queryKey: queryKeys.projects.all });
        queryClient.removeQueries({ queryKey: queryKeys.aois.all });
        queryClient.removeQueries({ queryKey: queryKeys.tasks.all });
        queryClient.removeQueries({ queryKey: queryKeys.results.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.session });
      }),
    [],
  );
  return children;
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider><SessionInvalidationBridge>{children}</SessionInvalidationBridge></ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
