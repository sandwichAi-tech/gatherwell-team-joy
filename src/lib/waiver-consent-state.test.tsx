import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useWaiverConsentState } from './waiver-consent-state';
describe('document-bound explicit consent', () => {
  it('starts unchecked and requires new acceptance for another platform locale/version', () => {
    const { result, rerender } = renderHook(({ context }) => useWaiverConsentState(context, false), { initialProps: { context: 'ZZ-TEST-event:en-v1' } });
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true)); expect(result.current[0]).toBe(true);
    rerender({ context: 'ZZ-TEST-event:es-v1' }); expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));
    rerender({ context: 'ZZ-TEST-event:en-v2' }); expect(result.current[0]).toBe(false);
    rerender({ context: 'ZZ-TEST-event:es-v1' }); expect(result.current[0]).toBe(false);
  });
  it('does not reuse host consent after an event or selected version changes', () => {
    const { result, rerender } = renderHook(({ context }) => useWaiverConsentState(context, {} as Record<string, boolean>), { initialProps: { context: 'ZZ-TEST-A:form-v1' } });
    act(() => result.current[1]({ form: true }));
    rerender({ context: 'ZZ-TEST-B:form-v1' }); expect(result.current[0]).toEqual({});
    rerender({ context: 'ZZ-TEST-B:form-v2' }); expect(result.current[0]).toEqual({});
  });
});