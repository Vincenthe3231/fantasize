import { useEffect, useState, useCallback, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { flushCanvasToRemote } from '@/lib/canvasRemoteFlush';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  /** Prevents conflicting auth transitions while signing out before `signInWithPassword`. */
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
