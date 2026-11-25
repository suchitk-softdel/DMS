import { useEffect, useRef, useSyncExternalStore } from 'react'
import { env } from '@/config/env'

// Live updates from the backend (Server-Sent Events, GET /api/live).
// One shared connection for the whole app, opened while at least one screen
// listens and closed when none does. The browser reconnects by itself if the
// connection drops. Events only say what changed ({ topic, action, id,
// dealerId, dealerName, by }); screens then refresh their data.

let source = null
let status = 'off' // 'off' | 'connecting' | 'live'
const eventListeners = new Set()
const statusListeners = new Set()

function setStatus(next) {
  if (status === next) return
  status = next
  statusListeners.forEach((listener) => listener())
}

function connect() {
  if (source || env.useMockData || typeof EventSource === 'undefined') return
  setStatus('connecting')
  source = new EventSource(`${env.apiBaseUrl}/live`)
  source.addEventListener('ready', () => setStatus('live'))
  source.addEventListener('warranty', (message) => {
    const event = JSON.parse(message.data)
    eventListeners.forEach((listener) => listener(event))
  })
  source.onerror = () => setStatus(source?.readyState === EventSource.CLOSED ? 'off' : 'connecting')
}

function disconnect() {
  source?.close()
  source = null
  setStatus('off')
}

// Listen to live events while the component is shown.
// handler(event) is always the latest one passed (no need to memoise it).
export function useLiveEvents(handler) {
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })
  useEffect(() => {
    const listener = (event) => handlerRef.current(event)
    eventListeners.add(listener)
    connect()
    return () => {
      eventListeners.delete(listener)
      if (!eventListeners.size) disconnect()
    }
  }, [])
}

// 'off' | 'connecting' | 'live', for the "Live" indicator.
export function useLiveStatus() {
  return useSyncExternalStore(
    (onChange) => {
      statusListeners.add(onChange)
      return () => statusListeners.delete(onChange)
    },
    () => status,
  )
}

// Short message for a live event caused by someone else, e.g. for a toast.
export function describeLiveEvent(event) {
  switch (event.action) {
    case 'claim.submitted':
      return `New warranty claim ${event.id} from ${event.dealerName}`
    case 'registration.created':
      return `Warranty registered: ${event.id} (${event.dealerName})`
    case 'investigation.opened':
      return `${event.dealerName} flagged for investigation`
    case 'investigation.closed':
      return `Investigation of ${event.dealerName} closed`
    default:
      return null
  }
}
