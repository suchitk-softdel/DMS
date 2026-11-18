import { createSlice } from '@reduxjs/toolkit'
import { logout } from '@/store/slices/authSlice'

// The Copilot conversation, kept in the store so it survives switching pages.
// Cleared on logout, so the next user never sees someone else's questions.
//
// message: { id, author: 'user', text }
//        | { id, author: 'copilot', answer, error?, fresh? }   fresh = still to be "typed"
const initialState = {
  messages: [],
  context: null, // the last answer's context, for follow-up questions
}

const copilotSlice = createSlice({
  name: 'copilot',
  initialState,
  reducers: {
    addQuestion(state, action) {
      state.messages.push({ id: action.payload.id, author: 'user', text: action.payload.text })
    },
    addAnswer(state, action) {
      const { id, answer, error = false } = action.payload
      state.messages.push({ id, author: 'copilot', answer, error, fresh: !error })
      if (!error) state.context = answer.context ?? null
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

export const { addQuestion, addAnswer, markShown, clearChat } = copilotSlice.actions

export const selectCopilotMessages = (state) => state.copilot.messages
export const selectCopilotContext = (state) => state.copilot.context

export default copilotSlice.reducer
