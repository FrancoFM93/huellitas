// Deploy with: supabase functions deploy send-push
// Set PUSH_WEBHOOK_SECRET using Supabase secrets and configure the notifications
// INSERT webhook with the matching x-webhook-secret header. Keep this secret
// server-side; it must never be an EXPO_PUBLIC_ environment variable.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createPushHandler } from './handler.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

serve(createPushHandler({
  webhookSecret: Deno.env.get('PUSH_WEBHOOK_SECRET'),
  getNotification: async (id) => supabase.from('notifications')
    .select('id, user_id, title, body, metadata').eq('id', id).maybeSingle(),
  getPushToken: async (userId) => supabase.from('profiles')
    .select('push_token').eq('user_id', userId).maybeSingle(),
  send: (message) => fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(message),
  }),
}))
