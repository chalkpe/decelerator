export const scopes = 'read'
export const createRedirectUri = (domain: string) => `http://localhost:5173/api/auth/oauth2/callback/${domain}`
