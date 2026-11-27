import { useEffect, useState } from 'react'
import CancelOutlined from '@mui/icons-material/CancelOutlined'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import LogoutIcon from '@mui/icons-material/Logout'
import MenuIcon from '@mui/icons-material/Menu'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import SearchIcon from '@mui/icons-material/Search'
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined'
import AppBar from '@mui/material/AppBar'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import ListItemIcon from '@mui/material/ListItemIcon'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useDispatch } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import UserAvatar from '@/components/ui/UserAvatar'
import { MODULE_PATHS, MODULES, ORDER_DETAILS_PATH, PUBLIC_PATHS } from '@/constants/modules'
import { usePageHeader } from '@/lib/pageHeader'
import { usePermissions } from '@/lib/rbac'
import { useLiveEvents } from '@/lib/live'
import { getNotifications } from '@/services/dataService'
import { signOut } from '@/store/slices/authSlice'
import { toggleNav } from '@/store/slices/uiSlice'

// Notifications are refreshed on every page change and once a minute.
const REFRESH_MS = 60_000

// "ORD-101399", "ord101399" or "101399" -> "ORD-101399"; anything else -> null.
const toOrderId = (term) => {
  const match = term.trim().match(/^(?:ord[\s-]?)?(\d{6})$/i)
  return match ? `ORD-${match[1]}` : null
}
const KIND_ICON = {
  success: { Icon: CheckCircleOutlined, color: 'primary.main' },
  error: { Icon: CancelOutlined, color: 'error.main' },
  warning: { Icon: WarningAmberOutlined, color: 'warning.dark' },
  info: { Icon: InfoOutlined, color: 'secondary.main' },
}

function useNotifications() {
  const { pathname } = useLocation()
  const [data, setData] = useState({ count: 0, items: [] })
  // Live: reload at once when warranty data changes (the timer is the fallback).
  const [liveTick, setLiveTick] = useState(0)
  useLiveEvents(() => setLiveTick((n) => n + 1))
  useEffect(() => {
    let cancelled = false
    const load = () =>
      getNotifications()
        .then((result) => !cancelled && setData(result))
        .catch(() => {}) // the bell is not worth an error message
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [pathname, liveTick])
  return data
}

// Top bar from the UI Design Concept: page title and subtitle on the left,
// global search, notifications and the signed-in user on the right.
export default function TopBar() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user, can } = usePermissions()
  const [query, setQuery] = useState('')
  // Orders screen for this user: the dealer's Orders or the manufacturer's Order Details.
  const ordersPath = can(MODULES.ORDERS)
    ? MODULE_PATHS[MODULES.ORDERS]
    : can(MODULES.ORDER_APPROVALS)
      ? ORDER_DETAILS_PATH
      : null

  // A full order number opens that order; anything else filters the order list.
  const searchOrders = (event) => {
    event.preventDefault()
    const term = query.trim()
    if (!term || !ordersPath) return
    const orderId = toOrderId(term)
    navigate(orderId ? `${ordersPath}?order=${orderId}` : `${ordersPath}?search=${encodeURIComponent(term)}`)
    setQuery('')
  }
  const { header } = usePageHeader()
  const notifications = useNotifications()
  const [accountAnchor, setAccountAnchor] = useState(null)
  const [bellAnchor, setBellAnchor] = useState(null)
  const firstName = user?.name?.split(' ')[0] ?? ''

  const handleLogout = () => {
    setAccountAnchor(null)
    dispatch(signOut())
    navigate(PUBLIC_PATHS.LOGIN, { replace: true })
  }

  const openNotification = (link) => {
    setBellAnchor(null)
    navigate(link)
  }

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ bgcolor: 'rgba(255, 255, 255, 0.92)', backdropFilter: 'blur(8px)', borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar sx={{ minHeight: { xs: 68, md: 84 }, gap: { xs: 1.5, md: 3 }, px: { xs: 2, md: 4.5 } }}>
        <IconButton edge="start" aria-label="Open navigation" onClick={() => dispatch(toggleNav())} sx={{ display: { md: 'none' } }}>
          <MenuIcon />
        </IconButton>

        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="h1" noWrap sx={{ fontSize: { xs: 21, md: 28 }, lineHeight: 1.15, color: 'text.primary' }}>
            {header.title}
          </Typography>
          {header.subtitle && (
            <Typography noWrap sx={{ mt: 0.25, color: 'text.secondary', fontSize: { xs: 13, md: 15 } }}>
              {header.subtitle}
            </Typography>
          )}
        </Box>

        <Box
          component="form"
          role="search"
          onSubmit={searchOrders}
          sx={{
            display: { xs: 'none', md: ordersPath ? 'flex' : 'none' },
            alignItems: 'center',
            gap: 1,
            width: { md: 260, lg: 380 },
            height: 44,
            px: 2,
            borderRadius: 22,
            bgcolor: 'background.default',
            border: 1,
            borderColor: 'divider',
            transition: 'border-color 120ms ease, box-shadow 120ms ease',
            '&:focus-within': { borderColor: 'primary.main', boxShadow: '0 0 0 3px rgba(0, 168, 150, 0.15)' },
          }}
        >
          <SearchIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
          <InputBase
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={can(MODULES.ORDER_APPROVALS) ? 'Search orders or dealers… (Enter)' : 'Search orders by ID… (Enter)'}
            inputProps={{ 'aria-label': 'Search orders' }}
            sx={{ flexGrow: 1, fontSize: 15 }}
          />
        </Box>

        <Tooltip title="Notifications">
          <IconButton
            aria-label={notifications.count ? `Notifications, ${notifications.count} new` : 'Notifications'}
            aria-haspopup="menu"
            onClick={(event) => setBellAnchor(event.currentTarget)}
            sx={{ width: 44, height: 44, bgcolor: 'background.default', color: 'secondary.main', border: 1, borderColor: 'divider' }}
          >
            <Badge badgeContent={notifications.count} color="error" max={9} overlap="circular">
              <NotificationsNoneOutlinedIcon />
            </Badge>
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={bellAnchor}
          open={Boolean(bellAnchor)}
          onClose={() => setBellAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { width: 380, maxWidth: 'calc(100vw - 32px)', mt: 1, borderRadius: 2.5, boxShadow: '0 12px 32px rgba(22, 27, 75, 0.16)' } } }}
        >
          <Box sx={{ px: 2.5, py: 1.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16 }}>Notifications</Typography>
          </Box>
          <Divider />
          {notifications.items.length === 0 && (
            <Box sx={{ px: 2.5, py: 3, textAlign: 'center' }}>
              <CheckCircleOutlined sx={{ color: 'primary.main', fontSize: 32 }} />
              <Typography sx={{ mt: 1, fontWeight: 600 }}>You're all caught up</Typography>
              <Typography variant="body2" color="text.secondary">
                Nothing needs your attention right now.
              </Typography>
            </Box>
          )}
          {notifications.items.map((n) => {
            const { Icon, color } = KIND_ICON[n.kind] ?? KIND_ICON.info
            return (
              <MenuItem key={n.id} onClick={() => openNotification(n.link)} sx={{ alignItems: 'flex-start', gap: 1.5, py: 1.5, px: 2.5, whiteSpace: 'normal' }}>
                <Icon sx={{ color, fontSize: 22, mt: 0.25 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 14.5, lineHeight: 1.35 }}>{n.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    {n.detail}
                  </Typography>
                </Box>
              </MenuItem>
            )
          })}
        </Menu>

        <ButtonBase
          aria-label="Account menu"
          aria-haspopup="menu"
          onClick={(event) => setAccountAnchor(event.currentTarget)}
          sx={{ gap: 1.25, borderRadius: 30, pr: { sm: 1.25 }, flexShrink: 0, '&:hover': { bgcolor: 'background.default' } }}
        >
          <UserAvatar name={user?.name} color="secondary.main" size={44} />
          <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'left' }}>
            <Typography noWrap sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{firstName}</Typography>
          </Box>
        </ButtonBase>

        <Menu
          anchorEl={accountAnchor}
          open={Boolean(accountAnchor)}
          onClose={() => setAccountAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { mt: 1, borderRadius: 2.5, minWidth: 240, boxShadow: '0 12px 32px rgba(22, 27, 75, 0.16)' } } }}
        >
          <Box sx={{ px: 2.5, py: 1.5 }}>
            <Typography sx={{ fontWeight: 700 }}>{user?.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {user?.organization?.type === 'manufacturer' ? 'Manufacturer' : 'Dealer'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user?.email}
            </Typography>
          </Box>
          <Divider />
          <MenuItem onClick={handleLogout} sx={{ py: 1.25 }}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            Log out
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  )
}
