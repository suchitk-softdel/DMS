import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import FactoryOutlined from "@mui/icons-material/FactoryOutlined";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
import Box from "@mui/material/Box";
import Drawer, { drawerClasses } from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useDispatch, useSelector } from "react-redux";
import { Link as RouterLink, matchPath, useLocation } from "react-router-dom";
import BrandLogo from "@/components/ui/BrandLogo";
import { COPILOT_PATH } from "@/constants/modules";
import { NAV_ITEMS, NAV_RAIL_WIDTH } from "@/lib/navigation";
import { usePermissions } from "@/lib/rbac";
import { selectNavOpen, setNavOpen } from "@/store/slices/uiSlice";

const menuLabelSx = {
  px: 1.5,
  mt: 1,
  mb: 1,
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  opacity: 0.45,
};

// Where the signed-in user works (dealership or manufacturer), at the bottom
// of the menu. The user's own name and role stay in the top bar.
function OrganizationCard({ organization }) {
  if (!organization) return null;
  const isDealer = organization.type === "dealer";
  const Icon = isDealer ? StorefrontOutlined : FactoryOutlined;
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        bgcolor: "rgba(255, 255, 255, 0.06)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: 1.5,
          display: "grid",
          placeItems: "center",
          bgcolor: "rgba(0, 168, 150, 0.18)",
          color: "primary.main",
        }}
      >
        <Icon sx={{ fontSize: 20 }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          noWrap
          title={organization.name}
          sx={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}
        >
          {organization.name}
        </Typography>
        <Typography
          noWrap
          sx={{ fontSize: 12.5, opacity: 0.6, lineHeight: 1.3 }}
        >
          {isDealer
            ? `${organization.tier} · ${organization.region}`
            : "Manufacturer"}
        </Typography>
      </Box>
    </Box>
  );
}

// Persistent navy navigation rail from the UI Design Concept: logo, the
// destinations the role can open, and the user's organisation at the bottom.
export default function NavRail() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"), { noSsr: true });
  const dispatch = useDispatch();
  const navOpen = useSelector(selectNavOpen);
  const { pathname } = useLocation();
  const { user, can, homePath, isDealer } = usePermissions();

  const items = NAV_ITEMS.filter((item) => can(item.key));
  const closeMobileNav = () => dispatch(setNavOpen(false));
  const isActive = (path, end = false) =>
    Boolean(matchPath({ path, end }, pathname));

  return (
    <Drawer
      variant={isDesktop ? "permanent" : "temporary"}
      open={isDesktop || navOpen}
      onClose={closeMobileNav}
      sx={{
        width: NAV_RAIL_WIDTH,
        flexShrink: 0,
        [`& .${drawerClasses.paper}`]: {
          width: NAV_RAIL_WIDTH,
          boxSizing: "border-box",
          bgcolor: "brand.navy",
          color: "common.white",
          borderRight: "none",
        },
      }}
    >
      <Box
        component={RouterLink}
        to={homePath}
        onClick={closeMobileNav}
        aria-label="Dealers App home"
        sx={{
          display: "block",
          px: 3,
          pt: 3.25,
          pb: 1.5,
          color: "inherit",
          textDecoration: "none",
        }}
      >
        <BrandLogo tone="light" />
      </Box>

      <List
        component="nav"
        aria-label="Main navigation"
        sx={{ px: 1.75, py: 0, flexGrow: 1, overflowY: "auto" }}
      >
        <Typography component="p" sx={menuLabelSx}>
          Menu
        </Typography>
        {items.map(({ id, label, icon: Icon, path, end }) => {
          const active = isActive(path, end);
          return (
            <ListItemButton
              key={id}
              component={RouterLink}
              to={path}
              selected={active}
              aria-current={active ? "page" : undefined}
              onClick={closeMobileNav}
              sx={{
                gap: 1.75,
                px: 1.5,
                py: 1.15,
                mb: 0.5,
                borderRadius: 2,
                color: "common.white",
                transition: "background-color 120ms ease",
                "& .nav-icon": { opacity: active ? 1 : 0.72 },
                "&:hover": { bgcolor: "rgba(255, 255, 255, 0.07)" },
                "&:hover .nav-icon": { opacity: 1 },
                "&.Mui-selected, &.Mui-selected:hover": {
                  bgcolor: "primary.main",
                  boxShadow: "0 4px 12px rgba(0, 168, 150, 0.35)",
                },
              }}
            >
              <Icon className="nav-icon" sx={{ fontSize: 22 }} />
              <Typography
                sx={{
                  fontSize: 15.5,
                  fontWeight: active ? 700 : 500,
                  opacity: active ? 1 : 0.88,
                }}
              >
                {label}
              </Typography>
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ px: 1.75, pt: 2, pb: 2.5 }}>
        <OrganizationCard organization={user?.organization} />
        {isDealer && (
          <Box
            component={RouterLink}
            to={COPILOT_PATH}
            onClick={closeMobileNav}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mt: 1.5,
              px: 1.5,
              py: 0.75,
              borderRadius: 1.5,
              color: "common.white",
              opacity: 0.6,
              fontSize: 13.5,
              textDecoration: "none",
              "&:hover": { opacity: 1, bgcolor: "rgba(255, 255, 255, 0.06)" },
            }}
          >
            <AutoAwesomeOutlined sx={{ fontSize: 17 }} />
            Need help? Ask Copilot
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
