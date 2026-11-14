export const ALLOWED_EMAIL_DOMAIN = 'masaischool.ac.in'
export const EMAIL_DOMAIN_MESSAGE = `Use your @${ALLOWED_EMAIL_DOMAIN} email address.`

// Compares the part after the last "@" so look-alike hosts cannot slip through.
export function isAllowedEmail(email) {
  const value = String(email ?? '').trim().toLowerCase()
  const at = value.lastIndexOf('@')
  return at > 0 && value.slice(at + 1) === ALLOWED_EMAIL_DOMAIN
}
