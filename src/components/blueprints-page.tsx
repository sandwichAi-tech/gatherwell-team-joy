import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { TemplateCard, TemplateEditor, toDraft, type TemplateDraft } from '@/components/templates';
import { useGatherwell } from '@/components/gatherwell-shell';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, ArrowRight } from '@/components/icons';
import { EmptyState, ListSkeleton, RetryState } from '@/components/launch-states';
import { confirmAction } from '@/components/confirm-dialog';
import { teamsQuery, workspaceQuery } from '@/lib/account';
import { templatesQuery, type Template } from '@/lib/templates';
import { canEditBlueprint } from '@/lib/blueprint-defaults';
import { supabase } from '@/integrations/supabase/client';

export function BlueprintsPage({ create = false }: { create?: boolean }) {
  const { t } = useTranslation(); const { userId } = useGatherwell(); const qc = useQueryClient();
  const query = useQuery(templatesQuery()); const { data: workspace } = useQuery(workspaceQuery(userId)); const { data: teams = [] } = useQuery(teamsQuery(userId));
  const [editing, setEditing] = useState<TemplateDraft | null>(create ? {} : null); const [removing, setRemoving] = useState<string | null>(null);
  const canHost = workspace && workspace.role !== 'member'; const leaderTeams = teams.filter(x => x.role === 'leader').map(x => x.teamId);
  const remove = async (template: Template) => {
    if (!(await confirmAction({ title: t('templates.deleteTitle'), body: t('templates.deleteBody'), destructive: true }))) return;
    setRemoving(template.id);
    const { error } = await supabase.from('templates').delete().eq('id', template.id).select('id').single();
    setRemoving(null);
    if (error) toast.error(t('profile.saveError')); else { toast.success(t('templates.deleted')); await qc.invalidateQueries({ queryKey: ['templates'] }); }
  };
  return <>
    <div className="page-heading"><div><span className="eyebrow">{t('events.title')}</span><h1>{t('templates.heading')}</h1></div>{canHost && <Button onClick={() => setEditing({})}><Plus />{t('templates.new')}</Button>}</div>
    {query.isLoading ? <ListSkeleton /> : query.isError ? <RetryState retry={() => void query.refetch()} /> : query.data?.length ? <div className="template-grid blueprint-library">{query.data.map(template => <TemplateCard key={template.id} template={template}>
      {canHost && <Button asChild><Link to="/gathering/new" search={{ template: template.id }}>{t('templates.useThis')}<ArrowRight /></Link></Button>}
      {canEditBlueprint(template, userId, leaderTeams) && <><Button variant="secondary" size="icon" aria-label={t('templates.edit')} title={t('templates.edit')} onClick={() => setEditing(toDraft(template))}><Pencil /></Button><Button variant="ghost" size="icon" disabled={removing === template.id} aria-label={t('templates.delete')} title={t('templates.delete')} onClick={() => void remove(template)}><Trash2 /></Button></>}
    </TemplateCard>)}</div> : <EmptyState icon="Layers" text={t('templates.emptyList')} />}
    {workspace && canHost && <TemplateEditor draft={editing} teamId={editing?.team_id ?? workspace.teamId} userId={userId} onClose={() => setEditing(null)} />}
  </>;
}
