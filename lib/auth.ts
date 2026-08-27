import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      // A corrupted stored session, an AsyncStorage read failure, or a network
      // blip during token refresh on cold start would otherwise leave
      // `loading` stuck true forever with no recovery path — fall back to
      // signed-out so the login screen can render instead of a dead spinner.
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
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

// Irreversible — deletes auth.users, which cascades (ON DELETE CASCADE) to
// profiles and every other user-owned table from there. See
// 057_delete_own_account.sql for why this is a SECURITY DEFINER RPC rather
// than an Edge Function calling the admin API (no Supabase CLI workflow set
// up for this project). Signs out client-side right after — the row is gone
// server-side, but the current session's access token would otherwise keep
// working locally until it naturally expires.
export async function deleteAccount() {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;
  await supabase.auth.signOut();
}

// Native mobile isn't wired up for deep links yet (no EAS build/scheme handling
// in place) — restrict the redirect to web, where Supabase's detectSessionInUrl
// picks the recovery token back up automatically on /reset-password.
export async function requestPasswordReset(email: string) {
  const redirectTo = Platform.OS === 'web'
    ? `${process.env.EXPO_PUBLIC_APP_URL}/reset-password`
    : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// viewerId lets an accepted friend (or the profile's own owner) see a
// profile even when is_public is off — is_public alone still governs
// whether an anonymous or non-friend visitor can see it via the link.
export async function fetchPublicProfile(username: string, viewerId?: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, is_public')
    .eq('username', username.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.is_public || data.id === viewerId) return data as { id: string; username: string; display_name: string; is_public: boolean };
  if (viewerId) {
    const { data: friends } = await supabase.rpc('are_friends', { user_a: viewerId, user_b: data.id });
    if (friends) return data as { id: string; username: string; display_name: string; is_public: boolean };
  }
  return null;
}
