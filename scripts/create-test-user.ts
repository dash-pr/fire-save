/**
 * Create a canonical test user in Supabase so local dev and smoke tests
 * don't require signing up a fresh account every time.
 *
 * Run:  npx tsx scripts/create-test-user.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in the environment (service role bypasses
 * email confirmation and RLS). Never run this against production.
 */

import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "test@stashy.local";
const TEST_PASSWORD = "Stashy-Test-2026!";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: existing } = await supabase.auth.admin.listUsers();
  const match = existing?.users.find((user) => user.email === TEST_EMAIL);
  if (match) {
    console.log(`User already exists: ${TEST_EMAIL} (id ${match.id})`);
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Test User" },
  });

  if (error) {
    console.error(`Failed to create user: ${error.message}`);
    process.exit(1);
  }

  console.log(`Created test user: ${TEST_EMAIL}`);
  console.log(`Password: ${TEST_PASSWORD}`);
  console.log(`User id:  ${data.user?.id}`);
}

void main();
