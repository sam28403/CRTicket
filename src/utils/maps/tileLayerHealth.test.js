import test from 'node:test'
import assert from 'node:assert/strict'
import { watchTileLayer } from './tileLayerHealth.js'

function setup(context) {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let events
  let errors = 0
  const layer = {
    on(value) { events = value },
    off() { events = null },
  }
  const dispose = watchTileLayer(layer, () => { errors++ }, 100)
  context.after(dispose)
  return { events: () => events, errors: () => errors, dispose }
}

test('备用瓦片报错只提示一次，部分成功不会隐藏加载失败', context => {
  const state = setup(context)
  state.events().tileerror()
  state.events().tileerror()
  state.events().load()
  context.mock.timers.tick(1000)
  assert.equal(state.errors(), 1)
})

test('备用成功后拖动的新一轮加载仍有超时，防止永久空白', context => {
  const state = setup(context)
  state.events().load()
  context.mock.timers.tick(1000)
  assert.equal(state.errors(), 0)
  state.events().loading()
  context.mock.timers.tick(100)
  assert.equal(state.errors(), 1)
})

test('离开地图时清理计时器，迟到错误不会弹出提示', context => {
  const state = setup(context)
  const staleEvents = state.events()
  state.dispose()
  staleEvents.tileerror()
  context.mock.timers.tick(1000)
  assert.equal(state.events(), null)
  assert.equal(state.errors(), 0)
})
