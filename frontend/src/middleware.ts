import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPrefixes = ['/login', '/auth/callback'];
const publicExact = new Set(['/']);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute =
    publicExact.has(pathname) ||
    publicPrefixes.some(route => pathname.startsWith(route));

  if (isPublicRoute) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('access_token');

  if (!accessToken) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)',
  ],
};

