// lib/supabase.ts creates a real client at import time, which throws without
// these — needed so any test can import a lib/*.ts file that transitively
// imports supabase, even when the test itself never touches the network.
process.env.EXPO_PUBLIC_SUPABASE_URL ||= 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
