export const libraryTextValid = (name: string, en: string, es: string) => name.trim().length > 0 && name.trim().length <= 120 && en.trim().length > 0 && en.length <= 12000 && es.length <= 12000;
/** Editing a library item never silently advances an event's selected snapshot. */
export const selectedWaiverVersion = (attached: number, current: number) => attached > 0 ? attached : current;