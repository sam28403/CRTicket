import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_PATH = ":memory:";
process.env.NODE_ENV = "production";
process.env.ALLOWED_ORIGINS = "https://tickets.example";
const { default: app } = await import("./app.js");
const { default: db } = await import("./db/db.js");

test("安全接口回归（独立内存数据库）", async t => {
    const server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    t.after(() => { server.close(); db.close(); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (path, body, cookie, extra = {}) => {
        const response = await fetch(base + path, {
            method: body === undefined ? "GET" : "POST",
            headers: { "Content-Type": "application/json", "X-CRTicket-Request": "1", ...(cookie ? { Cookie: cookie } : {}), ...extra },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        return { status: response.status, data: await response.json(), cookie: response.headers.get("set-cookie"), headers: response.headers };
    };
    const password = "Password123";
    await t.test("跨域、CSRF、输入和错误响应", async () => {
        assert.equal((await request("/user/register", {}, null, { Origin: "https://evil.example" })).status, 403);
        assert.equal((await request("/user/register", {}, null, { "X-CRTicket-Request": "" })).status, 403);
        const allowed = await request("/user/register", { username: {}, password }, null, { Origin: "https://tickets.example" });
        assert.equal(allowed.status, 400);
        assert.equal(allowed.headers.get("access-control-allow-origin"), "https://tickets.example");
        assert.equal((await request("/user/register", { username: "long", password: "密".repeat(25) + "1" })).status, 400);
        const malformed = await fetch(base + "/user/login", { method: "POST", headers: { "Content-Type": "application/json", "X-CRTicket-Request": "1" }, body: "{" });
        assert.equal(malformed.status, 400);
        assert.equal((await malformed.json()).success, false);
        assert.equal((await request("/ticket/add", { message: "x".repeat(1024 * 1024) })).status, 413);
    });
    assert.equal((await request("/user/register", { username: "alice", password })).data.success, true);
    assert.equal((await request("/user/register", { username: "bob", password })).data.success, true);
    const alice = await request("/user/login", { username: "alice", password });
    const alice2 = await request("/user/login", { username: "alice", password });
    const bob = await request("/user/login", { username: "bob", password });
    assert.match(alice.cookie, /HttpOnly/);
    assert.match(alice.cookie, /Secure/);
    assert.equal(alice.headers.get("cache-control"), "no-store");
    const aliceId = alice.data.user.id;
    await t.test("身份和车票所有权不能通过客户端字段伪造", async () => {
        assert.equal((await request(`/ticket/list/${aliceId}`)).status, 401);
        assert.equal((await request(`/ticket/list/${aliceId}`, undefined, bob.cookie)).status, 403);
        assert.equal((await request("/ticket/add", { user_id: bob.data.user.id, departure_station: "北京", price: 20 }, alice.cookie)).data.success, true);
        const list = (await request(`/ticket/list/${aliceId}`, undefined, alice.cookie)).data;
        assert.equal(list[0].user_id, aliceId);
        assert.equal((await request(`/ticket/update/${list[0].id}`, { departure_station: "篡改" }, bob.cookie)).data.success, false);
        await fetch(base + `/ticket/delete/${list[0].id}`, { method: "DELETE", headers: { Cookie: bob.cookie, "X-CRTicket-Request": "1" } });
        assert.equal(db.prepare("SELECT COUNT(*) AS count FROM tickets").get().count, 1);
        assert.equal((await request("/ticket/add", { departure_station: {} }, alice.cookie)).status, 400);
        assert.equal((await request("/ticket/add", { price: -1 }, alice.cookie)).status, 400);
        assert.equal((await request("/user/import-backup", { backup: [{} , { departure_station: {} }] }, alice.cookie)).data.data.invalid, 1);
    });
    let renewed;
    await t.test("敏感操作要求密码，修改后撤销所有旧会话", async () => {
        assert.equal((await request("/user/confirm-delete", {}, alice.cookie)).status, 403);
        assert.equal((await request("/user/confirm-delete", { password: "wrong" }, alice.cookie)).status, 403);
        assert.equal((await request("/user/update-profile", { password: "Changed123" }, alice.cookie)).status, 403);
        const update = await request("/user/update-profile", { currentPassword: password, password: "Changed123" }, alice.cookie);
        assert.equal(update.data.success, true);
        renewed = update.cookie;
        assert.equal((await request(`/ticket/list/${aliceId}`, undefined, alice.cookie)).status, 401);
        assert.equal((await request(`/ticket/list/${aliceId}`, undefined, alice2.cookie)).status, 401);
        assert.equal((await request(`/ticket/list/${aliceId}`, undefined, renewed)).status, 200);
        assert.equal((await request("/user/confirm-delete", { password: "Changed123" }, renewed)).data.success, true);
        assert.equal((await request(`/ticket/list/${aliceId}`, undefined, renewed)).status, 401);
        assert.equal(db.prepare("SELECT COUNT(*) AS count FROM tickets WHERE user_id = ?").get(aliceId).count, 0);
    });
    await t.test("认证限流", async () => {
        let response;
        for (let i = 0; i < 21; i++) response = await request("/user/login", {});
        assert.equal(response.status, 429);
        assert.ok(Number(response.headers.get("retry-after")) > 0);
    });
});
