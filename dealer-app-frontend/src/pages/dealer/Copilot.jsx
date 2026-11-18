import { useCallback, useEffect, useRef, useState } from 'react'
import AddCommentOutlinedIcon from '@mui/icons-material/AddCommentOutlined'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined'
import { keyframes } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useDispatch, useSelector } from 'react-redux'
import CopilotAnswer from '@/components/patterns/CopilotAnswer'
import QuickActions from '@/components/patterns/QuickActions'
import PageHeader from '@/components/ui/PageHeader'
import SectionTitle from '@/components/ui/SectionTitle'
import { MODULE_PATHS, MODULES } from '@/constants/modules'
import { usePermissions } from '@/lib/rbac'
import { askCopilot } from '@/services/dataService'
import {
  addAnswer,
  addQuestion,
  clearChat,
  markShown,
  selectCopilotContext,
  selectCopilotMessages,
} from '@/store/slices/copilotSlice'

// Dealer Copilot, SRS v1.0 section 3.2, laid out as in the UI Design Concept.
// Answers come from the backend's own question engine (no third-party AI
// service, FR-COP-2), always from the dealer's own data, with the evidence.
// The conversation lives in the store, so it survives switching pages.

// FR-COP-5: example questions on the welcome screen, by topic. Each topic is
// only shown if the role can see that data.
const TOPICS = [
  {
    title: 'Sales & profit',
    icon: TrendingUpRoundedIcon,
    module: MODULES.DEALER_360,
    questions: ['Compare my sales with last year', 'Top 5 customers by profit in 2025', 'Show sales by month'],
  },
  {
    title: 'Orders & quotes',
    icon: ReceiptLongOutlinedIcon,
    module: MODULES.ORDERS,
    questions: ['How many orders did I place last year?', 'What is my total pending order quantity?', 'How many quotes are open?'],
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
  {
    title: 'Incentives & training',
    icon: WorkspacePremiumOutlinedIcon,
    module: MODULES.INCENTIVES,
    questions: ['Which incentive am I closest to?', 'How is my training going?', 'What is my health score?'],
  },
  {
    title: 'Sales pipeline',
    icon: HandshakeOutlinedIcon,
    module: MODULES.SALES_COACH,
    questions: ['Show my sales pipeline', 'What is my win rate?'],
  },
]

// Side panel (scrollable). Each prompt is only shown if the role can see that
// data; every one is checked to give a full answer from the 2-year data.
const SUGGESTED_PROMPTS = [
  { text: 'What were my total sales last year?', module: MODULES.DEALER_360 },
  { text: 'Compare my sales with last year', module: MODULES.DEALER_360 },
  { text: 'What was my total profit last year?', module: MODULES.DEALER_360 },
  { text: 'Which products generated the highest profit?', module: MODULES.DEALER_360 },
  { text: 'Show sales by month', module: MODULES.DEALER_360 },
  { text: 'Sales by category this year', module: MODULES.DEALER_360 },
  { text: 'Top 5 customers by sales this year', module: MODULES.DEALER_360 },
  { text: 'Residential vs commercial sales this year', module: MODULES.DEALER_360 },
  { text: 'What is my health score?', module: MODULES.DEALER_360 },
  { text: 'How many orders did I place last year?', module: MODULES.ORDERS },
  { text: 'What is my total pending order quantity?', module: MODULES.ORDERS },
  { text: 'How many quotes are open?', module: MODULES.ORDERS },
  { text: 'How many customers do I have?', module: MODULES.ORDERS },
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
  { text: 'Show my sales pipeline', module: MODULES.SALES_COACH },
  { text: 'How is my training going?', module: MODULES.INCENTIVES },
  { text: 'Which incentive am I closest to?', module: MODULES.INCENTIVES },
  { text: 'How many years of data do we have?', module: MODULES.HOME },
  { text: 'How many dealers are in the network?', module: MODULES.HOME },
]

// FR-COP-4: one-click actions.
const QUICK_ACTIONS = [
  { key: 'createQuote', label: 'Create Quote', module: MODULES.ORDERS },
  { key: 'registerWarranty', label: 'Register Warranty', module: MODULES.WARRANTY },
  { key: 'placeReorder', label: 'Place Reorder', module: MODULES.INVENTORY },
  { key: 'submitClaim', label: 'Submit Claim', module: MODULES.WARRANTY },
]

const bounce = keyframes`
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-5px); opacity: 1; }
`

function ThinkingDots() {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }} role="status" aria-label="Copilot is thinking">
      <Box sx={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'primary.main', color: 'common.white' }}>
        <AutoAwesomeRoundedIcon fontSize="small" />
      </Box>
      <Stack direction="row" spacing={0.75} sx={{ px: 2, py: 1.5, borderRadius: 1.5, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              animation: `${bounce} 1.2s infinite ease-in-out`,
              animationDelay: `${i * 0.15}s`,
              '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0.7 },
            }}
          />
        ))}
      </Stack>
    </Stack>
  )
}

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
  const dispatch = useDispatch()
  const messages = useSelector(selectCopilotMessages)
  const context = useSelector(selectCopilotContext)
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const endRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })
  }, [messages, thinking])

  const ask = async (text) => {
    const question = text.trim()
    if (!question || thinking) return
    const id = `${Date.now()}`
    dispatch(addQuestion({ id: `q-${id}`, text: question }))
    setDraft('')
    setThinking(true)
    try {
      const answer = await askCopilot(question, context)
      dispatch(addAnswer({ id: `a-${id}`, answer }))
    } catch (error) {
      dispatch(addAnswer({ id: `a-${id}`, error: true, answer: { text: error.message || 'Something went wrong. Please try again.' } }))
    } finally {
      setThinking(false)
      inputRef.current?.focus()
    }
  }

  const handleShown = useCallback((id) => dispatch(markShown(id)), [dispatch])

  // ↑ in an empty input brings back the last question to edit.
  const handleKeyDown = (event) => {
    if (event.key === 'ArrowUp' && !draft) {
      const last = [...messages].reverse().find((m) => m.author === 'user')
      if (last) {
        event.preventDefault()
        setDraft(last.text)
      }
    }
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
            {messages.length > 0 && (
              <Stack direction="row" sx={{ justifyContent: 'flex-end', mb: 1 }}>
                <Button
                  size="small"
                  startIcon={<AddCommentOutlinedIcon />}
                  onClick={() => dispatch(clearChat())}
                  disabled={thinking}
                >
                  New chat
                </Button>
              </Stack>
            )}

            <Stack spacing={3} sx={{ flexGrow: 1, overflowY: 'auto', pb: 2, pr: 0.5 }} aria-live="polite">
              {messages.length === 0 && !thinking && <Welcome topics={topics} onAsk={ask} />}
              {messages.map((message) =>
                message.author === 'user' ? (
                  <Box
                    key={message.id}
                    sx={{
                      alignSelf: 'flex-end',
                      maxWidth: '75%',
                      bgcolor: 'primary.main',
                      color: 'common.white',
                      borderRadius: '18px 18px 4px 18px',
                      px: 2.25,
                      py: 1.5,
                    }}
                  >
                    <Typography sx={{ fontSize: 16 }}>{message.text}</Typography>
                  </Box>
                ) : (
                  <CopilotAnswer
                    key={message.id}
                    answer={message.answer}
                    error={message.error}
                    onAsk={ask}
                    animate={message.fresh}
                    onShown={message.fresh ? () => handleShown(message.id) : undefined}
                  />
                ),
              )}
              {thinking && <ThinkingDots />}
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
                height: 60,
                pl: 3,
                pr: 0.75,
                borderRadius: 30,
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                '&:focus-within': { borderColor: 'primary.main', boxShadow: '0 0 0 3px rgba(0, 168, 150, 0.15)' },
              }}
            >
              <InputBase
                inputRef={inputRef}
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about sales, orders, claims, stock..."
                inputProps={{ 'aria-label': 'Ask Copilot', maxLength: 300 }}
                sx={{ flexGrow: 1, fontSize: 16 }}
              />
              <IconButton
                type="submit"
                aria-label="Send"
                disabled={!draft.trim() || thinking}
                sx={{
                  width: 46,
                  height: 46,
                  bgcolor: 'primary.main',
                  color: 'common.white',
                  '&:hover': { bgcolor: 'primary.dark' },
                  '&.Mui-disabled': { bgcolor: 'primary.main', color: 'common.white', opacity: 0.5 },
                }}
              >
                <SendRoundedIcon fontSize="small" />
              </IconButton>
            </Box>
            <Typography sx={{ mt: 0.75, ml: 3, fontSize: 12, color: 'text.secondary' }}>
              Press Enter to send · ↑ to edit your last question
            </Typography>
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
