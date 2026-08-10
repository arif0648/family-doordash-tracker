// supabase/functions/send-push/index.ts
//
// Deno Edge Function: sends a Web Push notification to one or more
// user_settings.push_subscription rows. Triggered by a database webhook
// (e.g. on INSERT into income/expenses over a $50 threshold) or called
// directly from the client after a save.
//
// DEPLOYMENT REQUIREMENT (not fabricated here): needs real env vars
// VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT set via
// `supabase secrets set`. Without real deployment + real credentials this
// function cannot be verified to actually deliver a notification — hence
// NOT VERIFIED in the Final Verification Report.

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

interface PushRequestBody {
  family_id: string;
  exclude_user_id: string; // don't notify the person who made the change
  title: string;
  body: string;
}

serve(async (req) => {
  try {
    const { family_id, exclude_user_id, title, body }: PushRequestBody = await req.json();

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: members, error: membersError } = await supabaseAdmin
      .from('family_members')
      .select('user_id')
      .eq('family_id', family_id)
      .neq('user_id', exclude_user_id);

    if (membersError) throw membersError;

    const userIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('user_id, push_enabled, push_subscription')
      .in('user_id', userIds)
      .eq('push_enabled', true);

    if (settingsError) throw settingsError;

    let sent = 0;
    let failed = 0;

    for (const row of settings ?? []) {
      if (!row.push_subscription) continue;
      try {
        await webpush.sendNotification(row.push_subscription, JSON.stringify({ title, body }));
        sent++;
      } catch (err) {
        failed++;
        console.error(`Push failed for user ${row.user_id}:`, err);
      }
    }

    return new Response(JSON.stringify({ sent, failed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
