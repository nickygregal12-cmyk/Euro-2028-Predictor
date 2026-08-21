// Google OAuth is a hosted capability: repository code can support it without
// pretending the Supabase provider/callback is configured. Keep the CTA hidden
// until the target deployment explicitly enables it after the provider and
// redirect allow-list are proven.
export const googleAuthEnabled = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true'
