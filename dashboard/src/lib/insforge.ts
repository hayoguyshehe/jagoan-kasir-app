import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_INSFORGE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_INSFORGE_ANON_KEY || 'placeholder';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.VITE_INSFORGE_URL && typeof window !== 'undefined') {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or VITE_INSFORGE_URL in environment variables");
}

// Use local Next.js API routes for edge functions
const dashboardUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000');

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
