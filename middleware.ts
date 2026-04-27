import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that are always public (no auth required, no redirect)
const PUBLIC_PATHS = new Set([
  '/',
  '/pricing',
  '/privacy',
  '/terms',
  '/cookies',
])

// Auth routes — public, but logged-in users should be redirected to dashboard
const AUTH_PATHS = new Set(['/login', '/signup'])

// Routes that bypass middleware entirely (no Supabase call at all)
function shouldBypassAuthCheck(pathname: string): boolean {
  return (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/auth/')
  )
}

// Run getUser() with a timeout so the site never 504s on Supabase slowness
async function getUserWithTimeout(
  supabase: ReturnType<typeof createServerClient>,
  timeoutMs = 3000
) {
  return Promise.race([
    supabase.auth.getUser(),
    new Promise<{ data: { user: null }; error: Error }>((resolve) =>
      setTimeout(
        () => resolve({ data: { user: null }, error: new Error('timeout') }),
        timeoutMs
      )
    ),
  ])
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Bypass middleware completely for /api/auth/* and /auth/* (callbacks etc.)
  if (shouldBypassAuthCheck(pathname)) {
    return NextResponse.next({ request })
  }

  // ALWAYS create the Supabase client so cookies are refreshed.
  // This is critical: skipping this on /login means signed-in cookies
  // never sync to the server and users can't actually log in.
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
    } = await getUserWithTimeout(supabase)

    // Logged-in user hitting /login or /signup → redirect to dashboard
    if (user && AUTH_PATHS.has(pathname)) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/dashboard'
      redirectUrl.search = ''
      return NextResponse.redirect(redirectUrl)
    }

    // Public pages — let everyone through (cookies still get refreshed above)
    if (PUBLIC_PATHS.has(pathname) || AUTH_PATHS.has(pathname)) {
      return supabaseResponse
    }

    // Protected route + no user → redirect to login
    if (!user) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // Authenticated user on protected route → continue
    return supabaseResponse
  } catch {
    // Never 504 on Supabase errors — fall through with refreshed cookies
    return supabaseResponse
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
