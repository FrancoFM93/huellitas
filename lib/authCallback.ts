import { supabase } from './supabase'
import { createOAuthCodeExchange } from './oauthExchange'

export const exchangeAuthCode = createOAuthCodeExchange({
  async exchange(code: string) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw error
    if (!data.session) throw new Error('missing_oauth_session')
    return data.session
  },
  async currentSession() {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return data.session
  },
  identity: session => session.user.id,
})
