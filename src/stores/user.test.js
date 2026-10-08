import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

test('登录缓存必须与服务端会话一致', async t => {
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
    const { useUserStore } = await vite.ssrLoadModule('/src/stores/user.js')
    const { default: api } = await vite.ssrLoadModule('/src/api.js')
    const originalGet = api.get
    const originalPost = api.post
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    const storage = new Map()
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, String(value)),
            removeItem: key => storage.delete(key),
        },
    })
    t.after(async () => {
        api.get = originalGet
        api.post = originalPost
        if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
        else delete globalThis.localStorage
        await vite.close()
    })

    await t.test('重启后旧登录缓存遇到 401 时清理用户资料', async () => {
        setActivePinia(createPinia())
        storage.set('login', 'true')
        storage.set('user', JSON.stringify({ id: 1, username: 'old-user' }))
        const store = useUserStore()
        store.init()
        api.get = async () => { throw { response: { status: 401 } } }
        assert.equal(await store.checkSession(), false)
        assert.equal(store.isLogin, false)
        assert.equal(storage.get('login'), 'false')
        assert.equal(storage.has('user'), false)
    })

    await t.test('有效会话修复缺失或损坏的本地用户资料', async () => {
        setActivePinia(createPinia())
        storage.set('login', 'true')
        storage.set('user', '{broken')
        const user = { id: 2, username: 'current-user', avatar: null }
        api.get = async path => {
            assert.equal(path, '/user/session')
            return { data: { success: true, user } }
        }
        const store = useUserStore()
        assert.equal(await store.checkSession(), true)
        assert.equal(store.isLogin, true)
        assert.equal(storage.get('login'), 'true')
        assert.deepEqual(JSON.parse(storage.get('user')), user)
    })

    await t.test('网络故障保留登录缓存，由入口提示重试', async () => {
        setActivePinia(createPinia())
        const store = useUserStore()
        store.init()
        const previousUser = storage.get('user')
        const error = new Error('Network Error')
        api.get = async () => { throw error }
        await assert.rejects(store.checkSession(), error)
        assert.equal(store.isLogin, true)
        assert.equal(storage.get('user'), previousUser)
        assert.equal(storage.get('login'), 'true')
    })

    await t.test('登出立即清理本地状态，服务器响应前也不能重新进入历史记录', async () => {
        setActivePinia(createPinia())
        const store = useUserStore()
        store.setLogin(true)
        storage.set('user', JSON.stringify({ id: 1, username: 'alice' }))
        let finishLogout
        api.post = (path, body) => {
            assert.equal(path, '/user/logout')
            assert.deepEqual(body, {})
            return new Promise(resolve => { finishLogout = resolve })
        }
        api.get = () => assert.fail('登出后不应通过旧 Cookie 恢复登录')
        const request = store.logout()
        assert.equal(store.isLogin, false)
        assert.equal(storage.get('login'), 'false')
        assert.equal(storage.has('user'), false)
        assert.equal(await store.checkSession(), false)
        finishLogout({ data: { success: true } })
        await request
    })

    await t.test('服务器登出失败时，刷新或再次进入仍保持未登录', async () => {
        setActivePinia(createPinia())
        const store = useUserStore()
        store.setLogin(true)
        const error = new Error('Network Error')
        api.post = async () => { throw error }
        api.get = () => assert.fail('服务器残留的会话不能覆盖登出状态')
        await assert.rejects(store.logout(), error)
        store.init()
        assert.equal(await store.checkSession(), false)
        assert.equal(store.isLogin, false)
        assert.equal(storage.get('login'), 'false')
        storage.delete('login')
        assert.equal(await store.checkSession(), false)
    })

    await t.test('登出前发出的会话请求稍后成功也不能恢复旧账户', async () => {
        setActivePinia(createPinia())
        const store = useUserStore()
        store.setLogin(true)
        let finishCheck
        api.get = () => new Promise(resolve => { finishCheck = resolve })
        api.post = async () => ({ data: { success: true } })
        const pending = store.checkSession()
        await store.logout()
        finishCheck({ data: { success: true, user: { id: 1, username: 'alice' } } })
        assert.equal(await pending, false)
        assert.equal(store.isLogin, false)
        assert.equal(storage.has('user'), false)
        assert.equal(storage.get('login'), 'false')
    })

    await t.test('重新登录后，旧账户的在途响应不能覆盖新账户', async () => {
        setActivePinia(createPinia())
        const store = useUserStore()
        store.setLogin(true)
        let finishCheck
        api.get = () => new Promise(resolve => { finishCheck = resolve })
        const pending = store.checkSession()
        await store.logout()
        const user = { id: 2, username: 'bob', avatar: null }
        storage.set('user', JSON.stringify(user))
        store.setLogin(true)
        finishCheck({ data: { success: true, user: { id: 1, username: 'alice' } } })
        assert.equal(await pending, false)
        assert.deepEqual(JSON.parse(storage.get('user')), user)
        api.get = async () => ({ data: { success: true, user } })
        assert.equal(await store.checkSession(), true)
    })
})
