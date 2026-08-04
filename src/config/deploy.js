export const DEPLOY_TARGET = (import.meta.env.VITE_DEPLOY_TARGET || 'local').toLowerCase()

export const isGithubPagesBuild = DEPLOY_TARGET === 'github' || DEPLOY_TARGET === 'gh-pages' || DEPLOY_TARGET === 'ghpages'

