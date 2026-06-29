import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import { DrugPage, navigatorSearchSchema } from '@/routes/DrugPage'

const rootRoute = createRootRoute({ component: () => <Outlet /> })

const drugRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: navigatorSearchSchema,
  component: DrugPage,
})

export const router = createRouter({
  routeTree: rootRoute.addChildren([drugRoute]),
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
