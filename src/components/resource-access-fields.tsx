import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { placementsFor, resourcePriceCents, type ResourcePlacement } from '@/lib/resource-placement';
import type { CreateType } from '@/lib/create-resource';

export function ResourceAccessFields({ type, placement, onPlacement, free, price, onAccess, courseId, onCourse, courses, ready, prefix = 'resource' }: {
  type: CreateType; placement: ResourcePlacement; onPlacement: (p: ResourcePlacement) => void;
  free: boolean; price: string; onAccess: (free: boolean, price: string) => void;
  courseId: string; onCourse: (id: string) => void; courses: { id: string; title: string }[]; ready: boolean; prefix?: string;
}) {
  const { t } = useTranslation();
  const invalid = !free && resourcePriceCents(false, price) === null;
  return <div className="edit-form">
    <fieldset className="form-field"><legend className="field-label">{t('resourcePlacement.title')}</legend>
      <RadioGroup value={placement} onValueChange={v => onPlacement(v as ResourcePlacement)} aria-label={t('resourcePlacement.title')}>
        {placementsFor(type).map(p => <label key={p} htmlFor={`${prefix}-${p}`} className="flex min-h-12 items-center gap-3 rounded-md border border-border p-3">
          <RadioGroupItem id={`${prefix}-${p}`} value={p} className="shrink-0" /><span>{t(`resourcePlacement.${p}`)}</span>
        </label>)}
      </RadioGroup><p className="field-hint">{t(`resourcePlacement.${placement}Hint`)}</p>
    </fieldset>
    {placement === 'course' ? <div className="form-field"><label className="field-label" htmlFor={`${prefix}-course`}>{t('resourcePlacement.pickCourse')}</label>
      <select id={`${prefix}-course`} className="field-input" value={courseId} onChange={e => onCourse(e.target.value)} aria-invalid={!courseId}>
        <option value="">{t('resources.builder.pickCoursePlaceholder')}</option>{courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select><p className="field-hint">{t('resourcePlacement.courseAccess')}</p></div> : <>
      <fieldset className="form-field"><legend className="field-label">{t('resources.item.accessLabel')}</legend>
        <RadioGroup className="grid grid-cols-2 gap-3" value={free ? 'free' : 'paid'} onValueChange={v => onAccess(v === 'free', price)} aria-label={t('resources.item.accessLabel')}>
          {['free', 'paid'].map(v => <label key={v} htmlFor={`${prefix}-${v}`} className="flex min-h-12 items-center gap-3 rounded-md border border-border p-3"><RadioGroupItem id={`${prefix}-${v}`} value={v} />{t(`resources.item.${v}`)}</label>)}
        </RadioGroup>
      </fieldset>
      {!free && <div className="form-field"><label className="field-label" htmlFor={`${prefix}-price`}>{t(type === 'course' ? 'offers.priceMonthly' : 'resourcePlacement.oneTimePrice')}</label>
        <Input id={`${prefix}-price`} className="field-input" inputMode="decimal" value={price} onChange={e => onAccess(false, e.target.value)} aria-invalid={invalid} aria-describedby={`${prefix}-price-hint`} />
        <p id={`${prefix}-price-hint`} className="field-hint" role={invalid ? 'alert' : undefined}>{t(invalid ? 'resourcePlacement.priceError' : 'offers.feeNote')}</p>
        {!ready && <div role="status"><p className="field-hint">{t('resources.item.paidBlocked')}</p><Button asChild variant="secondary"><Link to="/plan">{t('resourcePlacement.setup')}</Link></Button></div>}
      </div>}
    </>}
  </div>;
}