import { createClient } from '@insforge/sdk';

const insforgeUrl = import.meta.env.VITE_INSFORGE_URL;
const insforgeAnonKey = import.meta.env.VITE_INSFORGE_ANON_KEY;

if (!insforgeUrl || !insforgeAnonKey) {
  throw new Error("Missing VITE_INSFORGE_URL or VITE_INSFORGE_ANON_KEY in environment variables");
}

export const insforge = createClient({ 
  baseUrl: insforgeUrl, 
  anonKey: insforgeAnonKey 
});
