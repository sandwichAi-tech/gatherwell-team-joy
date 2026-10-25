/** Event format cards at the top of the event builder: standard, retreat or multi-event experience. */

export type EventFormat = 'standard' | 'retreat' | 'multi';

/**
 * Which format cards the builder offers. Retreat needs the feature flag unless the event already is one
 * (legacy values stay editable); multi-event is hidden for events that belong to a recurring series.
 */
export function eventFormats(opts: { retreatsEnabled: boolean; retreatActive: boolean; isSeries: boolean }): EventFormat[] {
  const out: EventFormat[] = ['standard'];
  if (opts.retreatsEnabled || opts.retreatActive) out.push('retreat');
  if (!opts.isSeries) out.push('multi');
  return out;
}

/** Current format from the form's retreat/session state. */
export const formatOf = (multi: boolean, retreat: boolean): EventFormat => (multi ? 'multi' : retreat ? 'retreat' : 'standard');
