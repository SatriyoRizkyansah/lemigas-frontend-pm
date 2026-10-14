"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

type ApiMutationOptions<TData, TError, TVariables> = {
  tag: string;
  method: string;
  mutationFn: (variables: TVariables) => Promise<TData>;
  invalidateKeys?: readonly (readonly unknown[])[];
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: TError, variables: TVariables) => void;
};

/** TanStack Query wrapper for POST/PUT/PATCH/DELETE endpoints. */
export function use_mutation<TData, TError = Error, TVariables = void>({
  tag,
  method,
  mutationFn,
  invalidateKeys = [["api", tag]],
  onSuccess,
  onError,
}: ApiMutationOptions<TData, TError, TVariables>): UseMutationResult<TData, TError, TVariables> {
  const queryClient = useQueryClient();

  return useMutation<TData, TError, TVariables>({
    mutationKey: ["api", tag, method],
    mutationFn,
    onSuccess: async (data, variables) => {
      await Promise.all(invalidateKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      await onSuccess?.(data, variables);
    },
    onError,
  });
}
