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
