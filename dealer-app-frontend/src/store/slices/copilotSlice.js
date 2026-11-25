import { createSlice } from '@reduxjs/toolkit'
import { logout } from '@/store/slices/authSlice'

// The Copilot conversation, kept in the store so it survives switching pages
// and is shared by the Copilot page and the Copilot side panel.
// Cleared on logout, so the next user never sees someone else's questions.
//
// message: { id, author: 'user', text }
//        | { id, author: 'copilot', answer, error?, fresh? }   fresh = still to be "typed"
const initialState = {
  messages: [],
  context: null, // the last answer's context, for follow-up questions
  pending: false, // a question is waiting for its answer
}

const copilotSlice = createSlice({
  name: 'copilot',
  initialState,
  reducers: {
    addQuestion(state, action) {
      state.messages.push({ id: action.payload.id, author: 'user', text: action.payload.text })
      state.pending = true
    },
    addAnswer(state, action) {
      const { id, answer, error = false } = action.payload
      state.messages.push({ id, author: 'copilot', answer, error, fresh: !error })
      state.pending = false
      if (!error) state.context = answer.context ?? null
    },
    // A filter chip was changed: the answer is replaced in place.
    replaceAnswer(state, action) {
      const { id, answer } = action.payload
      const message = state.messages.find((m) => m.id === id)
      if (message) Object.assign(message, { answer, error: false, fresh: false })
      if (state.messages.at(-1)?.id === id) state.context = answer.context ?? null
    },
    markShown(state, action) {
      const message = state.messages.find((m) => m.id === action.payload)
      if (message) message.fresh = false
    },
    clearChat() {
      return initialState
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logout, () => initialState)
  },
})

export const { addQuestion, addAnswer, replaceAnswer, markShown, clearChat } = copilotSlice.actions

export const selectCopilotMessages = (state) => state.copilot.messages
export const selectCopilotContext = (state) => state.copilot.context
export const selectCopilotPending = (state) => state.copilot.pending

export default copilotSlice.reducer
