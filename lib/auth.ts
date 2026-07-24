import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

// Returns whether the new account already has an active session — false
// means the Supabase project requires email confirmation before login, and
// the caller needs to tell the user to check their inbox instead of assuming
// they're signed in.
export async function signUp(email: string, password: string, username: string, displayName: string): Promise<{ confirmed: boolean }> {
  const { data: avail, error: rpcErr } = await supabase.rpc('check_username_available', { candidate: username });
  if (rpcErr) throw rpcErr;
  if (!avail) throw new Error('USERNAME_TAKEN');

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username, display_name: displayName } },
  });
  if (error) throw error;
  return { confirmed: data.session !== null };
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function fetchPublicProfile(username: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, is_public')
    .eq('username', username.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.is_public) return null;
  return data as { id: string; username: string; display_name: string; is_public: boolean };
}
