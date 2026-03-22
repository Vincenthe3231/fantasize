import { useEffect, useState, useCallback, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { flushCanvasToRemote } from '@/lib/canvasRemoteFlush';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  /** Prevents auto anonymous sign-in while signing out before `signInWithPassword`. */
  const pendingCredentialSignInRef = useRef(false);

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
    if (pendingCredentialSignInRef.current) return;
    void supabase.auth.signInAnonymously().catch((e) => {
      console.warn('Anonymous sign-in failed (enable Anonymous in Supabase Auth):', e);
    });
  }, [loading, user]);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.updateUser({ email, password });
    return { error };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    pendingCredentialSignInRef.current = true;
    try {
      await flushCanvasToRemote();
      await supabase.auth.signOut();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        await supabase.auth.signInAnonymously();
      }
      return { error };
    } finally {
      pendingCredentialSignInRef.current = false;
    }
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
    signIn,
    signOut,
    isAnonymous,
    userId: user?.id ?? null,
  };
}
