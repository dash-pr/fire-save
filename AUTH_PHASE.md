# Auth Phase — Full Prompt

Read GOALS.md and FEATURE_UPDATE.md before touching anything. This prompt adds authentication, a public landing page, and an onboarding flow to the existing app. Do not touch any existing authenticated screens, business logic, API routes, or calculation code. The existing app continues to work exactly as it does today — you are adding a front door to it.
Save this prompt to AUTH_PHASE.md in the project root before writing any code.

## What you are building

Three new surfaces: a public marketing landing page, an auth flow (sign up / sign in), and a post-signup onboarding screen that collects the user's default assumptions. After onboarding, the user lands on the Budget screen exactly as it works today. The app is called Stashy.

## Auth provider

Use Supabase Auth. It is already in the stack. Enable three sign-in methods in the Supabase dashboard: Google OAuth, Apple OAuth, and email/password. Do not add any other providers. Configure the OAuth redirect URLs for both local development (http://localhost:3000) and the production Vercel domain. Document the exact Supabase dashboard steps needed in a AUTH_SETUP.md file so they are not forgotten.
For Vercel deployment: add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY to Vercel environment variables. Add a NEXT_PUBLIC_APP_URL variable set to the production domain. Document all required environment variables in .env.example.

## Route structure changes

The app currently has no auth. Add the following route structure:
- `/` — public landing page (new)
- `/signin` — sign in page (new)
- `/signup` — sign up page (new)
- `/onboarding` — post-signup setup (new, requires auth)
- `/app/budget` — existing budget screen (now requires auth)
- `/app/transactions` — existing (now requires auth)
- `/app/debt` — existing (now requires auth)
- `/app/goals` — existing (now requires auth)
- `/app/investments` — existing (now requires auth)
- `/app/forecast` — existing (now requires auth)
- `/app/reports` — existing (now requires auth)
- `/app/settings` — existing (now requires auth)

All /app/* routes are protected. Unauthenticated users hitting any /app/* route are redirected to /signin. Authenticated users hitting /signin or /signup are redirected to /app/budget. Authenticated users who have not completed onboarding are redirected to /onboarding regardless of what /app/* route they try to access. Use Next.js middleware for all redirect logic — handle it at the edge, not inside each page component.
Add a onboardingComplete boolean flag to the user's profile in Supabase. Middleware checks this flag. Store it in a profiles table (see schema below).

## Database additions

Add a profiles table in Supabase (not Prisma — use Supabase's own auth schema integration):

```sql
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  onboarding_complete boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);
```

Create a Supabase function that automatically inserts a profile row when a new user signs up:

```sql
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

Also update the existing Prisma schema: add supabaseUserId (String, unique) to every top-level model that is currently unscoped (Account, Transaction, RecurringExpense, Budget, SavingsGoal, CreditDebt, Investment, FatfireSettings, etc.). Add a migration. This scopes all existing data to a real user rather than the hardcoded single-user MVP approach. The seed file should remain functional for local development by using a hardcoded test UUID.

## Landing page — /

This is the most visible surface of the app. It must feel premium, calm, and specific. Not generic SaaS. The name is Stashy and the tagline is: "Your path to FATFire, clearly mapped." Secondary line: "Track your money, eliminate your debt, and project exactly when you can stop working — built for Japan."

### Layout

Single-page scroll. Sections in order: Nav, Hero, Feature highlights, How it works, Social proof placeholder, CTA footer.

### Nav

Fixed top nav. Left: Stashy wordmark (custom logotype feel — use a clean sans-serif, slightly wider letter-spacing, no icon/logo mark needed). Right: "Sign in" link (text, no button style) and "Get started" button (filled, primary color). Nav has a very subtle backdrop blur and a 1px bottom border that appears only on scroll (use an IntersectionObserver on a zero-height sentinel element at the top of the page). On scroll the nav background transitions from fully transparent to the canvas color with the border. Nav height 64px.

### Hero section

Full viewport height. Dark background — use the sidebar dark navy #1C1F3A as the hero background, making this section feel like a window into the app. This creates immediate contrast and premium feel. Center-aligned content.

Top: a subtle pill badge — white text on white/8% opacity background, small border — reading "Built for FATFire in Japan 🇯🇵". This is a trust and specificity signal.

Headline: large, white, medium weight, not bold. Two lines: "Know exactly" on line one, "when you're free." on line two. The word "free" should be in the primary accent blue #4A7CFF. Use a display font size — text-6xl or larger on desktop.

Subheadline: one sentence, muted white/70%, base size. "Stashy tracks your spending, models your NISA and iDeCo, and runs thousands of retirement simulations so you always know where you stand."

Two CTAs below: "Start for free" (primary filled button, white background, dark text) and "See how it works" (ghost button, white border, white text). Buttons are side by side, centered.

Below the buttons: a subtle social proof line in muted white/50% — "No credit card required · Works with Japanese bank accounts · Runs on your data, not ours."

Below that: a product screenshot or UI mockup. Take a screenshot of the actual Budget screen at 1440px width and display it as a framed browser window preview (add a subtle browser chrome frame around it — three colored dots top left, a fake URL bar). Apply a subtle 20-degree perspective tilt (CSS transform: perspective(1200px) rotateX(8deg)) to make it look like the app is emerging from the page. Add a soft gradient below the image that fades from #1C1F3A to transparent so the hero fades into the next section.

### Feature highlights section

White background section. Section heading: "Everything you need, nothing you don't." centered, large, medium weight.

Three feature columns side by side on desktop, stacked on mobile. Each column: an inline SVG icon (40px, drawn in the primary blue), a short feature title (medium weight), and two sentences of description.

- Column 1 — Budget with intention. Icon: a simple allocation/pie shape. Text: "Assign every yen a job before the month begins. See exactly how much is left to invest after your fixed costs and goals are covered."
- Column 2 — Model your FATFire. Icon: a simple upward trajectory line. Text: "Run Bear, Base, and Bull scenarios with 500 Monte Carlo simulations. See your probability of retiring early under realistic Japanese market conditions."
- Column 3 — Japan-first by design. Icon: a simple torii gate outline or abstract building. Text: "Built around NISA, iDeCo, and ribo-barai debt. Knows the 5-year mortgage rule. Understands how Japanese tax wrappers compound over time."

### How it works section

Off-white background #F5F4F0. Section heading: "Up and running in minutes." Three numbered steps in a horizontal row on desktop.

- Step 1 — "Set up your accounts." Short description: add your savings, credit cards, and investment accounts. Takes two minutes.
- Step 2 — "Assign your money." Short description: enter your income, assign it to categories, and see what is left to invest.
- Step 3 — "See your FIRE date." Short description: the forecast engine calculates your FATFire date based on real data, not assumptions.

Each step has: a large step number (display size, very light weight, in muted color — almost decorative), the step title in medium weight, the description in regular weight muted text.

### CTA footer section

Dark navy background again #1C1F3A. Centered. Headline: "Your financial independence starts now." white, large, medium weight. One CTA button: "Create your free account" in the primary blue. Below: "Already have an account? Sign in" as a muted text link.

## Sign in page — /signin

Centered card layout. Card is white, shadow-lg, rounded-2xl, 400px wide on desktop, full width on mobile with 24px margin. Canvas background #F5F4F0.

Top of card: Stashy wordmark, centered, 24px top padding.

Below wordmark: page heading "Welcome back" in large medium-weight text. Subheading: "Sign in to your account" in muted small text.

Auth options in this order: Google sign-in button, Apple sign-in button, a thin divider with "or" centered, email input, password input, "Forgot password?" link right-aligned below password field, "Sign in" primary button full width.

Google button: white background, 1px border in #E5E7EB, Google logo SVG on left, "Continue with Google" centered text. Full width. Standard Google brand guidelines.

Apple button: black background, white Apple logo SVG on left, "Continue with Apple" in white centered text. Full width.

Both OAuth buttons have 44px height (touch target compliance) and rounded-lg. Subtle hover: shadow-sm appears on hover, 100ms transition.

Email and password inputs: label above (not placeholder-as-label), 44px height, rounded-lg, border border-gray-200 default, border-blue-500 ring-2 ring-blue-500/20 on focus. Full width.

"Sign in" button: primary blue #4A7CFF, white text, full width, 44px height, rounded-lg. Loading state: spinner replaces text while auth is processing. Disabled while loading.

Below the card: "Don't have an account? Get started" link centered, below the card not inside it.

Error states: inline below the relevant field for email/password errors. For OAuth errors: a red banner at the top of the card. Use specific messages — "Incorrect password" not "An error occurred."

## Sign up page — /signup

Same card layout as sign in. Heading: "Create your account". Subheading: "Free forever. No credit card needed."

Same OAuth buttons in same order. Same divider. Then: full name input, email input, password input (with a subtle strength indicator — a 4-segment bar below the field that fills green as the password gets stronger, triggered by length and character variety), "Create account" primary button.

Password requirements shown below the strength bar as small text: "At least 8 characters." No other requirements — keep it simple.

Below card: "Already have an account? Sign in" link.

On successful signup with email: show an inline success state inside the card — replace the form with: a checkmark icon, "Check your email" heading, "We sent a confirmation link to [email]. Click it to activate your account." Do not navigate away.

On successful OAuth signup: navigate directly to /onboarding.

## Onboarding screen — /onboarding

This screen collects the FATFire assumptions and basic profile data that seed the forecast engine and budget defaults. It runs after sign-up and never again (unless the user resets from Settings). It must feel like setup, not a form. Progress through steps should feel like forward momentum, not data entry.

### Layout

Full screen. No sidebar. No nav. Just the Stashy wordmark top-left, a step indicator top-right (Step 1 of 4), and the centered content. Background is the canvas color #F5F4F0. A single "Back" link in the top-left (below the wordmark) on steps 2+.

The step indicator is a simple horizontal progress bar — 4 segments, filled segments in primary blue, unfilled in #E5E7EB. Below it: "Step X of 4" in muted small text.

Each step occupies the full screen area below the nav bar, vertically centered. Max content width 480px, centered horizontally. Transitions between steps: horizontal slide — new step slides in from the right, old step slides out to the left, 250ms ease-out using Framer Motion. Do not use fade — slide gives a sense of linear progress.

### Step 1 — About you

Heading: "Let's start with the basics." Subheading: "We'll use this to calculate your FATFire timeline."

Fields: Your name (text input, used for personalisation only), Your current age (number input, min 18 max 70), Your target retirement age (number input, min current age +1 max 80).

Below fields: a simple motivational callout that updates live as the user types their ages: "That's X years to reach FATFire. Let's make it happen." in muted italic text.

Continue button at the bottom, primary blue, full width of the form (480px). Disabled until all three fields have valid values.

### Step 2 — Your money

Heading: "Tell us about your income and savings." Subheading: "Rough numbers are fine — you can update these anytime."

Fields: Monthly take-home income in ¥ (CurrencyInput component, JPY formatted), Current total savings in ¥ (CurrencyInput), Current investment balance in ¥ (CurrencyInput, label: "NISA, iDeCo, brokerage combined").

Below the three inputs, a passive callout: "Your net worth so far: ¥X,XXX,XXX" calculated as savings plus investments, updated live.

Continue button. Disabled until income field has a value greater than zero.

### Step 3 — Your retirement target

Heading: "What does FATFire look like for you?" Subheading: "How much do you want to spend per year in retirement?"

Single primary input: Target annual retirement spend in ¥ (CurrencyInput, large display size — make this input prominent). Below it: a preset row — four pill buttons the user can tap to quickly fill the input: ¥4,000,000 / ¥6,000,000 / ¥8,000,000 / ¥12,000,000. These are labelled below in small muted text: "Comfortable", "FATFire", "FAT FATFire", "Luxury". Tapping a pill fills the input.

Live callout below: "Your FATFire target portfolio: ¥XX,XXX,XXX" calculated as targetSpend / 0.035 (3.5% SWR default). Update as the user types.

Secondary field below: "Monthly investment contribution" in ¥ (CurrencyInput, smaller). Label: "How much can you invest each month?"

Continue button.

### Step 4 — Your biggest financial obligation

Heading: "Any significant debt?" Subheading: "This helps Stashy give you an accurate starting picture."

This step is optional — add a "Skip for now, I'll add this later" text link below the continue button.

Three toggle cards in a row — tap to select one or more. Cards are outlined by default, filled (blue border, blue tint background) when selected. Card 1: "Mortgage / Rent" with a small home icon. Card 2: "Credit card debt" with a small card icon. Card 3: "No significant debt" with a checkmark icon. Selecting "No significant debt" deselects the others.

If "Mortgage / Rent" is selected, show below: a field for approximate monthly housing cost in ¥. If "Credit card debt" is selected, show below: a field for approximate total credit card balance in ¥.

Continue button changes to "Finish setup" on this step.

### On completion

Mark onboardingComplete = true in the profiles table. Save all collected values to FatfireSettings and any relevant Prisma records (create the user's first MonthlyIncome entry for the current month using the income entered, create Investment entries if investment balance > 0, create CreditDebt entry if credit card balance entered). Navigate to /app/budget. Show a welcome toast (one time only, use sessionStorage to track): "Welcome to Stashy, [name]. Your budget is ready to set up."

## Authenticated app shell changes

Add a user menu to the top-right of the existing sidebar or top bar. Show the user's avatar (from OAuth if available, first-letter fallback if not) and name. Clicking opens a small dropdown: "Settings", "Sign out". Sign out calls supabase.auth.signOut() and redirects to /signin.
On all /app/* routes, the Supabase session is fetched server-side using createServerComponentClient. Pass the user to client components via context. Do not fetch the session client-side on every page — fetch it once in the root layout and pass it down.

## Middleware implementation

Create middleware.ts at the project root:

```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  const isAppRoute = req.nextUrl.pathname.startsWith('/app')
  const isAuthRoute = ['/signin', '/signup'].includes(req.nextUrl.pathname)
  const isOnboarding = req.nextUrl.pathname === '/onboarding'

  if (isAppRoute && !session) {
    return NextResponse.redirect(new URL('/signin', req.url))
  }

  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/app/budget', req.url))
  }

  if (session && !isOnboarding && !isAuthRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', session.user.id)
      .single()

    if (profile && !profile.onboarding_complete && isAppRoute) {
      return NextResponse.redirect(new URL('/onboarding', req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/app/:path*', '/signin', '/signup', '/onboarding']
}
```

## Design consistency rules for new surfaces

The landing page hero uses dark navy — this is the only place in the entire app where a dark background appears outside the sidebar. Every other new surface (sign in, sign up, onboarding) uses the canvas color #F5F4F0 as background.
All new form inputs must use the same input component style as the existing app — 44px height, rounded-lg, label above not inside, blue ring on focus.
All new buttons must use the same button variants as the existing app — primary (blue fill), ghost (outline), destructive (red fill). No new button variants.
Typography on new surfaces: same DM Sans, same four-level hierarchy, same tabular numerals for all currency.
The Stashy wordmark on the landing page, sign in, sign up, and onboarding: use the text "Stashy" in DM Sans medium weight, slightly wider letter-spacing (tracking-wide), in the dark navy color on light backgrounds and white on dark backgrounds. No icon. No gradient. No drop shadow. The name alone is the brand mark.

## Build phases — commit after each

- Phase 1: Supabase auth setup. Enable providers in Supabase dashboard (document steps in AUTH_SETUP.md). Create profiles table and trigger via Supabase SQL editor. Update Prisma schema to add supabaseUserId to all models. Run migration. Update seed with test UUID. Commit: "auth: supabase setup profiles table and schema migration".
- Phase 2: Middleware and route protection. Create middleware.ts. Move all existing app pages under /app/ path prefix. Verify redirects work correctly for all three states (unauthenticated, authenticated-no-onboarding, authenticated-onboarded). Commit: "auth: middleware and protected routes".
- Phase 3: Sign in and sign up pages. Build both pages with all three auth methods. Wire up Supabase auth calls. Handle all error states. Commit: "auth: signin and signup pages".
- Phase 4: Onboarding flow. Build all four steps with slide transitions. Wire up completion to profiles table and FatfireSettings. Welcome toast on first budget screen load. Commit: "auth: onboarding flow".
- Phase 5: Landing page. Build all sections. Screenshot the budget screen for the hero mockup. Verify on 1280px and 1440px. Commit: "landing: public marketing page".
- Phase 6: App shell user menu. Add avatar and dropdown to existing sidebar. Wire sign out. Commit: "auth: user menu and sign out".
- Phase 7: Vercel deployment. Add all environment variables to Vercel. Add production OAuth redirect URLs to Supabase. Deploy. Smoke-test the full flow: land on /, click get started, sign up with Google, complete onboarding, reach budget screen, sign out, sign back in. Commit: "deploy: auth flow production verified".

## Definition of done

The following must all work in production on Vercel before this phase is complete:
Sign up with Google redirects to onboarding then budget. Sign up with Apple redirects to onboarding then budget. Sign up with email sends a confirmation email and shows the check-your-email state. Confirming the email link redirects to onboarding. Sign in with an existing account skips onboarding and goes to budget. An unauthenticated user visiting /app/budget is redirected to /signin. After signing out, the browser back button does not show the authenticated app. The landing page loads in under 2 seconds on a fast connection. The onboarding slide transitions work without layout shift. All currency inputs on onboarding format correctly as the user types. TypeScript compiles with no errors. No console errors in production.
