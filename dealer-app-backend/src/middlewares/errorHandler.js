import { HttpError } from '../utils/httpError.js'

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `No route for ${req.method} ${req.originalUrl}` })
}

// Express 5 forwards errors from async handlers here automatically.
export function errorHandler(error, _req, res, _next) {
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message })
    return
  }
  // Malformed JSON body.
  if (error.type === 'entity.parse.failed') {
    res.status(400).json({ message: 'Request body is not valid JSON.' })
    return
  }
  console.error(error)
  res.status(500).json({ message: 'Something went wrong. Please try again.' })
}
