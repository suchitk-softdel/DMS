import { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { askCopilot, rerunCopilot } from '@/services/dataService'
import {
  addAnswer,
  addQuestion,
  clearChat,
  markShown,
  replaceAnswer,
  selectCopilotContext,
  selectCopilotMessages,
  selectCopilotPending,
} from '@/store/slices/copilotSlice'

// The Copilot conversation: used by the Copilot page and the Copilot side
// panel, which therefore show the same chat. It lives in the store, so it
// survives switching pages; New chat (or signing out) clears it.
// -> { messages, thinking, ask(text), rerun(message, change), newChat(), markShown(id) }
export function useCopilotChat() {
  const dispatch = useDispatch()
  const messages = useSelector(selectCopilotMessages)
  const context = useSelector(selectCopilotContext)
  const thinking = useSelector(selectCopilotPending)

  const ask = useCallback(
    async (text) => {
      const question = text.trim()
      if (!question || thinking) return
      const id = `${Date.now()}`
      dispatch(addQuestion({ id: `q-${id}`, text: question }))
      try {
        const answer = await askCopilot(question, context)
        dispatch(addAnswer({ id: `a-${id}`, answer }))
      } catch (error) {
        dispatch(addAnswer({ id: `a-${id}`, error: true, answer: { text: error.message || 'Something went wrong. Please try again.' } }))
      }
    },
    [dispatch, context, thinking],
  )

  // A filter chip under an answer was changed: re-run it and replace it.
  // Throws when it can't be re-run (the card shows the message).
  const rerun = useCallback(
    async (message, change) => {
      const answer = await rerunCopilot(message.answer.context, change)
      dispatch(replaceAnswer({ id: message.id, answer }))
    },
    [dispatch],
  )

  const newChat = useCallback(() => dispatch(clearChat()), [dispatch])
  const shown = useCallback((id) => dispatch(markShown(id)), [dispatch])

  return { messages, thinking, ask, rerun, newChat, markShown: shown }
}
