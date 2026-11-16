import { useState } from 'react'
import LogoutIcon from '@mui/icons-material/Logout'
import MenuIcon from '@mui/icons-material/Menu'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
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
import { useNavigate } from 'react-router-dom'
import { usePageHeader } from '@/lib/pageHeader'
import UserAvatar from '@/components/ui/UserAvatar'
import { PUBLIC_PATHS } from '@/constants/modules'
import { usePermissions } from '@/lib/rbac'
import { signOut } from '@/store/slices/authSlice'
import { toggleNav } from '@/store/slices/uiSlice'

// Placeholder until notifications come from the data service.
const HAS_UNREAD_NOTIFICATIONS = true

// Top bar from the UI Design Concept: page title and subtitle on the left,
// global search, notifications and the signed-in user on the right.
export default function TopBar() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user, role } = usePermissions()
  const { header } = usePageHeader()
  const [accountAnchor, setAccountAnchor] = useState(null)
  const firstName = user?.name?.split(' ')[0] ?? ''

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
      sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar sx={{ minHeight: { xs: 72, md: 96 }, gap: { xs: 1.5, md: 4 }, px: { xs: 2, md: 4.5 } }}>
        <IconButton
          edge="start"
          aria-label="Open navigation"
          onClick={() => dispatch(toggleNav())}
          sx={{ display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography
            variant="h1"
            noWrap
            sx={{ fontSize: { xs: 22, md: 32 }, lineHeight: 1.1, color: 'text.primary' }}
          >
            {header.title}
          </Typography>
          {header.subtitle && (
            <Typography noWrap sx={{ mt: 0.25, color: 'text.secondary', fontSize: { xs: 13, md: 16 } }}>
              {header.subtitle}
            </Typography>
          )}
        </Box>

        <Box
          component="form"
          role="search"
          onSubmit={(event) => event.preventDefault()}
          sx={{
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            width: { md: 280, lg: 440 },
            height: 52,
            px: 3,
            borderRadius: 26,
            bgcolor: 'background.default',
            border: 1,
            borderColor: 'divider',
          }}
        >
          <InputBase
            placeholder="Search dealers, orders, SKUs..."
            inputProps={{ 'aria-label': 'Search dealers, orders, SKUs' }}
            sx={{ flexGrow: 1, fontSize: 15 }}
          />
        </Box>

        <Tooltip title="Notifications">
          <IconButton
            aria-label={HAS_UNREAD_NOTIFICATIONS ? 'Notifications, unread' : 'Notifications'}
            sx={{ width: 52, height: 52, bgcolor: 'background.default', color: 'secondary.main' }}
          >
            <Badge variant="dot" color="error" invisible={!HAS_UNREAD_NOTIFICATIONS} overlap="circular">
              <NotificationsNoneOutlinedIcon />
            </Badge>
          </IconButton>
        </Tooltip>

        <ButtonBase
          aria-label="Account menu"
          aria-haspopup="menu"
          onClick={(event) => setAccountAnchor(event.currentTarget)}
          sx={{ gap: 1.25, borderRadius: 30, pr: { sm: 1 } }}
        >
          <UserAvatar name={user?.name} color="secondary.main" size={56} />
          <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontWeight: 700, fontSize: 16 }}>
            {firstName}
          </Typography>
        </ButtonBase>

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
