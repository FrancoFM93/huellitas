// Supabase Edge Function — send-push
// Triggered via a Database Webhook on INSERT to the notifications table.
// Looks up the user's Expo push token and calls Expo's Push API.
//
// Deploy with: supabase functions deploy send-push
// Then set up a Database Webhook in the Supabase dashboard:
//   Table: notifications | Event: INSERT | URL: <your-function-url>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { record } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // service role needed to bypass RLS
    )

    // Get the push token stored on the user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('user_id', record.user_id)
      .single()

    if (!profile?.push_token) {
      return new Response('No push token for user', { status: 200 })
    }

    // Send via Expo Push API (works for both iOS and Android)
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: profile.push_token,
        title: record.title,
        body: record.body,
        data: record.metadata ?? {},
        sound: 'default',
      }),
    })

    const json = await res.json()
    return new Response(JSON.stringify(json), { status: 200 })
  } catch (err) {
    console.error('send-push error:', err)
    return new Response('Internal error', { status: 500 })
  }
})
