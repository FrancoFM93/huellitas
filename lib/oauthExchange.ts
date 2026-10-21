interface ExchangeDependencies<T> {
  exchange: (code: string) => Promise<T>
  currentSession: () => Promise<T | null>
  identity: (session: T) => string
}

// Both the native browser response and the router callback can observe one PKCE
// code. Remember only the consumed code/account, never a replayable session.
export function createOAuthCodeExchange<T>(deps: ExchangeDependencies<T>) {
  const pending = new Map<string, Promise<T>>()
  let completed: { code: string; accountId: string } | null = null
  return (code: string): Promise<T> => {
    if (!code.trim()) return Promise.reject(new Error('missing_oauth_code'))
    const existing = pending.get(code)
    if (existing) return existing
    if (completed?.code === code) {
      const accountId = completed.accountId
      return deps.currentSession().then(session => {
        if (session && deps.identity(session) === accountId) return session
        throw new Error('oauth_code_already_consumed')
      })
    }
    const promise = Promise.resolve().then(() => deps.exchange(code)).then(session => {
      completed = { code, accountId: deps.identity(session) }
      return session
    })
    pending.set(code, promise)
    const clear = () => { pending.delete(code) }
    void promise.then(clear, clear)
    return promise
  }
}
