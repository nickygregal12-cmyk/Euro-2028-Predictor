// Cloudflare Turnstile is OFF by default and opt-in via one public env var.
//
// When VITE_TURNSTILE_SITE_KEY is unset (the default), no widget renders and no
// captchaToken is sent — the auth flow behaves exactly as before, so shipping
// this code changes nothing until you turn it on. Set the key (a PUBLIC value)
// AND enable Turnstile in the Supabase dashboard (Auth → CAPTCHA) with the
// matching secret to switch protection on. The two must move together: sending a
// token while Supabase CAPTCHA is disabled errors, and enabling Supabase CAPTCHA
// without sending a token also fails. The secret NEVER lives in this repo —
// Supabase holds it and runs siteverify.

export const TURNSTILE_SITE_KEY: string | null =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || null

export const turnstileEnabled: boolean = TURNSTILE_SITE_KEY !== null
