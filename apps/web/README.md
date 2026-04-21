# @flow/web

Next.js 15 App Router application for Flow OS.

## Local Development

1. Start Supabase: `supabase start`
2. Copy `.env.example` to `.env.local` and fill in values
3. Run `pnpm dev`

## Testing Auth Locally

Supabase local uses [Inbucket](http://localhost:54324) for email capture. When you request a magic link:

1. Navigate to the login page at `http://localhost:3000/login`
2. Enter your email address
3. Open [Inbucket](http://localhost:54324) in another tab
4. Find the magic link email and click the link
5. You'll be authenticated and redirected

## Environment Variables

See `.env.example` for required variables.
