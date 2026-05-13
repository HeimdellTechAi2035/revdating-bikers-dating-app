import { createClient } from '@supabase/supabase-js';
import type { Config } from '@netlify/functions';

// Runs every day at 10:00 AM UTC
export const config: Config = {
  schedule: '0 10 * * *',
};

export default async () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Find users who:
  // - Signed up more than 24 hours ago
  // - Haven't completed onboarding
  // - Haven't been sent a reminder yet (or it was sent more than 7 days ago)
  const { data: incomplete, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('onboarding_complete', false)
    .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .or(`onboarding_reminder_sent_at.is.null,onboarding_reminder_sent_at.lt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}`);

  if (error) {
    console.error('Failed to fetch incomplete profiles:', error.message);
    return new Response('Error fetching profiles', { status: 500 });
  }

  if (!incomplete || incomplete.length === 0) {
    console.log('No incomplete profiles to remind today.');
    return new Response('No reminders needed', { status: 200 });
  }

  console.log(`Sending reminders to ${incomplete.length} user(s)...`);

  let sent = 0;
  let failed = 0;

  for (const profile of incomplete) {
    // Get email from auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(profile.id);
    if (authError || !authUser?.user?.email) {
      console.error(`No auth user for profile ${profile.id}`);
      failed++;
      continue;
    }

    const email = authUser.user.email;

    // Send magic link → lands on /onboarding
    const { error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding`,
      },
    });

    if (linkError) {
      console.error(`Failed to send reminder to ${email}:`, linkError.message);
      failed++;
      continue;
    }

    // Mark reminder sent
    await supabase
      .from('profiles')
      .update({ onboarding_reminder_sent_at: new Date().toISOString() })
      .eq('id', profile.id);

    console.log(`Reminder sent to ${profile.display_name} (${email})`);
    sent++;
  }

  const summary = `Onboarding reminders: ${sent} sent, ${failed} failed.`;
  console.log(summary);
  return new Response(summary, { status: 200 });
};
