import { describe, expect, it } from 'vitest'
import { EMAIL_DOMAIN_MESSAGE, isAllowedEmail } from './emailDomain.js'

describe('isAllowedEmail', () => {
  it.each([
    ['maya@masaischool.ac.in', true],
    ['MAYA@MASAISCHOOL.AC.IN', true],
    ['  maya@masaischool.ac.in  ', true],
    ['maya@evilmasaischool.ac.in', false],
    ['a.b@masaischool.ac.in.evil.com', false],
    ['maya@masaischool.ac.in extra', false],
    ['maya@mail.masaischool.ac.in', false],
    ['maya.masaischool.ac.in', false],
    ['@masaischool.ac.in', false],
    ['a@@masaischool.ac.in', false],
    ['a b@masaischool.ac.in', false],
    ['', false],
    [undefined, false],
    [null, false],
  ])('%j -> %s', (email, expected) => {
    expect(isAllowedEmail(email)).toBe(expected)
  })

  it('words the message with the allowed domain', () => {
    expect(EMAIL_DOMAIN_MESSAGE).toBe('Use your @masaischool.ac.in email address.')
  })
})
