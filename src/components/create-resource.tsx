import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, ArrowRight, BookOpen, ClipboardCheck, CircleHelp, Download, FileText, GraduationCap, Layers, Leaf, Link2, Radio, Sparkles, Video, Waveform,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { ListSkeleton } from '@/components/launch-states';
import { useLearn } from '@/components/learn';
import { useCanCreate } from '@/components/resources';
import { ResourceBuilder } from '@/components/resource-builder';
import { CREATE_TYPES, parseCreateType, type CreateType } from '@/lib/create-resource';

const TYPE_ICON: Record<CreateType, typeof Video> = {
  video: Video, quiz: ClipboardCheck, guide: FileText, audio: Waveform, file: Download,
  link: Link2, live: Radio, recipe: Leaf, course: GraduationCap, bundle: Layers,
};

/** "What are you creating?" — visually distinct cards, one per resource type. */
function TypeChooser() {
  const { t } = useTranslation();
  return <>
    <div className="create-type-grid" role="list">
      {CREATE_TYPES.map(type => {
        const Icon = TYPE_ICON[type];
        return <Link key={type} to="/learn/create" search={{ type }} className="create-type-card" role="listitem">
          <span className="creation-icon"><Icon /></span>
          <span className="create-type-body">
            <strong>{t(`resources.create.types.${type}.name`)}</strong>
            <small>{t(`resources.create.types.${type}.example`)}</small>
            <em>{t(`resources.create.types.${type}.best`)}</em>
          </span>
          <ArrowRight aria-hidden="true" />
        </Link>;
      })}
      <Link to="/learn/templates" className="create-type-card is-template" role="listitem">
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
        <li><strong>{t('resources.create.helpCourseTitle')}</strong><p>{t('resources.create.helpCourse')}</p></li>
        <li><strong>{t('resources.create.helpBundleTitle')}</strong><p>{t('resources.create.helpBundle')}</p></li>
      </ul>
    </section>
  </>;
}

export function CreateResourcePage({ type }: { type?: string | undefined }) {
  const { t } = useTranslation();
  const { workspace } = useLearn(); const canCreate = useCanCreate();
  const parsed = parseCreateType(type);

  if (!workspace) return <ListSkeleton />;
  if (!canCreate) return <section className="panel"><Link to="/learn" className="back-link"><ArrowLeft />{t('resources.title')}</Link><p className="auth-subtitle">{t('resources.create.creatorsOnly')}</p></section>;
  // A picked type opens the single dynamic builder — no detour through unrelated pages.
  // No key: the builder must stay mounted across type switches so shared input survives.
  if (parsed) return <ResourceBuilder initialType={parsed} />;
  return <>
    <Link to="/learn" className="back-link"><ArrowLeft />{t('resources.create.back')}</Link>
    <div className="page-heading"><div><span className="eyebrow">{t('resources.title')}</span><h1>{t('resources.create.title')}</h1><p>{t('resources.create.sentence')}</p></div>
      <Button asChild variant="secondary"><Link to="/learn/templates"><BookOpen />{t('resources.templatesButton')}</Link></Button></div>
    <TypeChooser />
  </>;
}
