import { useEffect } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, ArrowRight, BookOpen, ClipboardCheck, CircleHelp, Download, FileText, GraduationCap, Layers, Leaf, Link2, Radio, Sparkles, Video, Waveform,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { ListSkeleton } from '@/components/launch-states';
import { useLearn } from '@/components/learn';
import { useCanCreate } from '@/components/resources';
import { myOffersQuery, offerTitle } from '@/lib/offers';
import { CREATE_TYPES, createDestination, parseCreateType, quizParentDestination, type CreateType } from '@/lib/create-resource';

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

/** Quizzes live inside a course: pick the parent course, then land on its quiz section. */
function QuizParentStep() {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const navigate = useNavigate();
  const { userId } = useLearn();
  const q = useQuery(myOffersQuery(userId));
  const courses = (q.data ?? []).filter(o => o.kind === 'course' && o.status !== 'archived');
  return <>
    <Link to="/learn/create" className="back-link"><ArrowLeft />{t('resources.create.chooseAnother')}</Link>
    <div className="page-heading"><div><span className="eyebrow">{t('resources.create.types.quiz.name')}</span><h1>{t('resources.create.quizParent.title')}</h1><p>{t('resources.create.quizParent.text')}</p></div></div>
    {q.isPending ? <ListSkeleton /> : <section className="panel">
      <div className="section-heading"><h2>{t('resources.create.quizParent.pick')}</h2>
        <Button asChild variant="secondary"><Link to="/offers" search={{ new: 'course' }}><GraduationCap />{t('resources.create.quizParent.new')}</Link></Button></div>
      {courses.length ? <ul className="offer-list compact">{courses.map(o => <li key={o.id}>
        <button type="button" className="offer-row is-link create-course-pick" onClick={() => void navigate({ to: '/offer/$id', params: { id: o.id }, search: { panel: 'quiz' } })}>
          <div className="offer-row-main"><strong>{offerTitle(o, lang) || t('offers.untitled')}</strong><small>{t(`offers.status.${o.status}`)}</small></div>
          <ArrowRight /></button></li>)}</ul>
        : <p className="muted-small">{t('resources.create.quizParent.empty')}</p>}
    </section>}
  </>;
}

export function CreateResourcePage({ type }: { type?: string | undefined }) {
  const { t } = useTranslation(); const navigate = useNavigate();
  const { workspace } = useLearn(); const canCreate = useCanCreate();
  const parsed = parseCreateType(type);
  const dest = parsed ? createDestination(parsed) : null;
  useEffect(() => { if (dest) void navigate({ ...dest, replace: true } as never); }, [dest, navigate]);

  if (!workspace) return <ListSkeleton />;
  if (!canCreate) return <section className="panel"><Link to="/learn" className="back-link"><ArrowLeft />{t('resources.title')}</Link><p className="auth-subtitle">{t('resources.create.creatorsOnly')}</p></section>;
  if (parsed === 'quiz') return <QuizParentStep />;
  if (dest) return <ListSkeleton />; // redirecting to the tailored editor
  return <>
    <Link to="/learn" className="back-link"><ArrowLeft />{t('resources.create.back')}</Link>
    <div className="page-heading"><div><span className="eyebrow">{t('resources.title')}</span><h1>{t('resources.create.title')}</h1><p>{t('resources.create.sentence')}</p></div>
      <Button asChild variant="secondary"><Link to="/learn/templates"><BookOpen />{t('resources.templatesButton')}</Link></Button></div>
    <TypeChooser />
  </>;
}
