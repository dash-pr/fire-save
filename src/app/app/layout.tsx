import { redirect } from "next/navigation";
import AppShell from "@/components/app/app-shell";
import type { AppUser } from "@/components/app/user-menu";
import { loadAppInitialData } from "@/lib/app-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete, full_name, avatar_url, email")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_complete) {
    redirect("/onboarding");
  }

  const appUser: AppUser = {
    id: user.id,
    email: profile.email ?? user.email ?? null,
    fullName: profile.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? null,
    avatarUrl: profile.avatar_url ?? (user.user_metadata?.avatar_url as string | undefined) ?? null,
  };

  const initialData = await loadAppInitialData();

  return (
    <AppShell initialData={initialData} user={appUser}>
      {children}
    </AppShell>
  );
}
