import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next')
  const requestedDestination =
    next?.startsWith('/') && !next.startsWith('//')
      ? new URL(next, requestUrl.origin)
      : null
  const destination =
    requestedDestination?.origin === requestUrl.origin
      ? requestedDestination
      : new URL('/', requestUrl.origin)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      const authUrl = new URL('/auth', requestUrl.origin)
      authUrl.searchParams.set('error', 'confirmation_failed')
      return NextResponse.redirect(authUrl)
    }
  } else {
    const authUrl = new URL('/auth', requestUrl.origin)
    authUrl.searchParams.set('error', 'confirmation_failed')
    return NextResponse.redirect(authUrl)
  }

  return NextResponse.redirect(destination)
}