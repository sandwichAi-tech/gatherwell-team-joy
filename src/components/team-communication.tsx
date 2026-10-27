import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Megaphone, MessageCircle, Pencil, Pin, Plus, EyeOff } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { confirmAction } from '@/components/confirm-dialog';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { DiscussionsPanel } from '@/components/conversation';
import { SafeChatText } from '@/components/safe-chat-text';
import { supabase } from '@/integrations/supabase/client';
import { channelKey, orderAnnouncements, safeChatUrl, type Announcement } from '@/lib/team-communication';

type State = { owner: boolean; muted: boolean; announcements_unread: number; chat_unread: number };
export function TeamCommunication({ teamId, me, initialBody }: { teamId: string; me: string; initialBody?: string | null }) {
  const { t, i18n } = useTranslation(); const qc = useQueryClient();
  const search = useSearch({ strict: false }) as { surface?: string; announcement?: string };
  const [surface, setSurface] = useState<'announcements' | 'chat' | null>(search.surface === 'chat' ? 'chat' : search.surface === 'announcements' ? 'announcements' : null);
  const [editor, setEditor] = useState<Announcement | 'new' | null>(null);
  const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [link, setLink] = useState(''); const [pinned, setPinned] = useState(false); const [busy, setBusy] = useState(false);
  const key = channelKey(teamId, me);
  const state = useQuery({ queryKey: key, gcTime: 0, staleTime: 0, refetchInterval: 10_000, retry: false, queryFn: async () => {
    const { data, error } = await supabase.rpc('team_channel_state', { _team: teamId });
    if (error) throw error;
    if (!data) { qc.removeQueries({ queryKey: [...key, 'announcements'] }); qc.removeQueries({ queryKey: ['comments'] }); qc.removeQueries({ queryKey: ['topics', teamId] }); qc.removeQueries({ queryKey: ['notifications'] }); }
    return data as State | null;
  } });
  const list = useQuery({ queryKey: [...key, 'announcements'], enabled: !!state.data, gcTime: 0, staleTime: 0, refetchInterval: 10_000, queryFn: async () => {
    const { data, error } = await supabase.from('announcements').select('id,title,body,link_url,pinned,created_at,updated_at,archived_at,author_id').eq('team_id', teamId);
    if (error) throw error; return orderAnnouncements(data ?? []);
  } });
  const refresh = () => { void qc.invalidateQueries({ queryKey: key }); void qc.invalidateQueries({ queryKey: ['notifications'] }); void qc.invalidateQueries({ queryKey: ['notifications-unread'] }); };
  useEffect(() => { if (search.surface === 'chat' || search.surface === 'announcements') setSurface(search.surface); }, [search.surface]);
  useEffect(() => {
    const ch = supabase.channel(`team-channel-${teamId}-${crypto.randomUUID()}`);
    const check = () => {
      // Hide cached content until authoritative access has been rechecked.
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ['comments'] }); void qc.invalidateQueries({ queryKey: ['topics', teamId] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    };
    for (const table of ['announcements', 'comments', 'discussion_topics', 'team_members'] as const) ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `team_id=eq.${teamId}` }, check);
    ch.subscribe(); window.addEventListener('online', check); window.addEventListener('focus', check);
    return () => { void supabase.removeChannel(ch); window.removeEventListener('online', check); window.removeEventListener('focus', check); qc.removeQueries({ queryKey: key }); qc.removeQueries({ queryKey: ['comments'] }); qc.removeQueries({ queryKey: ['topics', teamId] }); };
  }, [teamId, me, qc]);
  useEffect(() => {
    if (!state.isFetching && !state.data) { qc.removeQueries({ queryKey: [...key, 'announcements'] }); qc.removeQueries({ queryKey: ['comments'] }); qc.removeQueries({ queryKey: ['topics', teamId] }); }
  }, [state.data, state.isFetching, qc, teamId, me]);
  useEffect(() => {
    if (surface === 'announcements' && state.data && list.data) void supabase.rpc('set_team_channel_preference', { _team: teamId, _read_announcements: true }).then(({ error }) => { if (!error) void qc.invalidateQueries({ queryKey: key }); });
  }, [surface, list.dataUpdatedAt]);
  useEffect(() => { if (search.announcement && list.data) document.getElementById(`announcement-${search.announcement}`)?.scrollIntoView({ block: 'center' }); }, [search.announcement, list.dataUpdatedAt]);
  useEffect(() => { if (initialBody && state.data?.owner) { setEditor('new'); setBody(initialBody); } }, [initialBody, state.data?.owner]);
  const edit = (item: Announcement | 'new') => { setEditor(item); setTitle(item === 'new' ? '' : item.title); setBody(item === 'new' ? '' : item.body); setLink(item === 'new' ? '' : item.link_url ?? ''); setPinned(item === 'new' ? false : item.pinned); };
  const save = async (item?: Announcement, archive?: boolean) => {
    setBusy(true);
    const id = item?.id ?? (editor && editor !== 'new' ? editor.id : null);
    const args = { _team: teamId, _title: item?.title ?? title, _body: item?.body ?? body, _link: item?.link_url ?? link, _pinned: item?.pinned ?? pinned };
    const { error } = id ? await supabase.rpc('save_team_announcement', { ...args, _id: id, _archived: archive ?? false }) : await supabase.rpc('create_team_announcement', args);
    setBusy(false); if (error) { toast.error(t('teamCommunication.saveError')); return; }
    setEditor(null); refresh();
  };
  if (state.isPending) return <ListSkeleton />;
  if (state.isError) return <RetryState retry={() => void state.refetch()} />;
  if (!state.data) return <section className="team-communication" role="status"><p>{t(state.isFetching ? 'teamCommunication.checking' : 'teamCommunication.noAccess')}</p></section>;
  const owner = state.data.owner;
  const active = list.data?.filter(a => !a.archived_at) ?? [];
  return <section className="team-communication" aria-label={t('teamCommunication.title')}>
    <div className="team-channel-entry">
      <Button variant={surface === 'announcements' ? 'default' : 'secondary'} aria-pressed={surface === 'announcements'} onClick={() => setSurface('announcements')}><Megaphone />{t('teamCommunication.announcements')}<span className="tabular-nums">{state.data.announcements_unread || ''}</span></Button>
      <Button variant={surface === 'chat' ? 'default' : 'secondary'} aria-pressed={surface === 'chat'} onClick={() => setSurface('chat')}><MessageCircle />{t('teamCommunication.chat')}<span className="tabular-nums">{state.data.chat_unread || ''}</span></Button>
    </div>
    <label className="switch-row"><span><strong>{t('teamCommunication.mute')}</strong><small>{t('teamCommunication.muteHint')}</small></span><Switch checked={state.data.muted} aria-label={t('teamCommunication.mute')} onCheckedChange={async muted => { const { error } = await supabase.rpc('set_team_channel_preference', { _team: teamId, _muted: muted }); if (error) toast.error(t('teamCommunication.saveError')); else refresh(); }} /></label>
    {state.data.muted && <p className="field-hint">{t('teamCommunication.muted')}</p>}
    {(surface === 'announcements' || surface === null) && <div>
      <div className="section-heading"><div><h2>{t('teamCommunication.announcements')}</h2><p>{t('teamCommunication.announcementHint')}</p></div>{state.data.owner && <Button variant="secondary" onClick={() => edit('new')} aria-label={t('teamCommunication.new')}><Plus /><span>{t('teamCommunication.new')}</span></Button>}</div>
      {list.isPending ? <ListSkeleton /> : list.isError ? <RetryState retry={() => void list.refetch()} /> : !active.length ? <p className="auth-subtitle">{t('teamCommunication.empty')}</p> : <ul className="team-announcements">{active.map(a => <li key={a.id} id={`announcement-${a.id}`} className={a.pinned ? 'is-pinned' : ''}>
        {a.pinned && <span className="chip"><Pin />{t('conversation.pinned')}</span>}
        {a.title && <h3>{a.title}</h3>}<p className="convo-body"><SafeChatText body={a.body} /></p>
        {a.link_url && safeChatUrl(a.link_url) && <a className="auth-link" href={a.link_url} target="_blank" rel="noopener noreferrer">{t('teamCommunication.openLink')}</a>}
        <time dateTime={a.created_at}>{new Date(a.created_at).toLocaleString(i18n.resolvedLanguage === 'es' ? 'es-419' : 'en-US')}</time>{a.updated_at && <small>{t('teamCommunication.edited')}</small>}
        {owner && <div className="team-announcement-actions"><Button variant="ghost" size="icon" title={t('profile.edit')} aria-label={t('profile.edit')} onClick={() => edit(a)}><Pencil /></Button><Button variant="ghost" size="icon" title={t(a.pinned ? 'conversation.unpin' : 'conversation.pin')} aria-label={t(a.pinned ? 'conversation.unpin' : 'conversation.pin')} onClick={() => void save({ ...a, pinned: !a.pinned })}><Pin /></Button><Button variant="ghost" size="icon" title={t('teamCommunication.archive')} aria-label={t('teamCommunication.archive')} onClick={async () => { if (await confirmAction({ title: t('teamCommunication.archiveConfirm'), destructive: true })) void save(a, true); }}><EyeOff /></Button></div>}
      </li>)}</ul>}
      {state.data.owner && list.data?.some(a => a.archived_at) && <details><summary>{t('teamCommunication.archived')}</summary>{list.data.filter(a => a.archived_at).map(a => <div key={a.id} className="team-archived"><p>{a.title || a.body}</p><Button variant="secondary" onClick={() => void save(a, false)}>{t('teamCommunication.restore')}</Button></div>)}</details>}
    </div>}
    {surface === 'chat' && <><p className="auth-subtitle">{t('teamCommunication.chatHint')}</p><DiscussionsPanel teamId={teamId} isLeader={state.data.owner} me={me} /></>}
    <ResponsiveSheet open={!!editor} onOpenChange={open => !open && setEditor(null)} title={t('teamCommunication.new')} footer={<Button disabled={busy || !title.trim() || !body.trim() || (!!link && (!safeChatUrl(link) || !link.startsWith('https://')))} onClick={() => void save()}>{t('profile.save')}</Button>}>
      <div className="edit-form"><label className="field-label" htmlFor="announcement-title">{t('teamCommunication.subject')}</label><Input id="announcement-title" value={title} maxLength={120} onChange={e => setTitle(e.target.value)} />
        <label className="field-label" htmlFor="announcement-body">{t('teamSpace.message')}</label><Textarea id="announcement-body" rows={5} maxLength={2000} value={body} onChange={e => setBody(e.target.value)} />
        <label className="field-label" htmlFor="announcement-link">{t('teamCommunication.link')}</label><Input id="announcement-link" inputMode="url" value={link} onChange={e => setLink(e.target.value)} placeholder="https://" />
        {!!link && (!safeChatUrl(link) || !link.startsWith('https://')) && <p className="field-error" role="alert">{t('teamCommunication.badLink')}</p>}
        <label className="switch-row"><span>{t('teamSpace.pinThis')}</span><Switch checked={pinned} onCheckedChange={setPinned} /></label>
      </div>
    </ResponsiveSheet>
  </section>;
}