export const scopes = 'read'
export const createRedirectUri = (domain: string) => `${import.meta.env.VITE_REDIRECT_URL}/api/auth/oauth2/callback/${domain}`
