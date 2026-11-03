const staticRoutes = new Set(['/', '/ticket', '/price', '/price/list'])

export function isGithubPagesRoute(path) {
  return staticRoutes.has(path)
}
