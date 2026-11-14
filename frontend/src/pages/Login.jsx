import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Button, Input } from '../components/ui'
import { useAuth } from '../context/AuthContext.jsx'
import { roleHome } from '../routes/roleHome.js'
import styles from './Login.module.css'

function validate({ email, password }) {
  const errors = {}
  if (!email.trim()) errors.email = 'Enter your email so we know who is hungry.'
  if (!password) errors.password = 'Enter your password to unlock the kitchen.'
  return errors
}

export default function Login() {
  const { user, login } = useAuth()
  const location = useLocation()
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={location.state?.from ?? roleHome(user.role)} replace />

  const update = (field) => (event) => setValues({ ...values, [field]: event.target.value })

  async function handleSubmit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const found = validate(values)
    setErrors(found)
    setFormError('')
    const firstInvalid = Object.keys(found)[0]
    if (firstInvalid) {
      form.elements[firstInvalid].focus()
      return
    }
    setSubmitting(true)
    try {
      await login({ email: values.email, password: values.password })
    } catch (error) {
      setFormError(
        error.code === 'invalid_credentials'
          ? 'That email and password do not match. Check them and try again.'
          : 'Something burned in the kitchen. Please try again in a moment.',
      )
      setSubmitting(false)
    }
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Welcome back, hungry human</h1>
      <p className={styles.lead}>Log in to pick up where your appetite left off.</p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={update('email')}
          error={errors.email}
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={update('password')}
          error={errors.password}
        />
        <Button type="submit" loading={submitting}>
          {submitting ? 'Logging in' : 'Log in'}
        </Button>
        <p className={styles.alt}>
          New to CampusBite? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </section>
  )
}
