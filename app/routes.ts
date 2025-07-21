import { index, type RouteConfig, route } from '@react-router/dev/routes'

export default [
  index('routes/index.tsx'),
  route('home', 'routes/home/index.tsx'),
  route('api/auth/oauth2/callback/:domain', 'routes/api/auth/oauth2/callback/domain.tsx'),
  route('api/auth/callback/:domain', 'routes/api/auth/callback/domain.tsx'),
  route('api/auth/*', 'routes/api/auth/catch.tsx'),
] satisfies RouteConfig
