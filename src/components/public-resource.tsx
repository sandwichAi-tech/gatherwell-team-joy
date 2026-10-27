import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { publicResourcePage, myResourcePage } from '@/lib/resource-page.functions';
import { Button } from '@/components/ui/button';
import { GuestShell } from '@/components/guest-shell';
import { BrandImage } from '@/components/brand-image';
import { DocumentViewer } from '@/components/document-viewer';
import { ListSkeleton, RetryState, EmptyState } from '@/components/launch-states';
import { embedUrl, listOf, pick } from '@/lib/learn';
import { formatMoney } from '@/lib/billing';

export function PublicResource({ kind, id }: { kind: 'track' | 'recipe' | 'quiz' | 'offer'; id: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const [user, setUser] = useState<string | null>(null);
  useEffect(() => { void supabase.auth.getUser().then(r => setUser(r.data.user?.id ?? null)); }, []);
  const q = useQuery({ queryKey: ['resource-page', kind, id, user], queryFn: () => user ? myResourcePage({ data: { kind, id } }) : publicResourcePage({ data: { kind, id } }), staleTime: 0 });
  if (q.isPending) return <GuestShell><ListSkeleton /></GuestShell>;
  if (q.isError) return <GuestShell><RetryState retry={() => void q.refetch()} /></GuestShell>;
  const r = q.data;
  if (!r) return <GuestShell><EmptyState icon="BookOpen" text={t('resources.item.notFound')} /></GuestShell>;
  const title = pick(lang, r['title_en'], r['title_es']);
  const labelType = r['type'] === 'pdf' ? 'guide' : r['type'] === 'download' ? 'file' : r['type'];
  return <GuestShell><article className="offer-page">
    {r.coverUrl && <BrandImage src={r.coverUrl} alt={title} className="offer-cover-photo" />}
    <section className="offer-body px-4 py-6"><span className="chip">{t(`resources.create.types.${labelType}.name`, { defaultValue: t('resources.title') })}</span>
      <h1>{title}</h1><p className="muted-small">{t('offers.by', { name: r['host_name'] ?? '' })}</p>
      <p className="offer-price">{r['course_access'] || r['placement'] === 'course' ? t('resourcePlacement.courseAccess') : r['price_cents'] ? formatMoney(r['price_cents'], lang) : t('offers.free')}</p>
      {!r['access'] ? <>
        <p role="status">{t(r['price_cents'] ? 'content.paidSetupRequired' : 'resourcePlacement.notAvailable')}</p>
        {r['parent_course_id'] && <Button asChild><Link to="/o/$id" params={{ id: r['parent_course_id'] }}>{t('resourcePlacement.pickCourse')}</Link></Button>}
        {r['price_cents'] > 0 && r['offer_id'] && <Button asChild variant="secondary"><Link to="/o/$id" params={{ id: r['offer_id'] }}>{t('resources.item.ctaBuy')}</Link></Button>}
      </> : <>
        {kind === 'quiz' && <Button asChild><Link to={user ? '/learn/quiz/$id' : '/login'} params={user ? { id } : {}}>{t(user ? 'resourcePlacement.open' : 'resourcePlacement.signQuiz')}</Link></Button>}
        {kind === 'recipe' && <div className="recipe-columns"><section><h2>{t('learnHub.ingredients')}</h2><ul>{listOf(r['ingredients'], lang).map((x, i) => <li key={i}>{x}</li>)}</ul></section><section><h2>{t('learnHub.steps')}</h2><ol>{listOf(r['steps'], lang).map((x, i) => <li key={i}>{x}</li>)}</ol></section></div>}
        {r.content.map((l: any) => { const url = l.fileUrl || l.url || l.replay_url; const embed = embedUrl(url); return <section key={l.id} className="learn-section"><h2>{pick(lang, l.title_en, l.title_es)}</h2>
          {l.type === 'pdf' && url ? <DocumentViewer src={url} title={title} /> : l.type === 'audio' && l.fileUrl ? <audio src={url} controls preload="metadata" /> : l.type === 'video' && embed ? <div className="player"><iframe src={embed} title={title} allowFullScreen /></div> : l.type === 'video' && l.fileUrl ? <div className="player"><video src={url} controls playsInline preload="metadata" /></div> : url ? <Button asChild variant="secondary"><a href={url} target="_blank" rel="noopener noreferrer">{t('learnHub.openLink')}</a></Button> : <p>{pick(lang, l.description_en, l.description_es) || t('learnHub.noMedia')}</p>}
        </section>; })}
        {kind === 'offer' && r.fileUrl && <Button asChild><a href={r.fileUrl} target="_blank" rel="noopener noreferrer">{t('offers.download')}</a></Button>}
      </>}
    </section>
  </article></GuestShell>;
}