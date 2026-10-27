import { queryOptions } from '@tanstack/react-query';
import { getPersonalHome } from './personal-home.functions';
import { personalHomeKey } from './personal-home';

export const personalHomeQuery = (userId: string) => queryOptions({
  queryKey: personalHomeKey(userId),
  queryFn: () => getPersonalHome(),
  staleTime: 0,
  gcTime: 0,
  refetchOnWindowFocus: 'always',
  refetchOnMount: 'always',
  refetchInterval: 15_000,
});