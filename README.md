# PagePulse

AI-powered SEO audit and monitoring tool for small businesses.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Auth & Database:** Supabase
- **AI:** Claude API (Anthropic)
- **Payments:** Stripe
- **Email:** Resend
- **Styling:** Tailwind CSS v4
- **Deployment:** Vercel

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/oshylabs-rgb/pagepulse.git
cd pagepulse
npm install
```

### 2. Set up Supabase

Follow the instructions in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Fill in the values from Supabase, Stripe, Anthropic, and Resend dashboards.

#### AI provider (Google Gemini)

PagePulse uses the Google Gemini API for SEO analysis. Two env vars are
relevant:

- `GEMINI_API_KEY` (required) — a valid Gemini API key.
- `GEMINI_MODEL` (optional) — overrides the default model
  (`gemini-1.5-flash`). Useful when your key/project does not have
  access to the default model.

Even with a valid `GEMINI_API_KEY`, a specific model can return
`403 PERMISSION_DENIED` if your Google Cloud project does not have
access to that model. If audits start failing with a permission-denied
error, try setting `GEMINI_MODEL` to a model your project can use (for
example `gemini-1.5-flash` or `gemini-1.5-pro`), or generate a new key
in a project that has access to the desired model enabled.

#### Email (Resend) — required for production

Resend rejects email to any recipient other than the account owner's own
address until you verify a sending domain. To enable signup confirmation
emails in production:

1. Verify your domain at [resend.com/domains](https://resend.com/domains).
2. Set `EMAIL_FROM` to a sender on that verified domain, e.g.
   `EMAIL_FROM=PagePulse <noreply@pagepulse.se>`.

While `EMAIL_FROM` is unset the app falls back to `onboarding@resend.dev`,
which is only suitable for local development.

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pricing

| Plan | Price | Sites | Audits/mo | Monitoring |
|------|-------|-------|-----------|------------|
| Free | £0 | 1 | 3 | No |
| Pro | £9/mo | 5 | 50 | Yes |
| Agency | £29/mo | 25 | 500 | Yes |

## Project Structure

```
app/
├── (auth)/          # Login, signup
├── (dashboard)/     # Protected dashboard
├── (marketing)/     # Pricing, privacy, terms
├── api/
│   ├── audit/       # SEO audit endpoints
│   ├── sites/       # Site CRUD
│   └── stripe/      # Checkout & webhooks
components/
lib/
├── supabase/        # Client & server helpers
├── claude.ts        # AI analysis
├── stripe.ts        # Stripe config
└── resend.ts        # Email
types/
```

## Operated by

Oshylabs Ltd — [oshylabs.com](https://www.oshylabs.com)
