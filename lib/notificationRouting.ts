const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Only route to known app screens using database UUIDs, never a supplied URL. */
export function getNotificationPath(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const data = metadata as Record<string, unknown>
  const routes = [
    ['session_id', '/monitoring/'],
    ['contract_id', '/adoption/contract/'],
    ['thread_id', '/messages/'],
    ['post_id', '/adoption/'],
    ['report_id', '/missing/'],
    ['missing_report_id', '/missing/'],
    ['alert_id', '/alerts/'],
    ['fundraiser_id', '/fundraising/'],
  ] as const

  for (const [key, prefix] of routes) {
    const id = data[key]
    if (typeof id === 'string' && UUID.test(id)) return `${prefix}${id}`
  }

  // Broadcasts have no standalone detail screen. Open their notification inbox.
  if (typeof data.broadcast_id === 'string' && UUID.test(data.broadcast_id)) {
    return '/(tabs)/profile'
  }
  return null
}
