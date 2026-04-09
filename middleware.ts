import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Public routes that never need a Supabase auth check
const PUBLIC_ROUTES = new Set([
  '/',
  '/login',
  '/signup',
  '/auth/confirm',
  '/auth/reset-password',
  '/pricing',
  '/privacy',
  '/terms',
  '/cookies',
])

function isPublicRoute(pathname: string): boolean {
  return (
    PUBLIC_ROUTES.has(pathname) ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/auth/')
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip Supabase call entirely for public routes — no auth needed
  if (isPublicRoute(pathname)) {
    return NextResponse.next({ request })
  }

  // For protected routes, create the Supabase client and check auth
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Redirect unauthenticated users to login
    if (!user) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // Redirect authenticated users away from auth pages
    if (
      user &&
      (pathname === '/login' || pathname === '/signup')
    ) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/dashboard'
      return NextResponse.redirect(redirectUrl)
    }

    return supabaseResponse
  } catch {
    // If Supabase times out or errors, let the request through
    // rather than crashing the entire site with a 504
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
