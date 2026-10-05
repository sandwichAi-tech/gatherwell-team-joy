import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { assistantStatus, translateText } from '@/lib/assistant.functions';

/** Text handed from an assistant card to the team announcement composer (memory only). */
let pendingAnnouncement: string | null = null;
export const setPendingAnnouncement = (text: string) => { pendingAnnouncement = text; };
export const takePendingAnnouncement = () => { const v = pendingAnnouncement; pendingAnnouncement = null; return v; };

export function useAssistantStatus() {
  const fn = useServerFn(assistantStatus);
  return useQuery({ queryKey: ['assistant-status'], queryFn: () => fn(), staleTime: 60_000 });
}

/** Shared Translate action for bilingual fields: fills the empty side from the filled one. */
export function useTranslateFill() {
  const { t } = useTranslation(); const fn = useServerFn(translateText);
  const [busy, setBusy] = useState(false); const [preview, setPreview] = useState(false);
  const run = async (en: string, es: string, setEn: (v: string) => void, setEs: (v: string) => void) => {
    const toEs = !!en.trim() && (!es.trim() || true);
    const source = toEs ? en.trim() : es.trim();
    if (!source) { toast(t('assistant.translateEmpty')); return; }
    setBusy(true);
    try {
      const r = await fn({ data: { text: source, target: toEs ? 'es' : 'en' } });
      if (r.error) { toast.error(t(r.error === 'limit' ? 'assistant.limitReached' : 'assistant.failed')); return; }
      (toEs ? setEs : setEn)(r.text); setPreview(r.preview);
      toast.success(t(r.preview ? 'assistant.translatedPreview' : 'assistant.translated'));
    } catch { toast.error(t('assistant.failed')); } finally { setBusy(false); }
  };
  return { run, busy, preview };
}
