import { useState } from 'react'
import { insights } from '../api'
import { Button } from '../components/ui'
import styles from './Insights.module.css'

const EXAMPLES = [
  'Summarize my last five orders.',
  'Which of my orders are still not delivered?',
  'How much did I spend this week?',
  'Which food items have I ordered most frequently?',
]

const ERROR_MESSAGES = {
  ai_not_configured: 'Order insights are not available right now. Please try again later.',
  ai_rate_limited: 'The assistant is busy at the moment. Please try again in a little while.',
  too_many_questions: 'You are asking too fast. Please wait a minute and ask again.',
  ai_unavailable: 'The assistant could not answer right now. Please try again later.',
}

function errorText(error) {
  return ERROR_MESSAGES[error.code] ?? error.message
}

export default function Insights() {
  const [question, setQuestion] = useState('')
  const [state, setState] = useState({ status: 'idle', answer: null, error: '' })

  async function ask(text) {
    const trimmed = text.trim()
    if (trimmed.length < 3) {
      setState({ status: 'error', answer: null, error: 'Type a question of at least 3 characters.' })
      return
    }
    setState({ status: 'loading', answer: null, error: '' })
    try {
      const result = await insights.askInsight(trimmed)
      setState({ status: 'success', answer: result, error: '' })
    } catch (error) {
      setState({ status: 'error', answer: null, error: errorText(error) })
    }
  }

  function pick(text) {
    setQuestion(text)
    ask(text)
  }

  const loading = state.status === 'loading'

  return (
    <div className={styles.page}>
      <header>
        <h1 className={styles.title}>Insights</h1>
        <p className={styles.lead}>Ask about your past orders and get an answer from your own order history.</p>
      </header>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          ask(question)
        }}
      >
        <label htmlFor="insight-question" className={styles.label}>
          Your question
        </label>
        <textarea
          id="insight-question"
          className={styles.textarea}
          rows={3}
          maxLength={300}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <div className={styles.actions}>
          <Button type="submit" loading={loading}>
            Ask
          </Button>
          <Button variant="secondary" disabled={loading} onClick={() => pick(EXAMPLES[0])}>
            Summarize my orders
          </Button>
        </div>
      </form>

      <section aria-label="Example questions">
        <p className={styles.hint}>Or try one of these:</p>
        <ul className={styles.chips}>
          {EXAMPLES.map((example) => (
            <li key={example}>
              <button type="button" className={styles.chip} disabled={loading} onClick={() => pick(example)}>
                {example}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div aria-live="polite">
        {loading && <p className={styles.loading}>Looking through your orders...</p>}
        {state.status === 'error' && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}
        {state.status === 'success' && (
          <section className={styles.answer} aria-label="Answer">
            <p className={styles.answerText}>{state.answer.answer}</p>
            <p className={styles.hint}>
              Based on {state.answer.orders_considered} {state.answer.orders_considered === 1 ? 'order' : 'orders'}.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
