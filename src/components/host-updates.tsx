import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Megaphone, Plus, Send, Archive, Pencil } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: { message?: string } | null }> };

type Item = { id: string; title: string; body: string; status: string; scheduled_at: string | null; published_at: string | null; updated_at: string; read: boolean };

const errKey = (e: unknown) => {
  const m = String((e as { message?: string })?.message ?? '');
  for (const k of ['scheduling_setup_required', 'blocked_claim', 'rate_limited', 'not_allowed', 'invalid_body', 'archived']) if (m.includes(k)) return `updates.errors.${k}`;
  return 'profile.saveError';
};

/** Host updates for one offering: managers compose/publish; recipients read. */
export function HostUpdates({ kind, offeringId }: { kind: 'event' | 'offer'; offeringId: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es-419' : 'en-US';
  const qc = useQueryClient();
  const key = ['offering-updates', kind, offeringId];
  const { data } = useQuery({
    queryKey: key,
    queryFn: async () => (await db.rpc('offering_updates', { _kind: kind, _id: offeringId })).data as { manage: boolean; items: Item[] } | null,
  });
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  const items = data?.items ?? [];
  const manage = !!data?.manage;
  if (!data || (!manage && items.length === 0)) return null;

  const publish = async (id: string) => {
    const { error } = await db.rpc('publish_host_update', { _id: id });
    if (error) { toast.error(t(errKey(error))); return; }
    toast.success(t('updates.published')); await qc.invalidateQueries({ queryKey: key });
    await qc.invalidateQueries({ queryKey: ['updates-inbox'] });
  };
  const archive = async (id: string) => {
    const { error } = await db.rpc('archive_host_update', { _id: id });
    if (error) { toast.error(t(errKey(error))); return; }
    toast.success(t('updates.archived')); await qc.invalidateQueries({ queryKey: key });
  };
  const markRead = async (id: string) => {
    await db.rpc('mark_update_read', { _id: id });
    await qc.invalidateQueries({ queryKey: key });
  };

  return <section className="panel" aria-labelledby="updates-panel-title">
    <div className="section-heading">
      <h2 id="updates-panel-title"><Megaphone className="inline-icon" />{t('updates.panelTitle')}</h2>
      {manage && <Button variant="secondary" onClick={() => setEditing('new')}><Plus />{t('updates.new')}</Button>}
    </div>
    {items.length === 0 ? <p className="auth-subtitle">{t('updates.panelEmpty')}</p> :
      <ul className="settings-list">{items.map(u => <li key={u.id}>
        <article className={`update-card ${!manage && !u.read ? 'is-unread' : ''}`}>
          <div className="update-card-head">
            <div><h3>{u.title}</h3>
              <p className="muted"><time dateTime={u.published_at ?? u.updated_at}>{new Date(u.published_at ?? u.updated_at).toLocaleString(lang, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
                {u.status === 'draft' && <> · <span className="chip">{t('updates.draft')}</span></>}
                {u.scheduled_at && new Date(u.scheduled_at).getTime() > Date.now() && <> · <span className="chip not-connected-badge">{t('updates.scheduledSetupRequired')}</span></>}</p>
            </div>
            {manage && u.status === 'draft' && <div className="guest-button-row">
              <Button size="sm" variant="secondary" onClick={() => setEditing(u)}><Pencil />{t('updates.edit')}</Button>
              <Button size="sm" onClick={() => void publish(u.id)}><Send />{t('updates.publish')}</Button>
            </div>}
            {manage && u.status === 'published' && <Button size="sm" variant="ghost" onClick={() => void archive(u.id)}><Archive />{t('updates.archive')}</Button>}
            {!manage && !u.read && <Button size="sm" variant="ghost" onClick={() => void markRead(u.id)}>{t('updates.markRead')}</Button>}
          </div>
          <p className="update-body">{u.body}</p>
        </article>
      </li>)}</ul>}
    {manage && <p className="muted">{t('updates.inAppOnly')}</p>}
    {editing && <UpdateEditor kind={kind} offeringId={offeringId} existing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void qc.invalidateQueries({ queryKey: key }); }} />}
  </section>;
}

function UpdateEditor({ kind, offeringId, existing, onClose, onSaved }: { kind: 'event' | 'offer'; offeringId: string; existing: Item | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(existing?.title ?? ''); const [body, setBody] = useState(existing?.body ?? '');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await db.rpc('save_host_update', { _id: existing?.id ?? null, _kind: kind, _offering: offeringId, _title: title.trim(), _body: body.trim(), _scheduled_at: null });
    setBusy(false);
    if (error) { toast.error(t(errKey(error))); return; }
    toast.success(t('updates.saved')); onSaved();
  };
  return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={existing ? t('updates.edit') : t('updates.new')} description={t('updates.editorText')}>
    <form className="edit-form" onSubmit={submit}>
      <div><label className="field-label" htmlFor="upd-title">{t('updates.fieldTitle')}</label><Input id="upd-title" required maxLength={120} className="field-input" value={title} onChange={e => setTitle(e.target.value)} /></div>
      <div><label className="field-label" htmlFor="upd-body">{t('updates.fieldBody')}</label><Textarea id="upd-body" required rows={6} maxLength={4000} value={body} onChange={e => setBody(e.target.value)} /></div>
      <p className="muted">{t('updates.audienceNote')}</p>
      <Button type="submit" disabled={busy || !title.trim() || !body.trim()}>{t('updates.saveDraft')}</Button>
    </form>
  </ResponsiveSheet>;
}
