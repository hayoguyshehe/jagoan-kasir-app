import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // Define protected routes
  const isProtectedRoute = req.nextUrl.pathname.startsWith('/dashboard') || 
                           req.nextUrl.pathname === '/' ||
                           req.nextUrl.pathname.startsWith('/transactions') ||
                           req.nextUrl.pathname.startsWith('/staff') ||
                           req.nextUrl.pathname.startsWith('/products');
                           
  // The SDK stores session in this cookie name natively when using auth helpers
  // Since we are using standard supabase-js, we need to check how it saves the token
  const hasToken = req.cookies.has('sb-auth-token') || req.cookies.has('sb-access-token');

  // Basic protection: if accessing dashboard root or routes other than /login, require token
  if (isProtectedRoute) {
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

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
