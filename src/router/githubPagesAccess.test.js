import test from 'node:test'
import assert from 'node:assert/strict'
import { isGithubPagesRoute } from './githubPagesAccess.js'

test('GitHub Pages 允许首页、票价计算及价格列表', () => {
  for (const path of ['/', '/price', '/price/list']) {
    assert.equal(isGithubPagesRoute(path), true, path)
  }
})

test('GitHub Pages 继续限制依赖后端的页面及其他路径', () => {
  for (const path of [
    '/monitor', '/train', '/list', '/station', '/history',
    '/login', '/register', '/user', '/debug', '/price/other', '/other',
  ]) {
    assert.equal(isGithubPagesRoute(path), false, path)
  }
})
