import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowUp, Microphone, RefreshCw, Sparkles, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { askAssistant } from '@/lib/assistant.functions';
import type { AssistantCard, Screen } from '@/lib/assistant/config';
import { AssistantCardView } from './assistant-cards';

type Msg = { id: number; role: 'user' | 'assistant'; text: string; cards?: AssistantCard[]; error?: boolean };
const CHIPS: Record<Screen, string[]> = { home: ['today', 'week'], events: ['plan', 'invite'], team: ['announce', 'thank'], learn: ['summarize', 'recipe'], me: ['today', 'plan'] };

function localToday() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
const getRecognition = (): (new () => Recognition) | null => (typeof window === 'undefined' ? null : ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null));

type ChatState = { msgs: Msg[]; setMsgs: React.Dispatch<React.SetStateAction<Msg[]>>; preview: boolean; setPreview: (v: boolean) => void };

function Conversation({ screen, name, close, chat }: { screen: Screen; name: string; close: () => void; chat: ChatState }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const ask = useServerFn(askAssistant); const qc = useQueryClient();
  const { msgs, setMsgs, preview, setPreview } = chat;
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null); const endRef = useRef<HTMLDivElement>(null); const idRef = useRef(0);
  const Speech = getRecognition();
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy]);
  useEffect(() => () => recRef.current?.stop(), []);

  const send = async (raw: string) => {
    const value = raw.trim(); if (!value || busy) return;
    const next: Msg[] = [...msgs, { id: ++idRef.current, role: 'user', text: value }];
    setMsgs(next); setText(''); setBusy(true);
    try {
      const history = next.filter(m => !m.error).slice(-20).map(m => ({ role: m.role, text: m.text || (m.cards?.length ? '[card shown]' : '…') }));
      const r = await ask({ data: { messages: history, lang, screen, today: localToday(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone, origin: window.location.origin, name } });
      setPreview(r.preview);
      const reply = r.limitReached ? t('assistant.limitReached') : r.error ? t(r.error === 'busy' ? 'assistant.busy' : 'assistant.failed') : r.text;
      setMsgs(m => [...m, { id: ++idRef.current, role: 'assistant', text: reply, cards: r.cards, error: !!(r.error || r.limitReached) }]);
      if (!r.preview) void qc.invalidateQueries({ queryKey: ['assistant-status'] });
    } catch {
      setMsgs(m => [...m, { id: ++idRef.current, role: 'assistant', text: t('assistant.failed'), error: true }]);
    } finally { setBusy(false); }
  };

  const toggleMic = () => {
    if (!Speech) return;
    if (listening) { recRef.current?.stop(); return; }
    const rec = new Speech(); rec.lang = lang === 'es' ? 'es-MX' : 'en-US'; rec.interimResults = true; rec.continuous = false;
    const base = text ? `${text} ` : '';
    rec.onresult = e => { const said = Array.from(e.results as ArrayLike<any>).map((r: any) => r[0].transcript).join(''); setText(base + said); };
    rec.onend = () => setListening(false); rec.onerror = () => setListening(false);
    recRef.current = rec; setListening(true); rec.start();
  };

  return <div className="as-shell">
    <header className="as-head">
      <span className="as-avatar" aria-hidden="true"><Sparkles /></span>
      <div className="as-head-text"><strong>{t('assistant.title')}</strong>{preview && <span className="as-preview">{t('assistant.previewMode')}</span>}</div>
      {msgs.length > 0 && <Button variant="ghost" size="sm" onClick={() => { setMsgs([]); setPreview(false); }}><RefreshCw />{t('assistant.newChat')}</Button>}
      <Button variant="ghost" size="icon" onClick={close} aria-label={t('common.close')}><X /></Button>
    </header>
    <div className="as-scroll" aria-live="polite">
      <div className="as-msg assistant"><p>{name ? t('assistant.greeting', { name }) : t('assistant.greetingNoName')}</p></div>
      {msgs.length === 0 && <div className="as-chips">{CHIPS[screen].map(k => <button key={k} type="button" className="as-chip" onClick={() => send(t(`assistant.chips.${k}`))}>{t(`assistant.chips.${k}`)}</button>)}</div>}
      {msgs.map(m => <div key={m.id} className={`as-msg ${m.role} ${m.error ? 'is-error' : ''}`}>
        {m.text && <p>{m.text}</p>}
        {m.cards?.map((c, i) => <AssistantCardView key={i} card={c} close={close} />)}
      </div>)}
      {busy && <div className="as-msg assistant"><span className="as-typing" aria-label={t('assistant.thinking')}><i /><i /><i /></span></div>}
      <div ref={endRef} />
    </div>
    <form className="as-composer" onSubmit={e => { e.preventDefault(); void send(text); }}>
      <textarea className="as-input" rows={1} value={text} maxLength={2000} placeholder={t(listening ? 'assistant.listening' : 'assistant.placeholder')} aria-label={t('assistant.placeholder')}
        onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(text); } }} />
      {Speech && <Button type="button" variant="ghost" size="icon" className={`as-mic ${listening ? 'is-on' : ''}`} aria-pressed={listening} aria-label={t(listening ? 'assistant.stopMic' : 'assistant.mic')} onClick={toggleMic}><Microphone /></Button>}
      <Button type="submit" size="icon" className="as-send" disabled={busy || !text.trim()} aria-label={t('assistant.send')}><ArrowUp /></Button>
    </form>
  </div>;
}

/** Bottom sheet (85%) on phones, 420px right panel on desktop; stays mounted so the session's chat survives closing. */
export function AssistantPanel({ open, onOpenChange, screen, name }: { open: boolean; onOpenChange: (o: boolean) => void; screen: Screen; name: string }) {
  const mobile = useIsMobile(); const { t } = useTranslation();
  const [msgs, setMsgs] = useState<Msg[]>([]); const [preview, setPreview] = useState(false);
  const body = <Conversation screen={screen} name={name} close={() => onOpenChange(false)} chat={{ msgs, setMsgs, preview, setPreview }} />;
  if (mobile) return <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
    <DrawerContent className="as-drawer"><DrawerTitle className="sr-only">{t('assistant.title')}</DrawerTitle><DrawerDescription className="sr-only">{t('assistant.title')}</DrawerDescription>{body}</DrawerContent>
  </Drawer>;
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="as-panel"><SheetTitle className="sr-only">{t('assistant.title')}</SheetTitle><SheetDescription className="sr-only">{t('assistant.title')}</SheetDescription>{body}</SheetContent>
  </Sheet>;
}
