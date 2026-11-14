export const ALLOWED_EMAIL_DOMAIN = 'masaischool.ac.in'
export const EMAIL_DOMAIN_MESSAGE = `Use your @${ALLOWED_EMAIL_DOMAIN} email address.`

const ALLOWED_EMAIL_PATTERN = /^[^\s@]+@masaischool\.ac\.in$/

// Matches the whole address so look-alike hosts and malformed local parts cannot slip through.
export function isAllowedEmail(email) {
  return ALLOWED_EMAIL_PATTERN.test(String(email ?? '').trim().toLowerCase())
}
