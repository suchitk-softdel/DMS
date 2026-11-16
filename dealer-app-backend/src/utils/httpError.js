// Errors with an HTTP status. Thrown from routes and services; turned into a
// JSON response by middlewares/errorHandler.js.
export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export const badRequest = (message) => new HttpError(400, message)
export const unauthorized = (message = 'Please sign in.') => new HttpError(401, message)
export const forbidden = (message = 'You do not have access to this resource.') => new HttpError(403, message)
export const notFound = (message = 'Not found.') => new HttpError(404, message)
