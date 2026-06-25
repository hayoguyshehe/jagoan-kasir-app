import { createClient } from '@insforge/sdk';

const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
const insforgeAnonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

if (!insforgeUrl || !insforgeAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_INSFORGE_URL or NEXT_PUBLIC_INSFORGE_ANON_KEY in environment variables");
}

const appKey = new URL(insforgeUrl).hostname.split('.')[0];
const functionsUrl = `https://${appKey}.function2.insforge.app`;

export const insforge = createClient({ 
  baseUrl: insforgeUrl, 
  anonKey: insforgeAnonKey,
  functionsUrl
});

// Monkey-patch invoke to force Authorization header (since functionsUrl domain differs from baseUrl)
const originalInvoke = insforge.functions.invoke.bind(insforge.functions);
insforge.functions.invoke = async (functionName: string, options: any = {}) => {
  if (!options.headers?.Authorization) {
    const { data } = await insforge.auth.getSession();
    if (data?.session?.accessToken) {
      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${data.session.accessToken}`
      };
    }
  }
  return originalInvoke(functionName, options);
};
