import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { GwIcon } from '@/components/gw-icon';
import { EmptyState, ListSkeleton, RetryState } from '@/components/launch-states';
import { confirmAction } from '@/components/confirm-dialog';
import { profileQuery } from '@/lib/account';
import { CopyButton } from '@/components/copy-button';
import { normalizeProfileSlug, validateProfileSlug, slugErrorKey } from '@/lib/host-slug';

export type HostLink = { label: string; url: string; kind: 'website' | 'social' };

export type HostProfileForm = {
  org: string;
  categories: string[];
  languages: string[];
  accessibility: string;
  links: HostLink[];
  host_public: boolean;
  city_public: boolean;
};

type HostProfileRow = {
  slug: string | null;
  full_name: string | null;
  bio: string | null;
  city: string | null;
  avatar_url: string | null;
  host_org: string | null;
  host_categories: string[] | null;
  host_languages: string[] | null;
  host_accessibility: string | null;
  host_links: unknown;
  host_public: boolean;
  city_public: boolean;
};

const hostProfileQuery = (userId: string) => ({
  queryKey: ['host-profile', userId],
  queryFn: async () => {
    const { data, error } = await supabase.from('profiles')
      .select('slug, full_name, bio, city, avatar_url, host_org, host_categories, host_languages, host_accessibility, host_links, host_public, city_public')
      .eq('id', userId).single();
    if (error) throw error;
    return data as unknown as HostProfileRow;
  },
});

const SOCIAL_HOSTS = ['instagram.com', 'facebook.com', 'youtube.com', 'tiktok.com', 'linkedin.com', 'x.com', 'twitter.com', 'linktr.ee'];

/** Client-side mirror of the server allowlist; the RPC is authoritative. */
export function validHostLink(link: HostLink): boolean {
  if (!/^https:\/\/[^\s/]+\.[^\s]+$/i.test(link.url) || link.url.length > 300) return false;
  if (link.label.length > 40) return false;
  if (link.kind !== 'social') return true;
  const host = link.url.replace(/^https:\/\//i, '').split('/')[0]?.toLowerCase() ?? '';
  return SOCIAL_HOSTS.some(d => host === d || host === `www.${d}`);
}

/** Truthful readiness: which public-profile basics are filled in. */
export function hostProfileReadiness(p: Pick<HostProfileRow, 'full_name' | 'bio' | 'avatar_url' | 'host_categories' | 'host_languages'>): { key: string; done: boolean }[] {
  return [
    { key: 'name', done: !!p.full_name?.trim() },
    { key: 'bio', done: !!p.bio?.trim() },
    { key: 'photo', done: !!p.avatar_url },
    { key: 'categories', done: !!p.host_categories?.length },
    { key: 'languages', done: !!p.host_languages?.length },
  ];
}

export function HostProfilePanel({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery(hostProfileQuery(userId));
  const [form, setForm] = useState<HostProfileForm | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!q.data || form) return;
    const d = q.data;
    setForm({
      org: d.host_org ?? '',
      categories: d.host_categories ?? [],
      languages: d.host_languages ?? [],
      accessibility: d.host_accessibility ?? '',
      links: (Array.isArray(d.host_links) ? d.host_links : []) as HostLink[],
      host_public: d.host_public,
      city_public: d.city_public,
    });
  }, [q.data, form]);

  if (q.isLoading) return <ListSkeleton rows={3} />;
  if (q.isError || !q.data || !form) return <RetryState retry={() => void q.refetch()} />;
  const d = q.data;
  const readiness = hostProfileReadiness(d);

  const save = async () => {
    if (form.links.some(l => !validHostLink(l))) { toast.error(t('hostProfile.linkInvalid')); return; }
    setBusy(true);
    const { error } = await supabase.rpc('save_host_profile', {
      _org: form.org.trim() || null,
      _categories: form.categories.map(c => c.trim()).filter(Boolean),
      _languages: form.languages,
      _accessibility: form.accessibility.trim() || null,
      _links: form.links.filter(l => l.url.trim()),
      _host_public: form.host_public,
      _city_public: form.city_public,
    } as never);
    setBusy(false);
    if (error) { toast.error(t(/link_not_allowed|invalid_link/.test(error.message) ? 'hostProfile.linkInvalid' : 'error.message')); return; }
    toast.success(t('profile.saved'));
    void qc.invalidateQueries({ queryKey: ['host-profile', userId] });
    void qc.invalidateQueries({ queryKey: ['profile', userId] });
    void qc.invalidateQueries({ queryKey: ['public-follow-page', 'host'] });
  };

  const setLink = (i: number, patch: Partial<HostLink>) => setForm({ ...form, links: form.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  return <div className="edit-form host-profile-form">
    <p className="auth-subtitle">{t('hostProfile.intro')}</p>

    <div className="switch-row">
      <div><strong>{t('hostProfile.published')}</strong><small>{t('hostProfile.publishedHint')}</small></div>
      <Switch checked={form.host_public} onCheckedChange={v => setForm({ ...form, host_public: v })} aria-label={t('hostProfile.published')} />
    </div>

    <ul className="readiness-list" aria-label={t('hostProfile.readiness')}>
      {readiness.map(r => <li key={r.key} className={r.done ? 'is-done' : ''}><GwIcon name={r.done ? 'CheckCircle2' : 'Circle'} />{t(`hostProfile.ready.${r.key}`)}</li>)}
    </ul>

    <div className="form-field">
      <Label htmlFor="hp-org">{t('hostProfile.org')}</Label>
      <Input id="hp-org" maxLength={120} value={form.org} onChange={e => setForm({ ...form, org: e.target.value })} placeholder={t('hostProfile.orgPlaceholder')} />
    </div>
    <div className="form-field">
      <Label htmlFor="hp-cats">{t('hostProfile.categories')}</Label>
      <Input id="hp-cats" value={form.categories.join(', ')} onChange={e => setForm({ ...form, categories: e.target.value.split(',').map(c => c.trim()).filter(Boolean).slice(0, 8) })} placeholder={t('hostProfile.categoriesPlaceholder')} />
      <small className="field-hint">{t('hostProfile.categoriesHint')}</small>
    </div>
    <fieldset className="edit-section"><legend>{t('hostProfile.languages')}</legend>
      <div className="choice-pair">{(['en', 'es'] as const).map(lang => <button key={lang} type="button" className={`choice-card ${form.languages.includes(lang) ? 'is-selected' : ''}`} aria-pressed={form.languages.includes(lang)}
        onClick={() => setForm({ ...form, languages: form.languages.includes(lang) ? form.languages.filter(l => l !== lang) : [...form.languages, lang] })}><strong>{t(lang === 'en' ? 'me.english' : 'me.spanish')}</strong></button>)}</div>
    </fieldset>
    <div className="form-field">
      <Label htmlFor="hp-access">{t('hostProfile.accessibility')}</Label>
      <Textarea id="hp-access" rows={3} maxLength={500} value={form.accessibility} onChange={e => setForm({ ...form, accessibility: e.target.value })} placeholder={t('hostProfile.accessibilityPlaceholder')} />
    </div>
    <div className="switch-row">
      <div><strong>{t('hostProfile.cityPublic')}</strong><small>{t('hostProfile.cityPublicHint')}</small></div>
      <Switch checked={form.city_public} onCheckedChange={v => setForm({ ...form, city_public: v })} aria-label={t('hostProfile.cityPublic')} />
    </div>

    <fieldset className="edit-section"><legend>{t('hostProfile.links')}</legend>
      {form.links.map((link, i) => <div key={i} className="host-link-row">
        <Input aria-label={t('hostProfile.linkLabel')} maxLength={40} value={link.label} onChange={e => setLink(i, { label: e.target.value })} placeholder={t('hostProfile.linkLabel')} />
        <Input aria-label={t('hostProfile.linkUrl')} inputMode="url" maxLength={300} value={link.url} onChange={e => setLink(i, { url: e.target.value })} placeholder="https://" />
        <div className="choice-pair">
          {(['website', 'social'] as const).map(kind => <button key={kind} type="button" className={`choice-card ${link.kind === kind ? 'is-selected' : ''}`} aria-pressed={link.kind === kind} onClick={() => setLink(i, { kind })}><strong>{t(`hostProfile.linkKind.${kind}`)}</strong></button>)}
        </div>
        <Button variant="ghost" size="icon" aria-label={t('hostProfile.removeLink')} onClick={() => setForm({ ...form, links: form.links.filter((_, j) => j !== i) })}><GwIcon name="Trash2" /></Button>
      </div>)}
      {form.links.length < 6 && <Button variant="secondary" onClick={() => setForm({ ...form, links: [...form.links, { label: '', url: '', kind: 'website' }] })}><GwIcon name="Plus" />{t('hostProfile.addLink')}</Button>}
      <small className="field-hint">{t('hostProfile.linksHint')}</small>
    </fieldset>

    <div className="form-actions">
      <Button className="sheet-primary" disabled={busy} onClick={() => void save()}>{busy ? t('onboarding.saving') : t('common.save')}</Button>
      {d.slug && <Button asChild variant="secondary"><Link to="/h/$slug" params={{ slug: d.slug }} target="_blank"><GwIcon name="Eye" />{t('hostProfile.preview')}</Link></Button>}
    </div>
  </div>;
}

/** Signed-in Following list — only still-public targets, aggregate counts only. */
export function FollowingPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['my-following'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_following');
      if (error) throw error;
      return (data ?? []) as unknown as { kind: 'host' | 'team' | 'location'; id: string; name: string; slug: string | null; avatar_url: string | null; followers: number }[];
    },
  });
  const unfollow = async (kind: string, id: string) => {
    if (!(await confirmAction({ title: t('follow.unfollowTitle'), confirmLabel: t('follow.unfollow') }))) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from('follows').delete().eq('target_kind', kind).eq('target_id', id).eq('follower_id', u.user.id);
    void qc.invalidateQueries({ queryKey: ['my-following'] });
  };
  if (q.isLoading) return <ListSkeleton />;
  if (q.isError) return <RetryState retry={() => void q.refetch()} />;
  const items = q.data ?? [];
  return <div className="following-page">
    <h1 className="page-title">{t('following.title')}</h1>
    {items.length === 0
      ? <EmptyState icon="BellRing" title={t('following.emptyTitle')} text={t('following.empty')} action={<Button asChild><Link to="/discover">{t('follow.discover')}</Link></Button>} />
      : <ul className="follow-list">{items.map(f => {
        const to = f.kind === 'host' ? '/h/$slug' : f.kind === 'team' ? '/t/$slug' : '/l/$slug';
        return <li key={`${f.kind}:${f.id}`} className="following-row">
          <Link to={to} params={{ slug: f.slug ?? '' }} className="follow-event">
            <span><strong>{f.name}</strong><small>{t('follow.followers', { count: f.followers })}</small></span>
            <GwIcon name="ChevronRight" />
          </Link>
          <Button variant="ghost" size="icon" aria-label={t('follow.unfollow')} onClick={() => void unfollow(f.kind, f.id)}><GwIcon name="BellRing" /></Button>
        </li>;
      })}</ul>}
  </div>;
}
