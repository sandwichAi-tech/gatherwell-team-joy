import { queryOptions } from '@tanstack/react-query';
import { getDailyBrief } from '@/lib/smart.functions';

export const dailyBriefQuery = (userId: string, lang: 'en' | 'es' = 'en') => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';
  const day = new Intl.DateTimeFormat('en-CA').format(new Date());
  return queryOptions({
    queryKey: ['daily-brief-personal', userId, day, tz, lang],
    queryFn: () => getDailyBrief({ data: { lang, tz } }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
};