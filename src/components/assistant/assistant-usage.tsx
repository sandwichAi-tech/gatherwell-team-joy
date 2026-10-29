import { useTranslation } from 'react-i18next';
import { Sparkles } from '@/components/icons';
import { useAssistantStatus } from '@/lib/assistant-client';

/** Me: monthly assistant allowance; preview-mode replies are never counted. */
export function AssistantUsage() {
  const { t } = useTranslation(); const { data } = useAssistantStatus();
  if (!data?.connected) return null;
  const pct = data.limit ? Math.min(100, Math.round((data.used / data.limit) * 100)) : 0;
  const close = data.used >= data.limit * 0.8;
  return <section className="panel assistant-usage">
    <div className="section-heading"><h2><Sparkles />{t('assistant.title')}</h2>{!data.connected && <span className="as-preview">{t('assistant.previewMode')}</span>}</div>
    <p className="tabular">{t('assistant.usage', { used: data.used, limit: data.limit })}</p>
    <div className="progress-track" role="progressbar" aria-label={t('assistant.usage', { used: data.used, limit: data.limit })} aria-valuenow={data.used} aria-valuemin={0} aria-valuemax={data.limit}><span style={{ width: `${pct}%` }} /></div>
    {close && <p className="auth-subtitle">{t(data.used >= data.limit ? 'assistant.usageFull' : 'assistant.usageClose')}</p>}
    {!data.connected && <p className="auth-subtitle">{t('assistant.usagePreview')}</p>}
  </section>;
}
