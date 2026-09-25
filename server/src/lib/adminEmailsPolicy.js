/**
 * ADMIN_EMAILS trusts the sign-in token's verified email claim (loadProfile,
 * middleware/access.js) - which is only actually verified while Supabase
 * requires email confirmation before a new account can sign in. With
 * "Confirm email" OFF (Supabase's `mailer_autoconfirm`), a brand-new sign-up
 * is usable immediately with an unverified address, so anyone could claim
 * one of the listed addresses (or change an existing account's email to
 * one) and be promoted to admin on their very next request. Checking
 * `email_confirmed_at` on the account does not help either - autoconfirm
 * sets it immediately, exactly like a real confirmation would.
 *
 * A pure function (no I/O), so every branch is trivial to test: given the
 * configured ADMIN_EMAILS and the project's current auth settings (or
 * `null`, when they could not be read), decide which emails actually get to
 * act as the bootstrap, and what to log for the operator. Called once at
 * startup (index.js), before createApp.
 */
export function adminEmailsPolicy(adminEmails, settings) {
  if (!adminEmails.length) return { adminEmails: [], warnings: [] }

  if (!settings) {
    return {
      adminEmails,
      warnings: [{
        level: 'warning',
        message: 'Could not read the Supabase project\'s auth settings (network error, or the project is ' +
          'unreachable). ADMIN_EMAILS stays active - double-check "Confirm email" is ON under Supabase -> ' +
          'Authentication -> Providers -> Email.',
      }],
    }
  }

  const warnings = []
  let effective = adminEmails

  // Fail closed: with unverified sign-ups usable immediately, ADMIN_EMAILS
  // cannot be trusted at all, so it is ignored entirely rather than partly
  // honoured.
  if (settings.autoconfirm) {
    warnings.push({
      level: 'error',
      message: 'ADMIN_EMAILS is IGNORED: this Supabase project has "Confirm email" OFF (autoconfirm), so a ' +
        'brand-new sign-up is usable immediately with an unverified email address - anyone could claim one ' +
        'of the listed addresses and be promoted to admin. Turn "Confirm email" ON under Supabase -> ' +
        'Authentication -> Providers -> Email, then restart the server.',
    })
    effective = []
  }

  if (!settings.signupDisabled) {
    warnings.push({
      level: 'warning',
      message: 'Public sign-ups are enabled on this Supabase project. ADMIN_EMAILS is safe only while ' +
        '"Confirm email" stays ON - consider also disabling public sign-ups under Supabase -> Authentication ' +
        '-> Providers -> Email once the first admin is set up.',
    })
  }

  return { adminEmails: effective, warnings }
}
