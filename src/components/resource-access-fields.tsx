import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { pick } from '@/lib/learn';
import {
  coursesAllowed, isStandalone, resourcePriceCents, setCourseSection, toggleCourse, toggleDestination, unavailableCourses,
  type Destinations,
} from '@/lib/resource-placement';
import type { CreateType } from '@/lib/create-resource';
import type { TFunction } from 'i18next';

/** Human list of every live destination, for archive/delete warnings. */
export function livePlacementList(dest: Destinations, courses: CourseOption[], t: TFunction, lang: string | undefined) {
  const out: string[] = [];
  if (dest.team) out.push(t('resourcePlacement.teamTitle'));
  if (dest.coach) out.push(t('resourcePlacement.coachTitle'));
  for (const c of dest.courses) out.push(courses.find(x => x.id === c.course)?.title ?? (pick(lang, c.title_en ?? '', c.title_es ?? '') || t('resourcePlacement.untitledCourse')));
  return out.join(', ');
}

type CourseOption = { id: string; title: string };
type Section = { id: string; offer_id: string; title_en: string; title_es: string };

/** Sections (curriculum tracks) of the host's selected courses; owner-readable only. */
function useCourseSections(ids: string[]) {
  return useQuery({
    queryKey: ['course-sections', [...ids].sort().join(',')], enabled: ids.length > 0, staleTime: 30_000,
    queryFn: async () => {
      const r = await supabase.from('tracks').select('id, offer_id, title_en, title_es, sort_order, created_at').in('offer_id', ids).order('sort_order').order('created_at');
      if (r.error) throw r.error;
      return (r.data ?? []) as Section[];
    },
  });
}

function DestinationCard({ id, checked, disabled, title, hint, onToggle }: { id: string; checked: boolean; disabled?: boolean; title: string; hint: string; onToggle: () => void }) {
  return <label htmlFor={id} className="destination-card" data-checked={checked} data-disabled={disabled || undefined}>
    <input id={id} type="checkbox" className="destination-check" checked={checked} disabled={disabled} onChange={onToggle} aria-describedby={`${id}-hint`} />
    <span className="destination-mark" aria-hidden="true" />
    <span className="destination-text"><strong>{title}</strong><small id={`${id}-hint`}>{hint}</small></span>
  </label>;
}

export function ResourceAccessFields({ type, dest, onDest, free, price, onAccess, courses, ready, prefix = 'resource' }: {
  type: CreateType; dest: Destinations; onDest: (d: Destinations) => void;
  free: boolean; price: string; onAccess: (free: boolean, price: string) => void;
  courses: CourseOption[]; ready: boolean; prefix?: string;
}) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage;
  const invalid = !free && resourcePriceCents(false, price) === null;
  const [query, setQuery] = useState(''); const [showCourses, setShowCourses] = useState(dest.courses.length > 0);
  const searchId = useId();
  const authorized = courses.map(c => c.id);
  const selectedIds = dest.courses.map(c => c.course);
  const sections = useCourseSections(selectedIds.filter(id => authorized.includes(id)));
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); return q ? courses.filter(c => c.title.toLowerCase().includes(q)) : courses; }, [courses, query]);
  const unavailable = unavailableCourses(dest, authorized);
  const courseOn = showCourses || dest.courses.length > 0;
  const titleOf = (id: string) => courses.find(c => c.id === id)?.title ?? (() => { const c = dest.courses.find(x => x.course === id); return c ? pick(lang, c.title_en ?? '', c.title_es ?? '') || t('resourcePlacement.untitledCourse') : t('resourcePlacement.untitledCourse'); })();
  const toggleCourses = () => { if (dest.locked) return; if (courseOn) { setShowCourses(false); onDest({ ...dest, courses: dest.courses.filter(c => c.locked) }); } else setShowCourses(true); };

  return <div className="edit-form">
    <fieldset className="form-field" id={`${prefix}-destinations`} tabIndex={-1}>
      <legend className="field-label">{t('resourcePlacement.titleMulti')}</legend>
      <p className="field-hint">{t('resourcePlacement.help')}</p>
      {dest.locked && <p className="field-hint" role="note">{t('resourcePlacement.lockedNote')}</p>}
      <div className="destination-grid">
        <DestinationCard id={`${prefix}-team`} checked={dest.team} disabled={dest.locked} title={t('resourcePlacement.teamTitle')} hint={t('resourcePlacement.teamCard')} onToggle={() => onDest(toggleDestination(dest, 'team'))} />
        <DestinationCard id={`${prefix}-coach`} checked={dest.coach} disabled={dest.locked} title={t('resourcePlacement.coachTitle')} hint={t('resourcePlacement.coachCard')} onToggle={() => onDest(toggleDestination(dest, 'coach'))} />
        {coursesAllowed(type) && <DestinationCard id={`${prefix}-courses`} checked={courseOn} disabled={dest.locked} title={t('resourcePlacement.coursesTitle')} hint={t('resourcePlacement.coursesCard')} onToggle={toggleCourses} />}
      </div>
    </fieldset>

    {coursesAllowed(type) && courseOn && <fieldset className="form-field" id={`${prefix}-course-list`} tabIndex={-1}>
      <legend className="field-label">{t('resourcePlacement.pickCourses')} <small className="muted-small">{t('resourcePlacement.selectedCount', { count: dest.courses.length })}</small></legend>
      {unavailable.map(c => <div key={c.course} className="destination-warning" role="alert">
        <span>{t('resourcePlacement.unavailable', { course: titleOf(c.course) })}</span>
        {!c.locked && <Button type="button" variant="secondary" onClick={() => onDest(toggleCourse(dest, c.course))}>{t('resourcePlacement.removeCourse')}</Button>}
      </div>)}
      {!dest.locked && (courses.length === 0
        ? <p className="field-hint">{t('resourcePlacement.noCourses')}</p>
        : <>
          {courses.length > 5 && <><label className="sr-only" htmlFor={searchId}>{t('resourcePlacement.searchCourses')}</label>
            <Input id={searchId} type="search" className="field-input" placeholder={t('resourcePlacement.searchCourses')} value={query} onChange={e => setQuery(e.target.value)} /></>}
          <ul className="destination-courses">
            {filtered.length === 0 && <li className="field-hint">{t('resourcePlacement.noMatch')}</li>}
            {filtered.map(c => { const on = selectedIds.includes(c.id); const sel = dest.courses.find(x => x.course === c.id); const secs = (sections.data ?? []).filter(s => s.offer_id === c.id);
              return <li key={c.id}>
                <label htmlFor={`${prefix}-c-${c.id}`} className="destination-course" data-checked={on}>
                  <input id={`${prefix}-c-${c.id}`} type="checkbox" className="destination-check" checked={on} onChange={() => onDest(toggleCourse(dest, c.id))} />
                  <span className="destination-mark" aria-hidden="true" /><span className="destination-text"><strong>{c.title}</strong></span>
                </label>
                {on && secs.length > 1 && <div className="destination-section">
                  <label className="field-hint" htmlFor={`${prefix}-s-${c.id}`}>{t('resourcePlacement.section')}</label>
                  <select id={`${prefix}-s-${c.id}`} className="field-input" value={sel?.section ?? ''} onChange={e => onDest(setCourseSection(dest, c.id, e.target.value || null))}>
                    <option value="">{t('resourcePlacement.firstSection')}</option>
                    {secs.map(s => <option key={s.id} value={s.id}>{pick(lang, s.title_en, s.title_es) || t('resourcePlacement.untitledSection')}</option>)}
                  </select>
                </div>}
              </li>; })}
          </ul>
        </>)}
      {dest.locked && <ul className="destination-courses">{dest.courses.map(c => <li key={c.course} className="destination-course" data-checked="true"><span className="destination-mark" aria-hidden="true" /><span className="destination-text"><strong>{titleOf(c.course)}</strong></span></li>)}</ul>}
      <p className="field-hint">{t('resourcePlacement.courseAccess')}</p>
    </fieldset>}

    {isStandalone(dest) && <>
      <fieldset className="form-field"><legend className="field-label">{t('resources.item.accessLabel')}</legend>
        <div className="destination-grid is-pair" role="radiogroup" aria-label={t('resources.item.accessLabel')}>
          {(['free', 'paid'] as const).map(v => { const on = (v === 'free') === free; return <label key={v} htmlFor={`${prefix}-${v}`} className="destination-card" data-checked={on}>
            <input id={`${prefix}-${v}`} type="radio" name={`${prefix}-access`} className="destination-check" checked={on} onChange={() => onAccess(v === 'free', price)} />
            <span className="destination-mark is-radio" aria-hidden="true" /><span className="destination-text"><strong>{t(`resources.item.${v}`)}</strong></span>
          </label>; })}
        </div>
        {dest.courses.length > 0 && !free && <p className="field-hint">{t('resourcePlacement.courseIncluded')}</p>}
      </fieldset>
      {!free && <div className="form-field"><label className="field-label" htmlFor={`${prefix}-price`}>{t(type === 'course' ? 'offers.priceMonthly' : 'resourcePlacement.oneTimePrice')}</label>
        <Input id={`${prefix}-price`} className="field-input" inputMode="decimal" value={price} onChange={e => onAccess(false, e.target.value)} aria-invalid={invalid} aria-describedby={`${prefix}-price-hint`} />
        <p id={`${prefix}-price-hint`} className="field-hint" role={invalid ? 'alert' : undefined}>{t(invalid ? 'resourcePlacement.priceError' : 'offers.feeNote')}</p>
        {!ready && <div role="status"><p className="field-hint">{t('resources.item.paidBlocked')}</p><Button asChild variant="secondary"><Link to="/plan">{t('resourcePlacement.setup')}</Link></Button></div>}
      </div>}
    </>}
  </div>;
}

/** Review: every place the resource will appear, with a Fix action for missing/unavailable courses. */
export function DestinationSummary({ dest, courses, onFix, paid = false }: { dest: Destinations; courses: CourseOption[]; onFix: () => void; paid?: boolean }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage;
  const authorized = courses.map(c => c.id);
  const bad = unavailableCourses(dest, authorized).map(c => c.course);
  const rows: { key: string; label: string; ok: boolean }[] = [];
  if (dest.team) rows.push({ key: 'team', label: t('resourcePlacement.teamTitle'), ok: true });
  if (dest.coach) rows.push({ key: 'coach', label: t('resourcePlacement.coachTitle'), ok: true });
  for (const c of dest.courses) rows.push({ key: c.course, label: `${t('resourcePlacement.coursesTitle')}: ${courses.find(x => x.id === c.course)?.title ?? (pick(lang, c.title_en ?? '', c.title_es ?? '') || t('resourcePlacement.untitledCourse'))}`, ok: !bad.includes(c.course) });
  return <section className="form-field" aria-labelledby="dest-summary-title">
    <div className="flex items-center justify-between gap-3"><h3 id="dest-summary-title" className="field-label">{t('resourcePlacement.summaryTitle')}</h3>
      <Button type="button" variant="secondary" onClick={onFix}>{rows.length === 0 || bad.length ? t('resourcePlacement.fix') : t('resourcePlacement.edit')}</Button></div>
    {rows.length === 0 ? <p className="field-hint" role="alert">{t('resourcePlacement.needOne')}</p>
      : <ul className="destination-summary">{rows.map(r => <li key={r.key} data-ok={r.ok}><span>{r.label}</span>{!r.ok && <small role="alert">{t('resourcePlacement.unavailableShort')}</small>}</li>)}</ul>}
    {dest.courses.length > 0 && <p className="field-hint">{t(paid && (dest.team || dest.coach) ? 'resourcePlacement.includedPaid' : 'resourcePlacement.includedCourse')}</p>}
  </section>;
}
