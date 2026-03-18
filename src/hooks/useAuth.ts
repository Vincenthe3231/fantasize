import { useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { flushCanvasToRemote } from '@/lib/canvasRemoteFlush';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (user) return;
    void supabase.auth.signInAnonymously().catch((e) => {
      console.warn('Anonymous sign-in failed (enable Anonymous in Supabase Auth):', e);
    });
  }, [loading, user]);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.updateUser({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await flushCanvasToRemote();
    await supabase.auth.signOut();
  }, []);

  const isAnonymous = Boolean(user?.is_anonymous);

  return {
    user,
    isLoading: loading,
    signUp,
    signOut,
    isAnonymous,
    userId: user?.id ?? null,
  };
}
