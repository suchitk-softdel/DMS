import Box from '@mui/material/Box'
import Drawer, { drawerClasses } from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useDispatch, useSelector } from 'react-redux'
import { Link as RouterLink, matchPath, useLocation } from 'react-router-dom'
import BrandLogo from '@/components/ui/BrandLogo'
import { NAV_ITEMS, NAV_RAIL_WIDTH } from '@/lib/navigation'
import { usePermissions } from '@/lib/rbac'
import { selectNavOpen, setNavOpen } from '@/store/slices/uiSlice'

// Persistent navy navigation rail from the UI Design Concept: logo and the
// destinations the role can open.
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
        [`& .${drawerClasses.paper}`]: {
          width: NAV_RAIL_WIDTH,
          boxSizing: 'border-box',
          bgcolor: 'brand.navy',
          color: 'common.white',
          borderRight: 'none',
        },
      }}
    >
      <Box
        component={RouterLink}
        to={homePath}
        onClick={closeMobileNav}
        aria-label="Dealers App home"
        sx={{ display: 'block', px: 3, pt: 3.25, pb: 1.5, color: 'inherit', textDecoration: 'none' }}
      >
        <BrandLogo tone="light" />
      </Box>

      <List component="nav" aria-label="Main navigation" sx={{ px: 1.75, pt: 1.5, pb: 2, flexGrow: 1, overflowY: 'auto' }}>
        {items.map(({ id, label, icon: Icon, path, end }) => {
          const active = isActive(path, end)
          return (
            <ListItemButton
              key={id}
              component={RouterLink}
              to={path}
              selected={active}
              aria-current={active ? 'page' : undefined}
              onClick={closeMobileNav}
              sx={{
                gap: 1.75,
                px: 1.5,
                py: 1.15,
                mb: 0.5,
                borderRadius: 2,
                color: 'common.white',
                transition: 'background-color 120ms ease',
                '& .nav-icon': { opacity: active ? 1 : 0.72 },
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.07)' },
                '&:hover .nav-icon': { opacity: 1 },
                '&.Mui-selected, &.Mui-selected:hover': {
                  bgcolor: 'primary.main',
                  boxShadow: '0 4px 12px rgba(0, 168, 150, 0.35)',
                },
              }}
            >
              <Icon className="nav-icon" sx={{ fontSize: 22 }} />
              <Typography sx={{ fontSize: 15.5, fontWeight: active ? 700 : 500, opacity: active ? 1 : 0.88 }}>{label}</Typography>
            </ListItemButton>
          )
        })}
      </List>
    </Drawer>
  )
}
