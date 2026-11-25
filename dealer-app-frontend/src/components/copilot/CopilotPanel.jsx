import { useRef, useState } from 'react'
import AddCommentOutlinedIcon from '@mui/icons-material/AddCommentOutlined'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Drawer from '@mui/material/Drawer'
import Fab from '@mui/material/Fab'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useDispatch } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import CopilotChat from '@/components/copilot/CopilotChat'
import { COPILOT_PATH, MODULE_PATHS, MODULES } from '@/constants/modules'
import { usePermissions } from '@/lib/rbac'
import { clampCopilotWidth as clampWidth, useCopilotPanelLayout } from '@/lib/useCopilotPanelLayout'
import { useCopilotChat } from '@/lib/useCopilotChat'
import { COPILOT_WIDTH, saveCopilotWidth, setCopilotOpen, setCopilotWidth } from '@/store/slices/uiSlice'

// Copilot side panel (FR-COP-1: Copilot on every screen). The "Ask Copilot"
// button in the bottom-right corner of every dealer screen opens the same
// chat as the Copilot page on the right. The page moves left to make room
// (nothing is covered); drag the panel's left edge to resize it (360 px up to
// half the window), and the width is remembered. Esc closes it.
// Not shown on the Copilot page itself. The manufacturer gets the Network
// Copilot: the same chat over all of its dealers (no Copilot page, so no
// Expand button).

const KEYBOARD_STEP = 24

// FR-COP-5: questions to start with, for the screen the dealer is on. Only
// the ones the role can see are offered.
const PAGE_PROMPTS = {
  [MODULE_PATHS[MODULES.HOME]]: [
    { text: 'Compare my revenue with last year', module: MODULES.DEALER_360 },
    { text: 'What is my health score?', module: MODULES.DEALER_360 },
    { text: 'What should I stock next month?', module: MODULES.INVENTORY },
  ],
  [MODULE_PATHS[MODULES.DEALER_360]]: [
    { text: 'What is my health score?', module: MODULES.DEALER_360 },
    { text: 'Show revenue by month', module: MODULES.DEALER_360 },
    { text: 'Top 5 products by revenue this year', module: MODULES.DEALER_360 },
  ],
  [MODULE_PATHS[MODULES.ORDERS]]: [
    { text: 'How many orders are waiting for approval?', module: MODULES.ORDERS },
    { text: 'What is my total pending order quantity?', module: MODULES.ORDERS },
    { text: 'What is my average order value?', module: MODULES.ORDERS },
  ],
  [MODULE_PATHS[MODULES.INVENTORY]]: [
    { text: 'What should I stock next month?', module: MODULES.INVENTORY },
    { text: 'How many furnaces are in stock?', module: MODULES.INVENTORY },
    { text: 'What is my inventory value?', module: MODULES.INVENTORY },
  ],
  [MODULE_PATHS[MODULES.WARRANTY]]: [
    { text: 'How many claims are pending?', module: MODULES.WARRANTY },
    { text: 'Which product has the most claims?', module: MODULES.WARRANTY },
    { text: 'Claims by status this year', module: MODULES.WARRANTY },
  ],
  [MODULE_PATHS[MODULES.PLACE_ORDERS]]: [
    { text: 'Top 5 products by revenue this year', module: MODULES.DEALER_360 },
    { text: 'What was my total profit last year?', module: MODULES.DEALER_360 },
    { text: 'How many furnaces are in stock?', module: MODULES.INVENTORY },
  ],
}

// Offered on any other screen, or when the role can't see this screen's questions.
const GENERAL_PROMPTS = [
  { text: 'What was my total revenue last year?', module: MODULES.DEALER_360 },
  { text: 'How many orders did I place last year?', module: MODULES.ORDERS },
  { text: 'How many claims are pending?', module: MODULES.WARRANTY },
  { text: 'What should I stock next month?', module: MODULES.INVENTORY },
  { text: 'What is the price of FN-H96-80?', module: MODULES.HOME },
]

// The manufacturer's questions: about its whole dealer network.
const NETWORK_PROMPTS = [
  'Top dealers by revenue this year',
  "How are my dealers' health scores?",
  'Which dealer has the most warranty claims?',
  'How many orders are pending?',
]

function PanelWelcome({ prompts, onAsk, network }) {
  return (
    <Box sx={{ pt: 1 }}>
      <Typography sx={{ fontSize: 20, fontWeight: 700, mb: 0.5 }}>How can I help today?</Typography>
      <Typography color="text.secondary" sx={{ fontSize: 14.5, mb: 2 }}>
        {network
          ? 'Ask about your dealer network in your own words: all dealers or one by name. Every answer comes from your dealers\' data, with the evidence shown.'
          : 'Ask about your dealership in your own words. Every answer comes from your own data, with the evidence shown.'}
      </Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.secondary', mb: 1 }}>Try asking</Typography>
      <Stack spacing={1}>
        {prompts.map((prompt) => (
          <ButtonBase
            key={prompt}
            onClick={() => onAsk(prompt)}
            sx={{
              justifyContent: 'flex-start',
              textAlign: 'left',
              px: 1.75,
              py: 1.25,
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              font: 'inherit',
              fontSize: 14.5,
              '&:hover': { borderColor: 'primary.main', color: 'primary.dark' },
              '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
            }}
          >
            {prompt}
          </ButtonBase>
        ))}
      </Stack>
    </Box>
  )
}

// The left edge of the panel: drag (or focus it and use ← →) to resize.
function ResizeHandle({ width, windowWidth, onResize, onDone }) {
  const max = clampWidth(Infinity, windowWidth)
  const startDrag = (event) => {
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    let latest = width
    const move = (e) => {
      latest = clampWidth(window.innerWidth - e.clientX, window.innerWidth)
      onResize(latest)
    }
    const end = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', end)
      handle.removeEventListener('pointercancel', end)
      onDone(latest)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
  }
  const onKeyDown = (event) => {
    const delta = event.key === 'ArrowLeft' ? KEYBOARD_STEP : event.key === 'ArrowRight' ? -KEYBOARD_STEP : 0
    if (!delta) return
    event.preventDefault()
    const next = clampWidth(width + delta, windowWidth)
    onResize(next)
    onDone(next)
  }
  return (
    <Tooltip title="Drag to resize" placement="left">
      <Box
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize Copilot panel"
        aria-valuemin={COPILOT_WIDTH.min}
        aria-valuemax={max}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={startDrag}
        onKeyDown={onKeyDown}
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 8,
          zIndex: 1,
          cursor: 'col-resize',
          touchAction: 'none',
          outline: 'none',
          '&::after': { content: '""', position: 'absolute', left: 2, top: '50%', width: 4, height: 40, mt: '-20px', borderRadius: 2, bgcolor: 'divider' },
          '&:hover::after, &:focus-visible::after': { bgcolor: 'primary.main' },
          '&:hover, &:focus-visible': { bgcolor: 'action.hover' },
        }}
      />
    </Tooltip>
  )
}

export default function CopilotPanel() {
  const dispatch = useDispatch()
  const { user, can, isDealer } = usePermissions()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const chat = useCopilotChat()
  const inputRef = useRef(null)
  const { available, open, isPhone, width, windowWidth } = useCopilotPanelLayout()
  const setOpen = (value) => dispatch(setCopilotOpen(value))

  // On a phone the panel covers the screen, so close it when an answer's
  // action button opens another page.
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    if (isPhone && open) dispatch(setCopilotOpen(false))
  }

  if (!available) return null

  const forPage = (PAGE_PROMPTS[pathname] ?? []).filter((p) => can(p.module))
  const prompts = !isDealer
    ? NETWORK_PROMPTS
    : (forPage.length ? forPage : GENERAL_PROMPTS.filter((p) => can(p.module)).slice(0, 3)).map((p) => p.text)
  const org = user?.organization
  const dealerLine = org ? [org.name, org.tier].filter(Boolean).join(' · ') : ''

  const ask = async (text) => {
    await chat.ask(text)
    inputRef.current?.focus()
  }
  const newChat = () => {
    chat.newChat()
    inputRef.current?.focus()
  }

  return (
    <>
      {!open && (
        <Fab
          color="primary"
          variant="extended"
          onClick={() => setOpen(true)}
          aria-label="Ask Copilot"
          sx={{ position: 'fixed', right: { xs: 16, md: 24 }, bottom: { xs: 16, md: 24 }, zIndex: (t) => t.zIndex.speedDial, gap: 1, textTransform: 'none', fontWeight: 700 }}
        >
          <AutoAwesomeRoundedIcon fontSize="small" />
          Ask Copilot
        </Fab>
      )}

      {/* Persistent: the page stays usable next to it (MainLayout makes room). */}
      <Drawer
        anchor="right"
        variant={isPhone ? 'temporary' : 'persistent'}
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: {
            role: 'complementary',
            'aria-label': 'Copilot',
            onKeyDown: (e) => e.key === 'Escape' && setOpen(false),
            sx: { width: isPhone ? '100%' : width, display: 'flex', flexDirection: 'column', borderLeft: 1, borderColor: 'divider' },
          },
        }}
      >
        {!isPhone && (
          <ResizeHandle
            width={width}
            windowWidth={windowWidth}
            onResize={(next) => dispatch(setCopilotWidth(next))}
            onDone={saveCopilotWidth}
          />
        )}

        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', pl: 2.25, pr: 1, py: 1.25, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
          <Box sx={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'primary.main', color: 'common.white', flexShrink: 0 }} aria-hidden>
            <AutoAwesomeRoundedIcon fontSize="small" />
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography component="h2" sx={{ fontWeight: 700, fontSize: 17, lineHeight: 1.2 }}>
              {isDealer ? 'Dealer Copilot' : 'Network Copilot'}
            </Typography>
            {dealerLine && (
              <Typography noWrap sx={{ fontSize: 12.5, color: 'text.secondary' }} title={dealerLine}>
                {dealerLine}
              </Typography>
            )}
          </Box>
          <Tooltip title="New chat">
            <span>
              <IconButton onClick={newChat} disabled={chat.thinking} aria-label="New chat">
                <AddCommentOutlinedIcon />
              </IconButton>
            </span>
          </Tooltip>
          {isDealer && (
            <Tooltip title="Expand">
              <IconButton onClick={() => navigate(COPILOT_PATH)} aria-label="Expand to the Copilot page">
                <OpenInFullRoundedIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Close">
            <IconButton onClick={() => setOpen(false)} aria-label="Close Copilot">
              <CloseRoundedIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* The conversation scrolls; the question box stays pinned at the bottom. */}
        <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column', px: 2, pt: 1, pb: 1.5, bgcolor: 'grey.50' }}>
          {open && <CopilotChat chat={chat} compact inputRef={inputRef} welcome={<PanelWelcome prompts={prompts} onAsk={ask} network={!isDealer} />} />}
        </Box>
      </Drawer>
    </>
  )
}
