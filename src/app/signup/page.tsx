"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
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

function passwordStrength(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

function StrengthBar({ password }: { password: string }) {
  const score = passwordStrength(password);
  return (
    <div className="mt-2 grid grid-cols-4 gap-1">
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className={`h-1 rounded-full transition ${
            index < score ? "bg-[#16A34A]" : "bg-[#E5E7EB]"
          }`}
        />
      ))}
    </div>
  );
}

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const strength = useMemo(() => passwordStrength(password), [password]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNameError(null);
    setEmailError(null);
    setPasswordError(null);
    setBannerError(null);

    if (!fullName.trim()) {
      setNameError("Full name is required.");
      return;
    }
    if (!email) {
      setEmailError("Email is required.");
      return;
    }
    if (password.length < 8) {
      setPasswordError("At least 8 characters.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
      },
    });
    setLoading(false);

    if (error) {
      if (/already registered|already exists/i.test(error.message)) {
        setEmailError("An account with this email already exists.");
      } else {
        setBannerError(error.message);
      }
      return;
    }

    setSentTo(email);
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setBannerError(null);
    setOauthLoading(true);
    const supabase = createSupabaseBrowserClient();
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${origin}/auth/callback?next=/onboarding` },
    });
    if (error) {
      setOauthLoading(false);
      setBannerError(error.message);
    }
  };

  if (sentTo) {
    return (
      <AuthShell>
        <div className="w-full max-w-[400px]">
          <AuthCard>
            <div className="mt-6 flex flex-col items-center text-center">
              <CheckCircle2 className="h-10 w-10 text-[#16A34A]" />
              <h1 className="mt-4 text-[22px] font-medium tracking-tight text-slate-900">Check your email</h1>
              <p className="mt-2 text-sm text-[#6B7280]">
                We sent a confirmation link to <span className="font-medium text-slate-900">{sentTo}</span>. Click it to
                activate your account.
              </p>
            </div>
          </AuthCard>
          <p className="mt-6 text-center text-sm text-[#6B7280]">
            Didn&apos;t receive it?{" "}
            <button
              type="button"
              className="font-medium text-[#4A7CFF] hover:underline"
              onClick={() => router.refresh()}
            >
              Try again
            </button>
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="w-full max-w-[400px]">
        <AuthCard>
          <AuthHeading title="Create your account" subtitle="Free forever. No credit card needed." />
          <ErrorBanner message={bannerError} />
          <div className="mt-5">
            <GoogleButton onClick={() => handleOAuth("google")} disabled={oauthLoading} />
            <AppleButton onClick={() => handleOAuth("apple")} disabled={oauthLoading} />
          </div>
          <Divider />
          <form onSubmit={handleSubmit} noValidate>
            <div>
              <Label htmlFor="name">Full name</Label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className={inputClass(Boolean(nameError))}
              />
              <FieldError message={nameError} />
            </div>
            <div className="mt-4">
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
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass(Boolean(passwordError))}
              />
              <StrengthBar password={password} />
              <p className="mt-1.5 text-xs text-[#6B7280]">At least 8 characters.</p>
              <FieldError message={passwordError} />
            </div>
            <PrimaryButton loading={loading} disabled={strength === 0 && password.length > 0}>
              Create account
            </PrimaryButton>
          </form>
        </AuthCard>
        <p className="mt-6 text-center text-sm text-[#6B7280]">
          Already have an account?{" "}
          <Link href="/signin" className="font-medium text-[#4A7CFF] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
