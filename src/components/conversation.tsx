import { SafeChatText } from '@/components/safe-chat-text';
import { useRef } from 'react';
import { EmptyState } from '@/components/launch-states';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { confirmAction } from '@/components/confirm-dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AtSign, Eye, EyeOff, Heart, MessageCircle, PartyPopper, Pin, Plus, Reply, Send, ThumbsUp, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { ReportButton } from '@/components/report-button';
import { supabase } from '@/integrations/supabase/client';
import { initialsOf } from '@/lib/account';
import { rosterQuery } from '@/lib/team';
import { GwFeatureTile, GwIcon, type GwIconProps } from '@/components/gw-icon';
import { CHAT_LABEL, detectChatPlatform, type ChatLink, type ChatPlatform } from '@/lib/chat-links';

const db = supabase as any;
const KINDS = [['heart', Heart], ['clap', ThumbsUp], ['highfive', PartyPopper]] as const;
type Item = { id: string; parent_id: string | null; author_id: string; name: string | null; body: string; pinned: boolean; hidden: boolean; created_at: string; reactions: Record<string, number>; mine: string[] };
type Feed = { can_moderate: boolean; items: Item[] } | null;

export function errorKey(e: unknown) {
  const m = String((e as { message?: string })?.message ?? '');
  for (const k of ['blocked_claim', 'rate_limited', 'not_allowed', 'invalid_title']) if (m.includes(k)) return `conversation.errors.${k}`;
  return 'profile.saveError';
}

function useFeed(eventId: string | null, topicId: string | null) {
  const qc = useQueryClient(); const key = ['comments', eventId ?? topicId];
  const q = useQuery({ queryKey: key, gcTime: 0, staleTime: 0, refetchInterval: 10_000, queryFn: async (): Promise<Feed> => { const { data, error } = await db.rpc('comment_feed', { _event: eventId, _topic: topicId }); if (error) throw error; return data; } });
  useEffect(() => {
    const filter = eventId ? `event_id=eq.${eventId}` : `topic_id=eq.${topicId}`;
    const ch = supabase.channel(`comments-${eventId ?? topicId}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter }, () => void qc.invalidateQueries({ queryKey: key }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_reactions' }, () => void qc.invalidateQueries({ queryKey: key }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, topicId]);
  return q;
}

function Composer({ teamId, eventId, topicId, parentId, onDone, autoFocus }: { teamId: string; eventId: string | null; topicId: string | null; parentId?: string; onDone?: () => void; autoFocus?: boolean }) {
  const { t } = useTranslation(); const qc = useQueryClient();
  const request = useRef(crypto.randomUUID());
  const [body, setBody] = useState(''); const [mentions, setMentions] = useState<{ id: string; name: string }[]>([]); const [picking, setPicking] = useState(false); const [busy, setBusy] = useState(false);
  const { data: roster = [] } = useQuery({ ...rosterQuery(teamId), enabled: picking });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); const text = body.trim(); if (!text) return;
    setBusy(true);
    const ids = mentions.filter(m => text.includes(`@${m.name}`)).map(m => m.id);
    const { error } = topicId ? await db.rpc('post_team_comment', { _topic: topicId, _parent: parentId ?? null, _body: text, _request: request.current }) : await db.rpc('post_comment', { _event: eventId, _topic: topicId, _parent: parentId ?? null, _body: text, _mentions: ids });
    setBusy(false);
    if (error) { toast.error(t(errorKey(error))); return; }
    request.current = crypto.randomUUID(); setBody(''); setMentions([]); void qc.invalidateQueries({ queryKey: ['comments', eventId ?? topicId] }); onDone?.();
  };
  return <form className="convo-composer" onSubmit={submit}>
    <label className="sr-only" htmlFor={`c-${parentId ?? 'root'}`}>{parentId ? t('conversation.reply') : t('conversation.write')}</label>
    <Textarea id={`c-${parentId ?? 'root'}`} autoFocus={autoFocus} rows={parentId ? 2 : 3} maxLength={2000} value={body} placeholder={parentId ? t('conversation.replyPlaceholder') : t('conversation.placeholder')} onChange={e => { request.current = crypto.randomUUID(); setBody(e.target.value); }} />
    <div className="convo-composer-actions">
      <Button type="button" variant="ghost" size="icon" aria-label={t('conversation.mention')} onClick={() => setPicking(true)}><AtSign /></Button>
      <Button type="submit" disabled={busy || !body.trim()}><Send />{parentId ? t('conversation.sendReply') : t('conversation.post')}</Button>
    </div>
    <ResponsiveSheet open={picking} onOpenChange={setPicking} title={t('conversation.mention')}>
      <ul className="convo-mention-list">{roster.filter(m => m.name).map(m => <li key={m.userId}><button type="button" className="settings-row" onClick={() => {
        setBody(b => `${b}${b && !b.endsWith(' ') ? ' ' : ''}@${m.name} `); setMentions(ms => [...ms, { id: m.userId, name: m.name! }]); setPicking(false);
      }}><span className="initial-avatar">{initialsOf(m.name)}</span><span className="settings-label">{m.name}</span></button></li>)}</ul>
    </ResponsiveSheet>
  </form>;
}

function CommentRow({ c, replies, feed, me, teamId, eventId, topicId, lang }: { c: Item; replies: Item[]; feed: NonNullable<Feed>; me: string; teamId: string; eventId: string | null; topicId: string | null; lang: string }) {
  const { t } = useTranslation(); const qc = useQueryClient(); const [replying, setReplying] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['comments', eventId ?? topicId] });
  const act = async (fn: string, args: Record<string, unknown>, ok?: string) => { const { error } = await db.rpc(fn, args); if (error) { toast.error(t(errorKey(error))); return; } if (ok) toast.success(t(ok)); void refresh(); };
  const Body = ({ x, child }: { x: Item; child?: boolean }) => <div className={`convo-item ${child ? 'is-reply' : ''} ${x.hidden ? 'is-hidden' : ''}`}>
    <span className="initial-avatar" aria-hidden="true">{initialsOf(x.name)}</span>
    <div className="convo-main">
      <div className="convo-meta"><strong>{x.name ?? t('teamSpace.someone')}</strong>
        <time dateTime={x.created_at}>{new Date(x.created_at).toLocaleString(lang, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
        {x.pinned && <span className="chip"><Pin className="inline-icon" />{t('conversation.pinned')}</span>}
        {x.hidden && <span className="chip">{t('conversation.hiddenChip')}</span>}</div>
      <p className="convo-body"><SafeChatText body={x.body} /></p>
      <div className="convo-actions">
        {KINDS.map(([k, Icon]) => <button key={k} type="button" className={`convo-react ${x.mine.includes(k) ? 'is-mine' : ''}`} aria-pressed={x.mine.includes(k)} aria-label={t(`conversation.reactions.${k}`)} onClick={() => act('toggle_comment_reaction', { _id: x.id, _kind: k })}><Icon />{x.reactions[k] ? <span className="tabular-nums">{x.reactions[k]}</span> : null}</button>)}
        {!child && <button type="button" className="convo-react" onClick={() => setReplying(r => !r)}><Reply />{t('conversation.reply')}</button>}
        {feed.can_moderate && !child && <button type="button" className="convo-react" aria-label={x.pinned ? t('conversation.unpin') : t('conversation.pin')} onClick={() => act('moderate_comment', { _id: x.id, _pinned: !x.pinned, _hidden: null })}><Pin /></button>}
        {feed.can_moderate && <button type="button" className="convo-react" aria-label={x.hidden ? t('conversation.unhide') : t('conversation.hide')} onClick={() => act('moderate_comment', { _id: x.id, _pinned: null, _hidden: !x.hidden }, x.hidden ? 'conversation.shown' : 'conversation.hidden')}>{x.hidden ? <Eye /> : <EyeOff />}</button>}
        {(x.author_id === me || feed.can_moderate) && <button type="button" className="convo-react" aria-label={t('conversation.delete')} onClick={async () => { if (await confirmAction({ title: t('conversation.deleteConfirm'), destructive: true })) void act('delete_comment', { _id: x.id }, 'conversation.deleted'); }}><Trash2 /></button>}
        {x.author_id !== me && <ReportButton type="comment" id={x.id} className="convo-react" />}
      </div>
    </div>
  </div>;
  return <li className="convo-thread">
    <Body x={c} />
    {replies.length > 0 && <ul className="convo-replies">{replies.map(r => <li key={r.id}><Body x={r} child /></li>)}</ul>}
    {replying && <div className="convo-replies"><Composer teamId={teamId} eventId={eventId} topicId={topicId} parentId={c.id} autoFocus onDone={() => setReplying(false)} /></div>}
  </li>;
}

export function CommentThread({ teamId, eventId = null, topicId = null, me, title }: { teamId: string; eventId?: string | null; topicId?: string | null; me: string; title?: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage === 'es' ? 'es-419' : 'en-US';
  const { data: feed, isLoading, isError, refetch } = useFeed(eventId, topicId);
  const { roots, byParent } = useMemo(() => {
    const items = feed?.items ?? []; const byParent = new Map<string, Item[]>();
    items.forEach(i => { if (i.parent_id) byParent.set(i.parent_id, [...(byParent.get(i.parent_id) ?? []), i]); });
    const roots = items.filter(i => !i.parent_id).sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.created_at.localeCompare(b.created_at));
    return { roots, byParent };
  }, [feed]);
  if (isLoading) return <div className="skeleton-list" aria-busy="true"><div className="skeleton-row" /><div className="skeleton-row" /></div>;
  if (isError) return <div role="alert"><p>{t('teamCommunication.saveError')}</p><Button variant="secondary" onClick={() => void refetch()}>{t('error.retry')}</Button></div>;
  if (!feed) return <p className="auth-subtitle">{t(eventId ? 'conversation.rsvpToJoin' : 'teamCommunication.noAccess')}</p>;
  return <div className="convo">
    {title && <h2>{title}</h2>}
    {roots.length === 0 ? <EmptyState compact icon="MessageCircle" text={t('conversation.empty')} /> :
      <ul className="convo-list">{roots.map(c => <CommentRow key={c.id} c={c} replies={byParent.get(c.id) ?? []} feed={feed} me={me} teamId={teamId} eventId={eventId} topicId={topicId} lang={lang} />)}</ul>}
    <Composer teamId={teamId} eventId={eventId} topicId={topicId} />
  </div>;
}

export function EventComments({ eventId, teamId, me }: { eventId: string; teamId: string; me: string }) {
  const { t } = useTranslation();
  return <section className="panel" aria-labelledby="convo-title"><h2 id="convo-title"><MessageCircle className="inline-icon" />{t('conversation.comments')}</h2><CommentThread eventId={eventId} teamId={teamId} me={me} /></section>;
}

type Topic = { id: string; title: string; pinned: boolean; last_post_at: string; posts: number; unread: boolean };

export function DiscussionsPanel({ teamId, isLeader, me }: { teamId: string; isLeader: boolean; me: string }) {
  const { t, i18n } = useTranslation(); const qc = useQueryClient(); const lang = i18n.resolvedLanguage === 'es' ? 'es-419' : 'en-US';
  const key = ['topics', teamId];
  const { data: topics = [], isLoading, isError, refetch } = useQuery({ queryKey: key, gcTime: 0, staleTime: 0, refetchInterval: 10_000, queryFn: async (): Promise<Topic[]> => { const { data, error } = await db.rpc('team_topics', { _team: teamId }); if (error) throw error; return data ?? []; } });
  const [open, setOpen] = useState<string | null>(null); const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [busy, setBusy] = useState(false);
  // Deep links (/team?topic=<id>) from notifications and push open the matching discussion.
  const search = useSearch({ strict: false }) as { topic?: string }; const navigate = useNavigate();
  useEffect(() => { if (search.topic) setOpen(search.topic); }, [search.topic]);
  const close = () => { setOpen(null); if (search.topic) void navigate({ to: '.', search: (s: Record<string, unknown>) => ({ ...s, topic: undefined }) as never, replace: true }); };
  useEffect(() => {
    const ch = supabase.channel(`topics-${teamId}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discussion_topics', filter: `team_id=eq.${teamId}` }, () => void qc.invalidateQueries({ queryKey: key }))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `team_id=eq.${teamId}` }, () => void qc.invalidateQueries({ queryKey: key }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);
  const current = topics.find(x => x.id === open);
  // Only mark/read a topic this person can actually see in this team; unknown ids show an unavailable state.
  useEffect(() => { if (open && current) void db.rpc('mark_topic_read', { _id: open }).then(() => qc.invalidateQueries({ queryKey: key })); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, !!current]);
  const create = async (e: FormEvent) => {
    e.preventDefault(); if (!title.trim()) return; setBusy(true);
    const { data, error } = await db.rpc('create_topic', { _team: teamId, _title: title.trim(), _body: body.trim() }); setBusy(false);
    if (error) { toast.error(t(errorKey(error))); return; }
    setTitle(''); setBody(''); setCreating(false); void qc.invalidateQueries({ queryKey: key }); setOpen(data);
  };
  const manage = async (args: Record<string, unknown>) => { const { error } = await db.rpc('manage_topic', { _id: open, _pinned: null, _delete: null, ...args }); if (error) { toast.error(t(errorKey(error))); return; } if (args['_delete']) close(); void qc.invalidateQueries({ queryKey: key }); };
  if (isError) return <div role="alert"><p>{t('teamCommunication.saveError')}</p><Button variant="secondary" onClick={() => void refetch()}>{t('error.retry')}</Button></div>;
  return <section className="team-discussions" aria-labelledby="disc-title">
    <div className="section-heading"><h2 id="disc-title">{t('teamCommunication.chat')}</h2>{isLeader && <Button variant="secondary" onClick={() => setCreating(true)}><Plus />{t('conversation.newTopic')}</Button>}</div>
    {isLoading ? <div className="skeleton-list" aria-busy="true"><div className="skeleton-row" /></div> : topics.length === 0 ? <p className="auth-subtitle">{isLeader ? t('conversation.noTopicsLeader') : t('conversation.noTopics')}</p> :
      <ul className="settings-list">{topics.map(x => <li key={x.id}><button type="button" className="settings-row topic-row" onClick={() => setOpen(x.id)}>
        {x.unread ? <span className="unread-dot" aria-label={t('conversation.unread')} /> : <span className="unread-dot is-read" aria-hidden="true" />}
        <span className="settings-label"><strong>{x.title}</strong><small className="muted">{t('conversation.postCount', { count: x.posts })} · {new Date(x.last_post_at).toLocaleDateString(lang, { month: 'short', day: 'numeric' })}</small></span>
        {x.pinned && <Pin className="inline-icon" aria-label={t('conversation.pinned')} />}</button></li>)}</ul>}
    <ResponsiveSheet open={creating} onOpenChange={setCreating} title={t('conversation.newTopic')}>
      <form className="edit-form" onSubmit={create}>
        <div><label className="field-label" htmlFor="topic-title">{t('conversation.topicTitle')}</label><Input id="topic-title" maxLength={120} required className="field-input" value={title} onChange={e => setTitle(e.target.value)} /></div>
        <div><label className="field-label" htmlFor="topic-body">{t('conversation.firstPost')}</label><Textarea id="topic-body" rows={4} maxLength={2000} value={body} onChange={e => { request.current = crypto.randomUUID(); setBody(e.target.value); }} /></div>
        <Button type="submit" disabled={busy || !title.trim()}>{t('conversation.createTopic')}</Button>
      </form>
    </ResponsiveSheet>
    <ResponsiveSheet open={!!open} onOpenChange={o => !o && close()} title={current?.title ?? t('teamCommunication.chat')}>
      {isLeader && current && <div className="guest-button-row"><Button variant="secondary" onClick={() => manage({ _pinned: !current.pinned })}><Pin />{current.pinned ? t('conversation.unpin') : t('conversation.pin')}</Button>
        <Button variant="ghost" className="danger-text" onClick={async () => { if (await confirmAction({ title: t('conversation.deleteTopicConfirm'), destructive: true })) void manage({ _delete: true }); }}><Trash2 />{t('conversation.deleteTopic')}</Button></div>}
      {open && current && <CommentThread teamId={teamId} topicId={open} me={me} />}
      {open && !current && (isLoading ? <div className="skeleton-list" aria-busy="true"><div className="skeleton-row" /></div> :
        <div className="empty-state" role="status"><MessageCircle /><p><strong>{t('conversation.unavailableTitle')}</strong></p><p className="muted">{t('conversation.unavailableBody')}</p>
          <Button variant="secondary" onClick={close}>{t('conversation.backToDiscussions')}</Button></div>)}
    </ResponsiveSheet>
  </section>;
}

const CHAT_ICON: Record<ChatPlatform, GwIconProps['name']> = { whatsapp: 'MessageCircle', telegram: 'Send', signal: 'MessageSquare', groupme: 'UsersRound', messenger: 'MessageSquareText', discord: 'Link2' };

/** "Join the group chat" buttons (several platforms) plus an editor for hosts/leaders. */
export function GroupChatLink({ table, id, links, canEdit }: { table: 'events' | 'teams'; id: string; links: ChatLink[]; canEdit: boolean }) {
  const { t } = useTranslation(); const qc = useQueryClient();
  const [editing, setEditing] = useState(false); const [list, setList] = useState<ChatLink[]>(links); const [draft, setDraft] = useState('');
  const key = links.map(l => l.url).join('|');
  useEffect(() => setList(links), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!links.length && !canEdit) return null;
  const draftPlatform = draft.trim() ? detectChatPlatform(draft) : null;
  const add = () => {
    const v = draft.trim(); if (!v) return;
    if (!detectChatPlatform(v)) { toast.error(t('conversation.badLink')); return; }
    if (list.some(l => l.url === v)) { setDraft(''); return; }
    if (list.length >= 5) { toast.error(t('conversation.tooMany')); return; }
    setList([...list, { url: v }]); setDraft('');
  };
  const save = async () => {
    const pending = draft.trim();
    let next = list;
    if (pending) { if (!detectChatPlatform(pending)) { toast.error(t('conversation.badLink')); return; } next = [...list, { url: pending }].slice(0, 5); }
    const { error } = await db.from(table).update({ chat_links: next }).eq('id', id);
    if (error) { toast.error(t('profile.saveError')); return; }
    toast.success(t('conversation.linkSaved')); setEditing(false); setDraft('');
    void qc.invalidateQueries();
  };
  return <section className="panel group-chat">
    {links.length > 0 && <><h2 className="section-title">{t('conversation.joinChat')}</h2>
      <div className="chat-links">{links.map(l => { const p = detectChatPlatform(l.url); if (!p) return null;
        return <a key={l.url} className="chat-link-row" href={l.url} target="_blank" rel="noopener noreferrer">
          <GwFeatureTile name={CHAT_ICON[p]} /><span><strong>{t('conversation.joinOn', { platform: CHAT_LABEL[p] })}</strong><small>{t('conversation.opensApp')}</small></span><GwIcon name="ExternalLink" />
        </a>; })}</div></>}
    {canEdit && !editing && <Button variant="ghost" onClick={() => setEditing(true)}>{links.length ? t('conversation.editChat') : t('conversation.addChat')}</Button>}
    {editing && <div className="edit-form">
      {list.length > 0 && <ul className="chat-edit-list">{list.map(l => { const p = detectChatPlatform(l.url);
        return <li key={l.url}><GwIcon name={p ? CHAT_ICON[p] : 'Link2'} /><span><strong>{p ? CHAT_LABEL[p] : ''}</strong><small>{l.url}</small></span>
          <Button variant="ghost" size="icon" aria-label={t('conversation.removeLink')} onClick={() => setList(list.filter(x => x.url !== l.url))}><Trash2 /></Button></li>; })}</ul>}
      <label className="field-label" htmlFor={`chat-${id}`}>{t('conversation.chatLabel')}</label>
      <div className="chat-add-row"><Input id={`chat-${id}`} inputMode="url" className="field-input" placeholder="https://" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <Button variant="secondary" onClick={add} disabled={!draftPlatform}><Plus />{t('conversation.addAnother')}</Button></div>
      <small className="field-hint" aria-live="polite">{draftPlatform ? t('conversation.detected', { platform: CHAT_LABEL[draftPlatform] }) : t('conversation.chatHint')}</small>
      <div className="guest-button-row"><Button onClick={save}>{t('conversation.saveLink')}</Button><Button variant="ghost" onClick={() => { setEditing(false); setList(links); setDraft(''); }}>{t('common.back')}</Button></div>
    </div>}
  </section>;
}
