import { request } from './http.js'

export function askInsight(question) {
  return request('/insights', { method: 'POST', body: { question: question.trim() } })
}
