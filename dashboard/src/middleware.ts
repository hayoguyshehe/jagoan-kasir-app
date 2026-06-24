import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@insforge/sdk';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // Create a server client for middleware
  const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const insforgeAnonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
  
  if (!insforgeUrl || !insforgeAnonKey) {
    return res; // Configuration error handled elsewhere
  }
  
  // Note: For Next.js App Router, we should ideally use server-side cookies.
  // But for a simple approach with standard @insforge/sdk we can parse the cookie manually
  // or use the `@supabase/ssr` / `@insforge/ssr` equivalent if available.
  // We'll just verify the token from the session cookie if any.
  
  // Actually, since InsForge acts like Supabase, using standard auth requires 
  // setting up proper cookie management.
  // For now, let's just check if 'sb-access-token' or similar cookie exists.
  const hasToken = req.cookies.has('insforge-auth-token');

  // Basic protection: if accessing dashboard root or routes other than /login, require token
  if (!req.nextUrl.pathname.startsWith('/login') && 
      !req.nextUrl.pathname.startsWith('/_next') && 
      !req.nextUrl.pathname.startsWith('/api') &&
      !req.nextUrl.pathname.startsWith('/brands')) {
    
    if (!hasToken) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = '/login';
      return NextResponse.redirect(redirectUrl);
    }
  }

  // If going to login but already has token, redirect to dashboard
  if (req.nextUrl.pathname.startsWith('/login') && hasToken) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/';
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
