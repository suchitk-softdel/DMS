import { useEffect, useRef, useState } from 'react'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import { keyframes } from '@mui/material/styles'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CopilotAnswer from '@/components/patterns/CopilotAnswer'

// The Copilot chat itself: the conversation (questions, answers, "thinking")
// and the question box. Shared by the Copilot page and the Copilot side
// panel, so both behave exactly the same.
//
// chat:     from useCopilotChat()
// welcome:  shown while the conversation is empty
// compact:  smaller text and spacing, for the narrow side panel
// inputRef: optional, so the parent can focus the question box (New chat)

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

export default function CopilotChat({ chat, welcome = null, compact = false, inputRef: outerRef }) {
  const { messages, thinking, ask, rerun, markShown } = chat
  const [draft, setDraft] = useState('')
  const endRef = useRef(null)
  const ownRef = useRef(null)
  const inputRef = outerRef ?? ownRef

  // Follow the conversation; an empty chat stays at the top (welcome screen).
  useEffect(() => {
    if (messages.length || thinking) endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })
  }, [messages, thinking])

  const send = async (text) => {
    if (!text.trim() || thinking) return
    setDraft('')
    await ask(text)
    inputRef.current?.focus()
  }

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

  return (
    <>
      {/* Top padding: the latest question never sits under the panel header. */}
      <Stack spacing={compact ? 2 : 3} sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', pt: 1, pb: 2, pr: 0.5, scrollPaddingTop: 16 }} aria-live="polite">
        {messages.length === 0 && !thinking && welcome}
        {messages.map((message) =>
          message.author === 'user' ? (
            <Box
              key={message.id}
              sx={{
                alignSelf: 'flex-end',
                maxWidth: compact ? '85%' : '75%',
                bgcolor: 'primary.main',
                color: 'common.white',
                borderRadius: '18px 18px 4px 18px',
                px: compact ? 1.75 : 2.25,
                py: compact ? 1.25 : 1.5,
              }}
            >
              <Typography sx={{ fontSize: compact ? 15 : 16 }}>{message.text}</Typography>
            </Box>
          ) : (
            <CopilotAnswer
              key={message.id}
              answer={message.answer}
              error={message.error}
              onAsk={send}
              onRerun={(change) => rerun(message, change)}
              compact={compact}
              animate={message.fresh}
              onShown={message.fresh ? () => markShown(message.id) : undefined}
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
          send(draft)
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          height: compact ? 52 : 60,
          pl: compact ? 2 : 3,
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
          placeholder="Ask about revenue, claims, inventory, training…"
          inputProps={{ 'aria-label': 'Ask Copilot', maxLength: 300 }}
          sx={{ flexGrow: 1, fontSize: compact ? 15 : 16 }}
        />
        <IconButton
          type="submit"
          aria-label="Send"
          disabled={!draft.trim() || thinking}
          sx={{
            width: compact ? 40 : 46,
            height: compact ? 40 : 46,
            bgcolor: 'primary.main',
            color: 'common.white',
            '&:hover': { bgcolor: 'primary.dark' },
            '&.Mui-disabled': { bgcolor: 'primary.main', color: 'common.white', opacity: 0.5 },
          }}
        >
          <SendRoundedIcon fontSize="small" />
        </IconButton>
      </Box>
      <Typography sx={{ mt: 0.75, ml: compact ? 2 : 3, fontSize: 12, color: 'text.secondary', flexShrink: 0 }}>
        Press Enter to send · ↑ to edit your last question
      </Typography>
    </>
  )
}
