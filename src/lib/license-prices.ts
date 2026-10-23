/**
 * Team seat licenses the app sells. One source of truth: the plan screen shows
 * these amounts and checkout refuses to charge anything else.
 */
export const LICENSES = [{ id: 'team25' as const, cents: 19900, seats: 25 }, { id: 'team100' as const, cents: 49900, seats: 100 }];
