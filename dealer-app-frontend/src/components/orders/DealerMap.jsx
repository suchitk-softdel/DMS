import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useEffect, useRef, useState } from 'react'
import { env } from '@/config/env'

// Dealer map on Order Approvals: one red pin per dealer at its latitude and
// longitude (Google Maps). Hovering a pin shows a dark, see-through tooltip
// with the dealer's details; clicking keeps it open until the map is clicked.
//
// dealers: [{ id, name, city, state, region, tier, status, latitude, longitude, pending }]

const STATUS_LABELS = { active: 'Active', onHold: 'On hold', pending: 'Pending' }
const statusLabel = (dealer) => STATUS_LABELS[dealer.status] ?? dealer.status
const US_CENTER = { lat: 39.5, lng: -98.35 }

// Classic red map pin with a dark centre (tip at the bottom middle).
const PIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 24 34">' +
  '<path d="M12 1C6.48 1 2 5.48 2 11c0 7.5 10 22 10 22s10-14.5 10-22C22 5.48 17.52 1 12 1z" fill="#EA4335" stroke="#B31412" stroke-width="1.2"/>' +
  '<circle cx="12" cy="11" r="3.6" fill="#7A0C0C"/></svg>'
const PIN_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(PIN_SVG)}`

// Loads the Google Maps script once for the whole app.
let loading = null
function loadGoogleMaps() {
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps)
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      window.__dealerMapReady = () => resolve(window.google.maps)
      const params = new URLSearchParams({ callback: '__dealerMapReady', v: 'weekly', loading: 'async' })
      if (env.googleMapsApiKey) params.set('key', env.googleMapsApiKey)
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?${params}`
      script.async = true
      script.onerror = () => {
        loading = null
        script.remove()
        reject(new Error('Google Maps could not be loaded. Check the internet connection.'))
      }
      document.head.appendChild(script)
    })
  }
  return loading
}

// Tooltip content (built with textContent: no HTML from data).
function tooltipContent(dealer) {
  const box = document.createElement('div')
  const line = (text, style = '') => {
    const row = document.createElement('div')
    row.textContent = text
    row.style.cssText = style
    box.appendChild(row)
  }
  line(dealer.name, 'font-weight: 700; font-size: 14px; margin-bottom: 3px')
  line(`${dealer.city}, ${dealer.state} · ${dealer.region}`)
  line(`${dealer.tier} · ${statusLabel(dealer)}`)
  line(dealer.pending ? `${dealer.pending} order${dealer.pending === 1 ? '' : 's'} waiting for approval` : 'No orders waiting')
  line(`${dealer.latitude.toFixed(4)}, ${dealer.longitude.toFixed(4)}`, 'opacity: 0.7; font-size: 12px; margin-top: 4px')
  return box
}

// A dark, see-through tooltip drawn above a point on the map.
function createTooltip(maps) {
  class Tooltip extends maps.OverlayView {
    constructor() {
      super()
      this.position = null
      this.div = document.createElement('div')
      this.div.style.cssText = [
        'position: absolute',
        'transform: translate(-50%, calc(-100% - 50px))',
        'background: rgba(17, 20, 39, 0.86)',
        'color: #ffffff',
        'padding: 10px 14px',
        'border-radius: 10px',
        'font: 13px/1.45 Calibri, "Segoe UI", Arial, sans-serif',
        'white-space: nowrap',
        'box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25)',
        'backdrop-filter: blur(2px)',
        'pointer-events: none',
        'display: none',
        'z-index: 10',
      ].join(';')
    }
    onAdd() {
      this.getPanes().floatPane.appendChild(this.div)
    }
    draw() {
      if (!this.position) return
      const point = this.getProjection().fromLatLngToDivPixel(this.position)
      if (point) {
        this.div.style.left = `${point.x}px`
        this.div.style.top = `${point.y}px`
      }
    }
    onRemove() {
      this.div.remove()
    }
    show(position, content) {
      this.position = new maps.LatLng(position)
      this.div.replaceChildren(content)
      this.div.style.display = 'block'
      this.draw()
    }
    hide() {
      this.div.style.display = 'none'
    }
  }
  return new Tooltip()
}

export default function DealerMap({ dealers, height = 420 }) {
  const mapRef = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const markers = []
    let tooltip = null
    // Google calls this when the API key is refused.
    window.gm_authFailure = () => setError('Google Maps refused the API key. Check VITE_GOOGLE_MAPS_API_KEY in the frontend .env.')

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapRef.current) return
        const map = new maps.Map(mapRef.current, {
          center: US_CENTER,
          zoom: 4,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
        })
        tooltip = createTooltip(maps)
        tooltip.setMap(map)

        // A clicked pin keeps its tooltip open; hovering shows the others.
        let pinned = null
        const icon = { url: PIN_URL, scaledSize: new maps.Size(30, 42), anchor: new maps.Point(15, 42) }
        const bounds = new maps.LatLngBounds()
        dealers.forEach((dealer) => {
          const position = { lat: dealer.latitude, lng: dealer.longitude }
          const marker = new maps.Marker({ map, position, icon })
          const show = () => tooltip.show(position, tooltipContent(dealer))
          marker.addListener('mouseover', show)
          marker.addListener('mouseout', () => (pinned ? tooltip.show(pinned.position, tooltipContent(pinned.dealer)) : tooltip.hide()))
          marker.addListener('click', () => {
            pinned = { position, dealer }
            show()
          })
          markers.push(marker)
          bounds.extend(position)
        })
        map.addListener('click', () => {
          pinned = null
          tooltip.hide()
        })
        if (dealers.length > 1) map.fitBounds(bounds, 64)
        else if (dealers.length === 1) map.setCenter(bounds.getCenter())
      })
      .catch((e) => !cancelled && setError(e.message))

    return () => {
      cancelled = true
      markers.forEach((marker) => marker.setMap(null))
      tooltip?.setMap(null)
    }
  }, [dealers])

  if (!dealers.length) return <Alert severity="info">No dealer has a location yet.</Alert>

  const counts = Object.entries(STATUS_LABELS)
    .map(([key, label]) => [label, dealers.filter((d) => d.status === key).length])
    .filter(([, count]) => count > 0)

  return (
    <Stack spacing={1.5}>
      {error && <Alert severity="error">{error}</Alert>}
      <Box ref={mapRef} role="region" aria-label="Map of dealer locations" sx={{ height, borderRadius: 2, overflow: 'hidden', bgcolor: 'background.default' }} />
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {dealers.length} dealers · {counts.map(([label, count]) => `${count} ${label.toLowerCase()}`).join(' · ')}
        </Typography>
        {!env.googleMapsApiKey && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
            No Google Maps key set, so the map shows as a preview.
          </Typography>
        )}
      </Stack>
    </Stack>
  )
}
