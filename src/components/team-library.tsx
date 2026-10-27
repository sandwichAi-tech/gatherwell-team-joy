import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { myTeamStatesQuery } from '@/lib/team-membership';

const contentText = (value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(contentText) : value && typeof value === 'object' ? Object.values(value).flatMap(contentText) : [];

type Item = { id: string; kind: 'blueprint' | 'resource_template'; title: string; description?: string; description_es?: string; author?: string; shared_teams: string[]; content?: unknown };
export function TeamLibrary({ teamId, userId }: { teamId: string; userId: string }) {
  const { t, i18n } = useTranslation(); const qc = useQueryClient(); const [shareOpen, setShareOpen] = useState(false); const [source, setSource] = useState(''); const [selected, setSelected] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Item | null>(null); const [copied, setCopied] = useState<{ id: string; target: string } | null>(null);
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const teams = useQuery(myTeamStatesQuery(userId));
  const list = useQuery({ queryKey: ['team-library', teamId, userId], gcTime: 0, staleTime: 0, refetchInterval: 10_000, retry: false, queryFn: async () => { const { data, error } = await supabase.rpc('team_library_items', { _team: teamId }); if (error) throw error; return data as unknown as Item[]; } });
  const sources = useQuery({ queryKey: ['library-sources', userId], enabled: shareOpen, queryFn: async () => { const { data, error } = await supabase.rpc('my_library_sources'); if (error) throw error; return data as unknown as Item[]; } });
  const authored = useQuery({ queryKey: ['authored-library', userId], enabled: shareOpen, queryFn: async () => { const { data, error } = await supabase.rpc('my_authored_library_items'); if (error) throw error; return data as unknown as { id: string; kind: string; title: string }[]; } });
  const [exportSource, setExportSource] = useState('');
  useEffect(() => { if (list.isError) { setPreview(null); setShareOpen(false); } }, [list.isError]);
  const destinations = teams.data?.filter(x => x.owner && x.access) ?? [];
  const [destination, setDestination] = useState('');
  const share = async () => {
    const item = sources.data?.find(s => `${s.kind}:${s.id}` === source); if (!item) return;
    setBusy(true); const { error } = await supabase.rpc('share_team_library_item', { _kind: item.kind, _id: item.id, _teams: selected }); setBusy(false);
    if (error) toast.error(t('teamMembership.error')); else { setShareOpen(false); void qc.invalidateQueries({ queryKey: ['team-library'] }); void qc.invalidateQueries({ queryKey: ['library-sources'] }); }
  };
  const copy = async () => {
    if (!preview || !destination) return; const key = requestKey ?? crypto.randomUUID(); setRequestKey(key); setBusy(true);
    const { data, error } = await supabase.rpc('copy_team_library_item', { _team: teamId, _kind: preview.kind, _id: preview.id, _destination: destination, _request: key }); setBusy(false);
    if (error) toast.error(t('teamMembership.error')); else { setCopied(data as { id: string; target: string }); void qc.invalidateQueries({ queryKey: ['templates'] }); void qc.invalidateQueries({ queryKey: ['resources'] }); }
  };
  return <section className="team-library"><div className="section-heading"><h2>{t('teamLibrary.title')}</h2><Button variant="secondary" onClick={() => { setSource(''); setSelected([]); setShareOpen(true); }}>{t('teamLibrary.share')}</Button></div><p className="auth-subtitle">{t('teamLibrary.hint')}</p>
    {list.isPending ? <ListSkeleton /> : list.isError ? <><p role="status">{t('teamCommunication.noAccess')}</p><RetryState retry={() => void list.refetch()} /></> : !list.data.length ? <p className="auth-subtitle">{t('teamLibrary.empty')}</p> : <ul className="team-membership-list">{list.data.map(item => <li key={`${item.kind}:${item.id}`}><strong>{item.title}</strong><small>{t(`teamLibrary.${item.kind}`)} · {item.author}</small><Button variant="secondary" onClick={() => { setPreview(item); setCopied(null); setRequestKey(null); setDestination(destinations[0]?.team_id ?? ''); }}>{t('teamLibrary.view')}</Button></li>)}</ul>}
    <ResponsiveSheet open={shareOpen} onOpenChange={setShareOpen} title={t('teamLibrary.share')} footer={<Button disabled={busy || !source} onClick={() => void share()}>{t('profile.save')}</Button>}>
      {sources.isPending ? <ListSkeleton /> : sources.isError ? <RetryState retry={() => void sources.refetch()} /> : <div className="edit-form"><label className="field-label" htmlFor="library-source">{t('teamLibrary.source')}</label><select id="library-source" className="field-input" value={source} onChange={e => { setSource(e.target.value); setSelected(sources.data.find(s => `${s.kind}:${s.id}` === e.target.value)?.shared_teams ?? []); }}><option value="">{t('teamLibrary.choose')}</option>{sources.data.map(s => <option key={`${s.kind}:${s.id}`} value={`${s.kind}:${s.id}`}>{s.title}</option>)}</select>
        {teams.data?.filter(tm => tm.access).map(tm => <label className="switch-row" key={tm.team_id}><span>{tm.name}</span><Checkbox aria-label={tm.name} checked={selected.includes(tm.team_id)} onCheckedChange={on => setSelected(on ? [...selected, tm.team_id] : selected.filter(id => id !== tm.team_id))} /></label>)}<p className="field-hint">{t('teamLibrary.assets')}</p>
        <label className="field-label" htmlFor="export-source">{t('teamLibrary.exportSource')}</label><select id="export-source" className="field-input" value={exportSource} onChange={e => setExportSource(e.target.value)}><option value="">{t('teamLibrary.choose')}</option>{authored.data?.map(s => <option key={`${s.kind}:${s.id}`} value={`${s.kind}:${s.id}`}>{s.title}</option>)}</select>
        <Button variant="secondary" disabled={busy || !exportSource} onClick={async () => { const item = authored.data?.find(s => `${s.kind}:${s.id}` === exportSource); if (!item) return; setBusy(true); const { data, error } = await supabase.rpc('export_library_source', { _kind: item.kind, _id: item.id }); setBusy(false); if (error) toast.error(t('teamMembership.error')); else { await sources.refetch(); setSource(`${item.kind === 'event' ? 'blueprint' : 'resource_template'}:${data}`); setSelected([]); } }}>{t('teamLibrary.prepare')}</Button>
        </div>}
    </ResponsiveSheet>
    <ResponsiveSheet open={!!preview} onOpenChange={open => !open && setPreview(null)} title={preview?.title ?? t('teamLibrary.view')} footer={!copied && <Button disabled={busy || !destination} onClick={() => void copy()}>{t('teamLibrary.copy')}</Button>}>
      {preview && <div className="edit-form"><p>{i18n.resolvedLanguage === 'es' ? preview.description_es || preview.description : preview.description}</p><div className="library-content">{contentText(preview.content).map((text, i) => <p key={i}>{text}</p>)}</div><p className="field-hint">{t('teamLibrary.assets')}</p>
        {copied ? <><p role="status">{t('teamLibrary.copied')}</p><Button asChild variant="secondary">{copied.target === 'event' ? <Link to="/gathering/$id/edit" params={{ id: copied.id }}>{t('teamLibrary.openDraft')}</Link> : copied.target === 'blueprint' ? <Link to="/blueprints">{t('teamLibrary.openDraft')}</Link> : copied.target === 'track' || copied.target === 'recipe' ? <Link to="/learn/create" search={{ type: copied.target === 'recipe' ? 'recipe' : 'video', id: copied.id }}>{t('teamLibrary.openDraft')}</Link> : <Link to="/offer/$id" params={{ id: copied.id }}>{t('teamLibrary.openDraft')}</Link>}</Button></> : <><label className="field-label" htmlFor="copy-destination">{t('teamLibrary.destination')}</label><select id="copy-destination" className="field-input" value={destination} onChange={e => setDestination(e.target.value)}>{!destinations.length && <option value="">{t('teamLibrary.noWorkspace')}</option>}{destinations.map(tm => <option key={tm.team_id} value={tm.team_id}>{tm.name}</option>)}</select></>}
      </div>}
    </ResponsiveSheet>
  </section>;
}