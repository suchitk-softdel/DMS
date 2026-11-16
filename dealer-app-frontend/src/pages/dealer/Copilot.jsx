import { useEffect, useRef, useState } from 'react'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import InsightCard from '@/components/patterns/InsightCard'
import QuickActions from '@/components/patterns/QuickActions'
import PageHeader from '@/components/ui/PageHeader'
import SectionTitle from '@/components/ui/SectionTitle'
import { MODULE_PATHS, MODULES } from '@/constants/modules'
import { usePermissions } from '@/lib/rbac'

// Dealer Copilot, SRS v1.0 section 3.2, laid out as in the UI Design Concept.
// Answers will come from the backend's own question engine (no third-party AI
// service, FR-COP-2). Until it exists, the reply says so instead of inventing
// an answer.

// FR-COP-5: suggested prompts, each shown only if the role can see that data.
const SUGGESTED_PROMPTS = [
  { text: 'What should I stock next month?', module: MODULES.INVENTORY },
  { text: 'Show pending warranty claims', module: MODULES.WARRANTY },
  { text: 'Show top customers', module: MODULES.ORDERS },
  { text: 'Which incentive am I closest to?', module: MODULES.INCENTIVES },
]

// FR-COP-4: one-click actions.
const QUICK_ACTIONS = [
  { key: 'createQuote', label: 'Create Quote', module: MODULES.ORDERS },
  { key: 'registerWarranty', label: 'Register Warranty', module: MODULES.WARRANTY },
  { key: 'placeReorder', label: 'Place Reorder', module: MODULES.INVENTORY },
  { key: 'submitClaim', label: 'Submit Claim', module: MODULES.WARRANTY },
]

const NOT_CONNECTED =
  'The Copilot question engine is not connected yet. Soon I will answer from your own orders, inventory, claims and training data, with the evidence behind each answer.'

export default function Copilot() {
  const { can } = usePermissions()
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })
  }, [messages])

  const ask = (text) => {
    const question = text.trim()
    if (!question) return
    const id = Date.now()
    setMessages((previous) => [
      ...previous,
      { id: `q-${id}`, author: 'user', text: question },
      { id: `a-${id}`, author: 'copilot', text: NOT_CONNECTED, evidence: [] },
    ])
    setDraft('')
  }

  const prompts = SUGGESTED_PROMPTS.filter((prompt) => can(prompt.module))
  const quickActions = QUICK_ACTIONS.filter((action) => can(action.module)).map((action) => ({
    key: action.key,
    label: action.label,
    to: `${MODULE_PATHS[action.module]}?action=${action.key}`,
  }))

  return (
    <>
      <PageHeader title="Dealer Copilot" subtitle="Ask · Decide · Act" />

      <Grid container spacing={4.5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card
            sx={{
              display: 'flex',
              flexDirection: 'column',
              height: { xs: 560, lg: 'calc(100vh - 96px - 56px)' },
              minHeight: 520,
              px: { xs: 2, md: 4.5 },
              py: { xs: 2, md: 4 },
            }}
          >
            <Stack spacing={4} sx={{ flexGrow: 1, overflowY: 'auto', pb: 2 }} aria-live="polite">
              {messages.length === 0 && (
                <Typography color="text.secondary" sx={{ fontSize: 18 }}>
                  Ask anything about your dealership, or pick a suggested prompt.
                </Typography>
              )}
              {messages.map((message) =>
                message.author === 'user' ? (
                  <Box
                    key={message.id}
                    sx={{ alignSelf: 'flex-end', maxWidth: '55%', bgcolor: '#EEF1FA', borderRadius: 1.5, px: 2.5, py: 2.25 }}
                  >
                    <Typography sx={{ fontSize: 18 }}>{message.text}</Typography>
                  </Box>
                ) : (
                  <Box key={message.id} sx={{ maxWidth: '97%' }}>
                    <InsightCard label="" message={message.text} evidence={message.evidence} layout="column" />
                  </Box>
                ),
              )}
              <div ref={endRef} />
            </Stack>

            <Box
              component="form"
              onSubmit={(event) => {
                event.preventDefault()
                ask(draft)
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                height: 68,
                pl: 3,
                pr: 0.75,
                borderRadius: 34,
                bgcolor: 'background.default',
                border: 1,
                borderColor: 'divider',
              }}
            >
              <InputBase
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask Copilot anything about your dealership..."
                inputProps={{ 'aria-label': 'Ask Copilot' }}
                sx={{ flexGrow: 1, fontSize: 18 }}
              />
              <IconButton
                type="submit"
                aria-label="Send"
                disabled={!draft.trim()}
                sx={{
                  width: 54,
                  height: 54,
                  bgcolor: 'primary.main',
                  color: 'common.white',
                  '&:hover': { bgcolor: 'primary.dark' },
                  '&.Mui-disabled': { bgcolor: 'primary.main', color: 'common.white', opacity: 0.6 },
                }}
              >
                <SendRoundedIcon />
              </IconButton>
            </Box>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          {prompts.length > 0 && (
            <Box component="section" sx={{ mb: 4.5 }}>
              <SectionTitle>Suggested Prompts</SectionTitle>
              <Stack spacing={2}>
                {prompts.map((prompt) => (
                  <ButtonBase
                    key={prompt.text}
                    onClick={() => ask(prompt.text)}
                    sx={{
                      justifyContent: 'flex-start',
                      height: 64,
                      px: 3,
                      borderRadius: 1,
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'divider',
                      font: 'inherit',
                      fontSize: 17,
                      textAlign: 'left',
                      '&:hover': { borderColor: 'primary.main' },
                    }}
                  >
                    {prompt.text}
                  </ButtonBase>
                ))}
              </Stack>
            </Box>
          )}

          {quickActions.length > 0 && (
            <Box component="section">
              <SectionTitle>Quick Actions</SectionTitle>
              <QuickActions items={quickActions} variant="filled" />
            </Box>
          )}
        </Grid>
      </Grid>
    </>
  )
}
