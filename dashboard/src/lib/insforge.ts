import { createClient } from '@insforge/sdk';

const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
const insforgeAnonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

if (!insforgeUrl || !insforgeAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_INSFORGE_URL or NEXT_PUBLIC_INSFORGE_ANON_KEY in environment variables");
}

// Use local Next.js API routes for edge functions
const dashboardUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000');
const functionsUrl,
  global: {
    fetch: customFetch
  } = `${dashboardUrl}/api/functions`;

const customFetch = (url: RequestInfo | URL, options?: RequestInit) => {
  if (options && options.credentials === 'include') {
    options.credentials = 'omit';
  }
  return fetch(url, options as any);
};

export const insforge = createClient({ 
  baseUrl: insforgeUrl, 
  anonKey: insforgeAnonKey,
  functionsUrl,
  global: {
    fetch: customFetch
  }
});

// Monkey-patch invoke to force Authorization header (since functionsUrl,
  global: {
    fetch: customFetch
  } domain differs from baseUrl)
const originalInvoke = insforge.functions.invoke.bind(insforge.functions);
insforge.functions.invoke = async (functionName: string, options: any = {}) => {
  if (!options.headers?.Authorization) {
    const accessToken = (insforge.auth as any).tokenManager?.getAccessToken?.();
    if (accessToken) {
      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`
      };
    }
  }
  return originalInvoke(functionName, options);
};
