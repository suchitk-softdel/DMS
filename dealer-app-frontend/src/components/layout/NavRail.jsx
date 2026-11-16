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

// Persistent navy navigation rail from the UI Design Concept: logo, the nine
// destinations (filtered by role). The signed-in user is shown in the TopBar.
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
        sx={{ display: 'block', px: 3.5, pt: 3.5, pb: 3, color: 'inherit', textDecoration: 'none' }}
      >
        <BrandLogo tone="light" showSubtitle={false} />
        <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
          Dealer App
        </Typography>
      </Box>

      <List component="nav" aria-label="Main navigation" sx={{ px: 2, py: 0, flexGrow: 1, overflowY: 'auto' }}>
        {items.map(({ id, label, badge, path, end }) => {
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
                px: 1.25,
                py: 1,
                mb: 1,
                borderRadius: 1,
                color: 'common.white',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.06)' },
                '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'primary.main' },
              }}
            >
              <Box
                aria-hidden
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: badge.length > 2 ? 12 : 13,
                  fontWeight: 700,
                  bgcolor: active ? 'common.white' : 'rgba(255, 255, 255, 0.1)',
                  color: active ? 'brand.navy' : 'common.white',
                }}
              >
                {badge}
              </Box>
              <Typography sx={{ fontSize: 16, fontWeight: active ? 700 : 400, opacity: active ? 1 : 0.92 }}>
                {label}
              </Typography>
            </ListItemButton>
          )
        })}
      </List>
    </Drawer>
  )
}
