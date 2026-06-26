import { createClient } from '@insforge/sdk';

const insforgeUrl = import.meta.env.VITE_INSFORGE_URL;
const insforgeAnonKey = import.meta.env.VITE_INSFORGE_ANON_KEY;

if (!insforgeUrl || !insforgeAnonKey) {
  throw new Error("Missing VITE_INSFORGE_URL or VITE_INSFORGE_ANON_KEY in environment variables");
}

// Use Dasbor Next.js API routes for edge functions
const dashboardUrl = import.meta.env.VITE_DASHBOARD_URL;
if (!dashboardUrl) throw new Error("Missing VITE_DASHBOARD_URL environment variable (must point to Dasbor URL)");
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
