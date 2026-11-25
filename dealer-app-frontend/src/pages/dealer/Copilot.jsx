import { useRef } from 'react'
import AddCommentOutlinedIcon from '@mui/icons-material/AddCommentOutlined'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CopilotChat from '@/components/copilot/CopilotChat'
import QuickActions from '@/components/patterns/QuickActions'
import PageHeader from '@/components/ui/PageHeader'
import SectionTitle from '@/components/ui/SectionTitle'
import { MODULE_PATHS, MODULES } from '@/constants/modules'
import { usePermissions } from '@/lib/rbac'
import { useCopilotChat } from '@/lib/useCopilotChat'

// Dealer Copilot, SRS v1.0 section 3.2, laid out as in the UI Design Concept.
// Answers come from the backend's own question engine (no third-party AI
// service, FR-COP-2), always from the dealer's own data, with the evidence.
// The conversation lives in the store, so it survives switching pages, and
// it is the same chat as the Copilot side panel (components/copilot).

// FR-COP-5: example questions on the welcome screen, by topic. Each topic is
// only shown if the role can see that data.
const TOPICS = [
  {
    title: 'Revenue & profit',
    icon: TrendingUpRoundedIcon,
    module: MODULES.DEALER_360,
    questions: ['Compare my revenue with last year', 'Top 5 products by profit in 2025', 'Show revenue by month'],
  },
  {
    title: 'Orders',
    icon: ReceiptLongOutlinedIcon,
    module: MODULES.ORDERS,
    questions: ['How many orders did I place last year?', 'What is my total pending order quantity?', 'How many orders are waiting for approval?'],
  },
  {
    title: 'Warranty claims',
    icon: VerifiedOutlinedIcon,
    module: MODULES.WARRANTY,
    questions: ['How many claims are pending?', 'Which product has the most claims?', 'Claims by status this year'],
  },
  {
    title: 'Stock & forecast',
    icon: Inventory2OutlinedIcon,
    module: MODULES.INVENTORY,
    questions: ['What should I stock next month?', 'How many furnaces are in stock?', 'What is the price of FN-H96-80?'],
  },
]

// Side panel (scrollable). Each prompt is only shown if the role can see that
// data; every one is checked to give a full answer from the 2-year data.
const SUGGESTED_PROMPTS = [
  { text: 'What was my total revenue last year?', module: MODULES.DEALER_360 },
  { text: 'Compare my revenue with last year', module: MODULES.DEALER_360 },
  { text: 'What was my total profit last year?', module: MODULES.DEALER_360 },
  { text: 'Which products generated the highest profit?', module: MODULES.DEALER_360 },
  { text: 'Show revenue by month', module: MODULES.DEALER_360 },
  { text: 'Revenue by category this year', module: MODULES.DEALER_360 },
  { text: 'Top 5 products by revenue this year', module: MODULES.DEALER_360 },
  { text: 'What is my health score?', module: MODULES.DEALER_360 },
  { text: 'What is my territory coverage?', module: MODULES.DEALER_360 },
  { text: 'How many orders did I place last year?', module: MODULES.ORDERS },
  { text: 'What is my total pending order quantity?', module: MODULES.ORDERS },
  { text: 'How many claims are pending?', module: MODULES.WARRANTY },
  { text: 'How many claims were rejected last year?', module: MODULES.WARRANTY },
  { text: 'Which product has the most claims?', module: MODULES.WARRANTY },
  { text: 'What should I stock next month?', module: MODULES.INVENTORY },
  { text: 'How many furnaces are in stock?', module: MODULES.INVENTORY },
  { text: 'What is my inventory value?', module: MODULES.INVENTORY },
  { text: 'How many furnaces did we sell in Q4 2025?', module: MODULES.DEALER_360 },
  { text: 'What is my average order value?', module: MODULES.ORDERS },
  { text: 'How many units did we install last year?', module: MODULES.WARRANTY },
  { text: 'What is the average claim amount?', module: MODULES.WARRANTY },
  { text: 'What is the price of FN-H96-80?', module: MODULES.HOME },
  { text: 'How many years of data do we have?', module: MODULES.HOME },
  { text: 'How many dealers are in the network?', module: MODULES.HOME },
]

// FR-COP-4: one-click actions.
const QUICK_ACTIONS = [
  { key: 'createOrder', label: 'Create Order', module: MODULES.ORDERS },
  { key: 'registerWarranty', label: 'Register Warranty', module: MODULES.WARRANTY },
  { key: 'submitClaim', label: 'Submit Claim', module: MODULES.WARRANTY },
]

function Welcome({ topics, onAsk }) {
  return (
    <Box sx={{ py: { xs: 1, md: 2 } }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'primary.main', color: 'common.white' }}>
          <AutoAwesomeRoundedIcon />
        </Box>
        <Typography sx={{ fontSize: { xs: 20, md: 24 }, fontWeight: 700 }}>How can I help today?</Typography>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3, fontSize: 16 }}>
        Ask about your dealership in your own words. Every answer comes from your own data, with the evidence shown.
      </Typography>
      <Grid container spacing={2}>
        {topics.map(({ title, icon: Icon, questions }) => (
          <Grid key={title} size={{ xs: 12, sm: 6 }}>
            <Box sx={{ height: '100%', p: 2, borderRadius: 1.5, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.25, color: 'primary.dark' }}>
                <Icon fontSize="small" />
                <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{title}</Typography>
              </Stack>
              <Stack spacing={0.75}>
                {questions.map((question) => (
                  <ButtonBase
                    key={question}
                    onClick={() => onAsk(question)}
                    sx={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      px: 1.25,
                      py: 0.75,
                      borderRadius: 1,
                      font: 'inherit',
                      fontSize: 14,
                      color: 'text.primary',
                      bgcolor: 'grey.50',
                      '&:hover': { bgcolor: 'grey.100', color: 'primary.dark' },
                    }}
                  >
                    {question}
                  </ButtonBase>
                ))}
              </Stack>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

export default function Copilot() {
  const { can } = usePermissions()
  const chat = useCopilotChat()
  const { thinking } = chat
  const inputRef = useRef(null)

  const ask = async (text) => {
    await chat.ask(text)
    inputRef.current?.focus()
  }

  const startNewChat = () => {
    chat.newChat()
    inputRef.current?.focus()
  }

  const topics = TOPICS.filter((topic) => can(topic.module))
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
              height: { xs: 620, lg: 'calc(100vh - 96px - 56px)' },
              minHeight: 560,
              px: { xs: 2, md: 3.5 },
              py: { xs: 2, md: 2.5 },
              bgcolor: 'grey.50',
            }}
          >
            {/* New chat: clears the conversation and the follow-up context. */}
            <Stack direction="row" sx={{ justifyContent: 'flex-end', mb: 1.5 }}>
              <Button
                variant="outlined"
                startIcon={<AddCommentOutlinedIcon />}
                onClick={startNewChat}
                disabled={thinking}
                sx={{ bgcolor: 'background.paper' }}
              >
                New chat
              </Button>
            </Stack>

            <CopilotChat chat={chat} inputRef={inputRef} welcome={<Welcome topics={topics} onAsk={ask} />} />
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          {prompts.length > 0 && (
            <Box component="section" sx={{ mb: 4.5 }}>
              <SectionTitle>Suggested Prompts</SectionTitle>
              <Stack
                spacing={1.25}
                tabIndex={0}
                aria-label="Suggested prompts"
                sx={{
                  maxHeight: { xs: 320, lg: 420 },
                  overflowY: 'auto',
                  pr: 1,
                  // Slim, always-visible scroll bar
                  scrollbarWidth: 'thin',
                  scrollbarColor: (theme) => `${theme.palette.primary.main} ${theme.palette.grey[200]}`,
                  '&::-webkit-scrollbar': { width: 6 },
                  '&::-webkit-scrollbar-track': { bgcolor: 'grey.200', borderRadius: 3 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: 'primary.main', borderRadius: 3 },
                }}
              >
                {prompts.map((prompt) => (
                  <ButtonBase
                    key={prompt.text}
                    onClick={() => ask(prompt.text)}
                    disabled={thinking}
                    sx={{
                      flexShrink: 0,
                      justifyContent: 'flex-start',
                      minHeight: 50,
                      px: 2,
                      py: 1,
                      borderRadius: 1,
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'divider',
                      font: 'inherit',
                      fontSize: 15,
                      textAlign: 'left',
                      '&:hover': { borderColor: 'primary.main', color: 'primary.dark' },
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
