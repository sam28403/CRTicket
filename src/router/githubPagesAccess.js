const staticRoutes = new Set(['/', '/price', '/price/list'])

export function isGithubPagesRoute(path) {
  return staticRoutes.has(path)
}
