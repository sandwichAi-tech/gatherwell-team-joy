import { queryOptions } from '@tanstack/react-query';
import { getDailyBrief } from '@/lib/smart.functions';

export const dailyBriefQuery = (userId: string, lang: 'en' | 'es' = 'en') => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';
  const day = new Intl.DateTimeFormat('en-CA').format(new Date());
  return queryOptions({
    queryKey: ['daily-brief-personal', userId, day, tz, lang],
    queryFn: async ({ signal }) => {
      const brief = await getDailyBrief({ data: { lang, tz } });
      if (signal.aborted || brief.caller_id !== userId) throw new Error('personal_brief_identity_changed');
      return brief;
    },
    staleTime: 0,
    refetchOnWindowFocus: 'always',
    refetchOnMount: 'always',
    refetchInterval: 15_000,
  });
};