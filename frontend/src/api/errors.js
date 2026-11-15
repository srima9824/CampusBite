export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    if (fields) this.fields = fields
  }
}
