import { queryOptions } from '@tanstack/react-query';
import { getPersonalHome } from './personal-home.functions';
import { personalHomeKey } from './personal-home';

export const personalHomeQuery = (userId: string) => queryOptions({
  queryKey: personalHomeKey(userId),
  queryFn: () => getPersonalHome(),
  staleTime: 0,
  // Retain loader data until suspense subscribers mount; zero GC causes a fetch/remount loop.
  gcTime: 60_000,
  refetchOnWindowFocus: 'always',
  refetchOnMount: 'always',
  refetchInterval: 15_000,
});