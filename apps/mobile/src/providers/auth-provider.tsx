import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
};

const AuthContext = createContext<AuthContextValue>({ loading: true, session: null });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    const openRecoveryLink = async (url: string | null) => {
      if (!url) return;
      const fragment = url.split('#')[1];
      const query = url.split('?')[1]?.split('#')[0];
      const params = new URLSearchParams(fragment ?? query ?? '');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const code = params.get('code');
      if (accessToken && refreshToken) await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      else if (code) await supabase.auth.exchangeCodeForSession(code);
    };
    Linking.getInitialURL().then(openRecoveryLink);
    const linkSubscription = Linking.addEventListener('url', ({ url }) => { void openRecoveryLink(url); });

    return () => { data.subscription.unsubscribe(); linkSubscription.remove(); };
  }, []);

  const value = useMemo(() => ({ loading, session }), [loading, session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
