import { useState } from 'react'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import CloseIcon from '@mui/icons-material/Close'
import SendIcon from '@mui/icons-material/Send'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Drawer, { drawerClasses } from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { useDispatch, useSelector } from 'react-redux'
import { selectCopilotOpen, setCopilotOpen } from '@/store/slices/uiSlice'

const PANEL_WIDTH = 380

const WELCOME_MESSAGE = {
  id: 'welcome',
  author: 'copilot',
  text: 'Hi! I am your dealer Copilot. Ask me about orders, incentives or warranty claims.',
}

// Placeholder chat. Replies are canned until a Copilot backend exists.
export default function CopilotPanel() {
  const dispatch = useDispatch()
  const open = useSelector(selectCopilotOpen)
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [draft, setDraft] = useState('')

  const handleClose = () => dispatch(setCopilotOpen(false))

  const handleSubmit = (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return

    const now = Date.now()
    setMessages((prev) => [
      ...prev,
      { id: `u-${now}`, author: 'user', text },
      {
        id: `c-${now}`,
        author: 'copilot',
        text: 'Copilot is not connected yet. This is a placeholder response.',
      },
    ])
    setDraft('')
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      sx={{
        [`& .${drawerClasses.paper}`]: { width: { xs: '100%', sm: PANEL_WIDTH } },
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        <AutoAwesomeOutlinedIcon color="primary" />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Copilot
        </Typography>
        <IconButton aria-label="Close Copilot" onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      </Toolbar>
      <Divider />

      <Stack spacing={1.5} sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
        {messages.map((message) => {
          const isUser = message.author === 'user'
          return (
            <Paper
              key={message.id}
              variant={isUser ? 'elevation' : 'outlined'}
              sx={{
                p: 1.5,
                maxWidth: '85%',
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                bgcolor: isUser ? 'primary.main' : 'background.paper',
                color: isUser ? 'primary.contrastText' : 'text.primary',
              }}
            >
              <Typography variant="body2">{message.text}</Typography>
            </Paper>
          )
        })}
      </Stack>

      <Divider />
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 1, p: 2 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Ask Copilot…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          slotProps={{ htmlInput: { 'aria-label': 'Message Copilot' } }}
        />
        <IconButton type="submit" color="primary" aria-label="Send" disabled={!draft.trim()}>
          <SendIcon />
        </IconButton>
      </Box>
    </Drawer>
  )
}
