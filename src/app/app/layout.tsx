import { redirect } from "next/navigation";
import AppShell from "@/components/app/app-shell";
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
    .select("onboarding_complete")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_complete) {
    redirect("/onboarding");
  }

  const initialData = await loadAppInitialData();

  return <AppShell initialData={initialData}>{children}</AppShell>;
}
