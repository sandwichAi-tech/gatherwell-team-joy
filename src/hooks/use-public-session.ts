import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Public navigation only; never establishes permission or access. */
export function usePublicSession() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { if (active) setSignedIn(!!session); });
    void supabase.auth.getSession().then(({ data }) => { if (active) setSignedIn(!!data.session); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  return signedIn;
}