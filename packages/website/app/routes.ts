import { index, layout, prefix, type RouteConfig, route } from '@react-router/dev/routes'

export default [
  index('routes/index.tsx'),
  ...prefix('home', [
    layout('routes/home/layout.tsx', [
      index('routes/home/index.tsx'),
      route('sse', 'routes/home/sse.tsx'),
      route('timeline', 'routes/home/timeline.tsx'),
      route('posts/:sortBy?', 'routes/home/posts.tsx'),
    ]),
  ]),

  route('api/auth/oauth2/callback/:domain', 'routes/api/auth/oauth2/callback/domain.tsx'),
  route('api/auth/callback/:domain', 'routes/api/auth/callback/domain.tsx'),
  route('api/auth/*', 'routes/api/auth/catch.tsx'),
] satisfies RouteConfig
