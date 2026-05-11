import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const AUTH_ROUTES = new Set(["/signin", "/signup"]);

export async function middleware(req: NextRequest) {
  const { res, session, supabase } = await updateSession(req);
  const { pathname } = req.nextUrl;

  const isAppRoute = pathname.startsWith("/app");
  const isAuthRoute = AUTH_ROUTES.has(pathname);
  const isOnboarding = pathname === "/onboarding";

  if (isAppRoute && !session) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL("/app/budget", req.url));
  }

  if (session && supabase && (isAppRoute || isOnboarding)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_complete")
      .eq("id", session.user.id)
      .single();

    const onboarded = profile?.onboarding_complete === true;

    if (!onboarded && isAppRoute) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }
    if (onboarded && isOnboarding) {
      return NextResponse.redirect(new URL("/app/budget", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/app/:path*", "/signin", "/signup", "/onboarding"],
};
