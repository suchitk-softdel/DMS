import { useState } from 'react'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import LogoutIcon from '@mui/icons-material/Logout'
import MenuIcon from '@mui/icons-material/Menu'
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined'
import SearchIcon from '@mui/icons-material/Search'
import AppBar from '@mui/material/AppBar'
import Avatar from '@mui/material/Avatar'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import ListItemIcon from '@mui/material/ListItemIcon'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { env } from '@/config/env'
import { PUBLIC_PATHS } from '@/constants/modules'
import { usePermissions } from '@/lib/rbac'
import { signOut } from '@/store/slices/authSlice'
import { toggleCopilot, toggleNav } from '@/store/slices/uiSlice'

// Placeholder until notifications come from the data service.
const UNREAD_NOTIFICATIONS = 3

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

export default function TopBar() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user, role } = usePermissions()
  const [accountAnchor, setAccountAnchor] = useState(null)

  const handleLogout = () => {
    setAccountAnchor(null)
    dispatch(signOut())
    navigate(PUBLIC_PATHS.LOGIN, { replace: true })
  }

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar sx={{ gap: 1 }}>
        <IconButton
          edge="start"
          aria-label="Open navigation"
          onClick={() => dispatch(toggleNav())}
          sx={{ display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        <TextField
          size="small"
          placeholder="Search…"
          aria-label="Search"
          sx={{ flexGrow: 1, maxWidth: 420 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />

        <Box sx={{ flexGrow: 1 }} />

        {/* Makes non-production builds obvious so test data isn't mistaken for live data. */}
        {!env.isProd && (
          <Chip label={env.appEnv.toUpperCase()} color="warning" size="small" sx={{ fontWeight: 600 }} />
        )}

        {/* Copilot is available on every screen to every role (SRS FR-COP-1). */}
        <Button
          variant="outlined"
          startIcon={<AutoAwesomeOutlinedIcon />}
          onClick={() => dispatch(toggleCopilot())}
          sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
        >
          Copilot
        </Button>

        <Tooltip title="Notifications">
          <IconButton aria-label={`${UNREAD_NOTIFICATIONS} unread notifications`}>
            <Badge badgeContent={UNREAD_NOTIFICATIONS} color="error">
              <NotificationsOutlinedIcon />
            </Badge>
          </IconButton>
        </Tooltip>

        <Tooltip title="Account">
          <IconButton
            aria-label="Account menu"
            aria-haspopup="menu"
            onClick={(event) => setAccountAnchor(event.currentTarget)}
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>
              {getInitials(user?.name)}
            </Avatar>
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={accountAnchor}
          open={Boolean(accountAnchor)}
          onClose={() => setAccountAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Box sx={{ px: 2, py: 1, minWidth: 200 }}>
            <Typography variant="subtitle2">{user?.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {role?.name}
            </Typography>
          </Box>
          <Divider />
          <MenuItem
            onClick={() => {
              setAccountAnchor(null)
              dispatch(toggleCopilot())
            }}
            sx={{ display: { sm: 'none' } }}
          >
            <ListItemIcon>
              <AutoAwesomeOutlinedIcon fontSize="small" />
            </ListItemIcon>
            Copilot
          </MenuItem>
          <MenuItem onClick={handleLogout}>
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
