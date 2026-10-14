"use client";

import { useQuery, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import { apiQueryKeys } from "./query-keys";

type ApiQueryOptions<TData, TError, TParams> = Omit<UseQueryOptions<TData, TError, TData, readonly unknown[]>, "queryKey" | "queryFn"> & {
  tag: string;
  method: string;
  queryFn: (params: TParams) => Promise<TData>;
  params: TParams;
  queryKey?: readonly unknown[];
};

/** TanStack Query wrapper for GET endpoints. */
export function use_query<TData, TError = Error, TParams = void>({ tag, method, queryFn, params, queryKey, ...options }: ApiQueryOptions<TData, TError, TParams>): UseQueryResult<TData, TError> {
  return useQuery<TData, TError, TData, readonly unknown[]>({
    ...options,
    queryKey: queryKey ?? apiQueryKeys.endpoint(tag, method, params),
    queryFn: () => queryFn(params),
  });
}
