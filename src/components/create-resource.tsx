import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, ArrowRight, BookOpen, ClipboardCheck, Compass, CircleHelp, Download, FileText, GraduationCap, Layers, Leaf, Link2, Radio, Sparkles, Video, Waveform,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { ListSkeleton } from '@/components/launch-states';
import { useLearn } from '@/components/learn';
import { useCanCreate } from '@/components/resources';
import { ResourceBuilder } from '@/components/resource-builder';
import { WellnessAssessmentBuilder } from '@/components/wellness-assessment-builder';
import { createTypeAllowed, launchCreateGroups, parseCreateType, type CreateType } from '@/lib/create-resource';
import { useFeature } from '@/lib/feature-flags';

const TYPE_ICON: Record<CreateType, typeof Video> = {
  assessment: Compass, video: Video, quiz: ClipboardCheck, guide: FileText, audio: Waveform, file: Download,
  link: Link2, live: Radio, recipe: Leaf, course: GraduationCap, bundle: Layers,
};

/** "What are you creating?" — visually distinct cards, one per resource type. */
function TypeChooser({ flags }: { flags: { courses: boolean; assessment: boolean } }) {
  const { t } = useTranslation();
  return <>
    {launchCreateGroups(flags).map(group => <section key={group.key} className="resource-type-group" aria-labelledby={`type-${group.key}`}><h2 id={`type-${group.key}`}>{t(`resources.create.groups.${group.key}`)}</h2><p className="muted-small">{t(`resources.create.groupHints.${group.key}`)}</p><ul className="create-type-grid">
      {group.types.map(type => {
        const Icon = TYPE_ICON[type];
        return <li key={type} className="create-type-item"><Link to="/learn/create" search={{ type }} className="create-type-card">
          <span className="creation-icon"><Icon /></span>
          <span className="create-type-body">
            <strong>{t(`resources.create.types.${type}.name`)}</strong>
            <small>{t(`resources.create.types.${type}.example`)}</small>
            <em>{t(`resources.create.types.${type}.best`)}</em>
          </span>
          <ArrowRight aria-hidden="true" />
        </Link></li>;
      })}
    </ul></section>)}
    <div className="create-type-grid"><Link to="/learn/templates" className="create-type-card is-template">
        <span className="creation-icon"><Sparkles /></span>
        <span className="create-type-body">
          <strong>{t('resources.create.template')}</strong>
          <small>{t('resources.create.templateText')}</small>
        </span>
        <ArrowRight aria-hidden="true" />
      </Link>
    </div>
    <section className="panel create-help" aria-labelledby="create-help-title">
      <div className="section-heading"><div><h2 id="create-help-title"><CircleHelp aria-hidden="true" /> {t('resources.create.helpTitle')}</h2></div></div>
      <ul className="create-help-list">
        <li><strong>{t('resources.create.helpSingleTitle')}</strong><p>{t('resources.create.helpSingle')}</p></li>
        {flags.courses && <li><strong>{t('resources.create.helpCourseTitle')}</strong><p>{t('resources.create.helpCourse')}</p></li>}
        {flags.courses && <li><strong>{t('resources.create.helpBundleTitle')}</strong><p>{t('resources.create.helpBundle')}</p></li>}
      </ul>
    </section>
  </>;
}

export function CreateResourcePage({ type, id }: { type?: string | undefined; id?: string | undefined }) {
  const { t } = useTranslation();
  const { workspace } = useLearn(); const canCreate = useCanCreate();
  const [courses, coursesReady] = useFeature('feature_courses'); const [assessment, assessmentReady] = useFeature('feature_assessment');
  const flags = { courses, assessment };
  const picked = parseCreateType(type);
  // Switched-off types are hidden completely: a direct link falls back to the chooser.
  const parsed = picked && createTypeAllowed(picked, flags) ? picked : null;

  if (!workspace || !coursesReady || !assessmentReady) return <ListSkeleton />;
  if (!canCreate) return <section className="panel"><Link to="/learn" className="back-link"><ArrowLeft />{t('resources.title')}</Link><p className="auth-subtitle">{t('resources.create.creatorsOnly')}</p></section>;
  if (parsed === 'assessment') return <WellnessAssessmentBuilder id={id} />;
  // A picked type (or an existing item via ?id=) opens the single dynamic builder.
  // No key: the builder must stay mounted across type switches so shared input survives.
  if (parsed || id) return <ResourceBuilder initialType={parsed ?? 'video'} initialId={id} />; // the saved item's real type is loaded from ?id=
  return <>
    <Link to="/learn" className="back-link"><ArrowLeft />{t('resources.create.back')}</Link>
    <div className="page-heading"><div><span className="eyebrow">{t('resources.title')}</span><h1>{t('resources.create.title')}</h1><p>{t('resources.create.sentence')}</p></div>
      <Button asChild variant="secondary"><Link to="/learn/templates"><BookOpen />{t('resources.templatesButton')}</Link></Button></div>
    <TypeChooser flags={flags} />
  </>;
}
