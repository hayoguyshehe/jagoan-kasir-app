import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment variables");
}

// Use Dasbor Next.js API routes for edge functions
const dashboardUrl = import.meta.env.VITE_DASHBOARD_URL;
if (!dashboardUrl) throw new Error("Missing VITE_DASHBOARD_URL environment variable (must point to Dasbor URL)");

const customFetch = (url: RequestInfo | URL, options?: RequestInit) => {
  const newOptions = { ...options };
  newOptions.credentials = 'omit';
  return fetch(url, newOptions as any);
};

export const insforge = createClient(supabaseUrl, supabaseAnonKey, { 
  global: { fetch: customFetch }
});

// Monkey-patch invoke to point to Next.js API routes since Supabase JS doesn't natively support functionsUrl redirect
insforge.functions.invoke = async (functionName: string, options: any = {}) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (!headers.Authorization) {
    // Supabase v2 JS auth session
    const { data: { session } } = await insforge.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  }

  const response = await fetch(`${dashboardUrl}/api/functions/${functionName}`, {
    method: 'POST',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  let data;
  try {
    data = await response.json();
  } catch (e) {
    data = await response.text();
  }

  if (!response.ok) {
    return { data: null, error: data };
  }
  return { data, error: null };
};
