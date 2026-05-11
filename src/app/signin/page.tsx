"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AppleButton,
  AuthCard,
  AuthHeading,
  AuthShell,
  Divider,
  ErrorBanner,
  FieldError,
  GoogleButton,
  Label,
  PrimaryButton,
  inputClass,
} from "@/components/auth/auth-card";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function authErrorMessage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/invalid login credentials/i.test(raw)) return "Incorrect email or password.";
  if (/email not confirmed/i.test(raw)) return "Confirm your email before signing in.";
  return raw;
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInInner />
    </Suspense>
  );
}

function SignInInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthErrorRaw = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(authErrorMessage(oauthErrorRaw));
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setEmailError(null);
    setPasswordError(null);
    setBannerError(null);

    if (!email) {
      setEmailError("Email is required.");
      return;
    }
    if (!password) {
      setPasswordError("Password is required.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      const message = authErrorMessage(error.message) ?? "Unable to sign in.";
      if (/incorrect|credentials/i.test(message)) setPasswordError(message);
      else setBannerError(message);
      return;
    }

    router.push("/app/budget");
    router.refresh();
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setBannerError(null);
    setOauthLoading(true);
    const supabase = createSupabaseBrowserClient();
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${origin}/auth/callback` },
    });
    if (error) {
      setOauthLoading(false);
      setBannerError(error.message);
    }
  };

  return (
    <AuthShell>
      <div className="w-full max-w-[400px]">
        <AuthCard>
          <AuthHeading title="Welcome back" subtitle="Sign in to your account" />
          <ErrorBanner message={bannerError} />
          <div className="mt-5">
            <GoogleButton onClick={() => handleOAuth("google")} disabled={oauthLoading} />
            <AppleButton onClick={() => handleOAuth("apple")} disabled={oauthLoading} />
          </div>
          <Divider />
          <form onSubmit={handleSubmit} noValidate>
            <div>
              <Label htmlFor="email">Email</Label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass(Boolean(emailError))}
              />
              <FieldError message={emailError} />
            </div>
            <div className="mt-4">
              <Label htmlFor="password">Password</Label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass(Boolean(passwordError))}
              />
              <FieldError message={passwordError} />
              <div className="mt-2 text-right">
                <Link href="/signin/reset" className="text-xs font-medium text-[#4A7CFF] hover:underline">
                  Forgot password?
                </Link>
              </div>
            </div>
            <PrimaryButton loading={loading}>Sign in</PrimaryButton>
          </form>
        </AuthCard>
        <p className="mt-6 text-center text-sm text-[#6B7280]">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-[#4A7CFF] hover:underline">
            Get started
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
