import AcUnitIcon from '@mui/icons-material/AcUnit'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Drawer, { drawerClasses } from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useDispatch, useSelector } from 'react-redux'
import { Link as RouterLink, matchPath, useLocation } from 'react-router-dom'
import { NAV_ITEMS, NAV_RAIL_WIDTH } from '@/lib/navigation'
import { usePermissions } from '@/lib/rbac'
import { selectNavOpen, setNavOpen } from '@/store/slices/uiSlice'

export default function NavRail() {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const dispatch = useDispatch()
  const navOpen = useSelector(selectNavOpen)
  const { pathname } = useLocation()
  const { can, homePath } = usePermissions()

  const items = NAV_ITEMS.filter((item) => can(item.key))
  const closeMobileNav = () => dispatch(setNavOpen(false))

  const isActive = (path, end = false) => Boolean(matchPath({ path, end }, pathname))

  return (
    <Drawer
      variant={isDesktop ? 'permanent' : 'temporary'}
      open={isDesktop || navOpen}
      onClose={closeMobileNav}
      sx={{
        width: NAV_RAIL_WIDTH,
        flexShrink: 0,
        [`& .${drawerClasses.paper}`]: { width: NAV_RAIL_WIDTH, boxSizing: 'border-box' },
      }}
    >
      <Toolbar>
        <Box
          component={RouterLink}
          to={homePath}
          onClick={closeMobileNav}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main', textDecoration: 'none' }}
        >
          <AcUnitIcon />
          <Typography variant="h6" component="span">
            Dealer App
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List component="nav" aria-label="Main navigation" sx={{ px: 1 }}>
        {items.map(({ key, label, path, icon: Icon, end }) => (
          <ListItemButton
            key={key}
            component={RouterLink}
            to={path}
            selected={isActive(path, end)}
            onClick={closeMobileNav}
            sx={{ borderRadius: 1, mb: 0.5 }}
          >
            <ListItemIcon>
              <Icon />
            </ListItemIcon>
            <ListItemText primary={label} />
          </ListItemButton>
        ))}
      </List>
    </Drawer>
  )
}
