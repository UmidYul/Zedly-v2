import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";
import { useToastStore } from "../state/toast-store";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Неизвестная ошибка запроса";
}

function notifyQueryError(error: unknown) {
  useToastStore.getState().pushToast({
    type: "error",
    title: "Ошибка запроса",
    message: getErrorMessage(error)
  });
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: notifyQueryError
  }),
  mutationCache: new MutationCache({
    onError: notifyQueryError
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 2,
      refetchOnWindowFocus: false
    }
  }
});
