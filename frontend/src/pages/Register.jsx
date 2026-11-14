import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Button, Input } from '../components/ui'
import { useAuth } from '../context/AuthContext.jsx'
import { roleHome } from '../routes/roleHome.js'
import { ALLOWED_EMAIL_DOMAIN, EMAIL_DOMAIN_MESSAGE, isAllowedEmail } from '../lib/emailDomain.js'
import styles from './Register.module.css'

const MIN_PASSWORD_LENGTH = 8

function validate({ name, email, password, confirm }) {
  const errors = {}
  if (!name.trim()) errors.name = 'Tell us your name so the kitchen can shout it out.'
  if (!email.trim()) errors.email = 'Enter your email address.'
  else if (!isAllowedEmail(email)) errors.email = EMAIL_DOMAIN_MESSAGE
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Pick a password with at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (confirm !== password) errors.confirm = 'The passwords do not match. Type them once more.'
  return errors
}

export default function Register() {
  const { user, register } = useAuth()
  const [values, setValues] = useState({ name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={roleHome(user.role)} replace />

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
      await register({ name: values.name, email: values.email, password: values.password })
    } catch (error) {
      if (error.code === 'email_taken') {
        setErrors({ email: 'That email is already taken. Try logging in instead.' })
        form.elements.email.focus()
      } else {
        setFormError('Something burned in the kitchen. Please try again in a moment.')
      }
      setSubmitting(false)
    }
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Grab a seat at CampusBite</h1>
      <p className={styles.lead}>Make an account in a minute and you are ready to order.</p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}
        <Input
          label="Name"
          name="name"
          autoComplete="name"
          value={values.name}
          onChange={update('name')}
          error={errors.name}
        />
        <Input
          label="Email"
          name="email"
          type="email"
          placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
          autoComplete="email"
          value={values.email}
          onChange={update('email')}
          error={errors.email}
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          value={values.password}
          onChange={update('password')}
          error={errors.password}
        />
        <Input
          label="Confirm password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={values.confirm}
          onChange={update('confirm')}
          error={errors.confirm}
        />
        <Button type="submit" loading={submitting}>
          {submitting ? 'Creating your account' : 'Sign up'}
        </Button>
        <p className={styles.alt}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </section>
  )
}
