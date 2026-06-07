import express from "express";
const router = express.Router();
import db from "../db/db.js";
import bcrypt from "bcryptjs";

// 注册接口
router.post("/register", (req, res) => {
    const { username, password } = req.body;

    // 检查用户名是否已存在
    const existingUser = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (existingUser) {
        return res.json({ success: false, message: "用户名已存在" });
    }

    // 密码加密
    const hashedPassword = bcrypt.hashSync(password, 10);

    // 插入新用户
    const stmt = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)");
    try {
        stmt.run(username, hashedPassword);
        res.json({ success: true, message: "注册成功" });
    } catch (err) {
        res.json({ success: false, message: "注册失败，请重试" });
    }
});

// 登录接口
router.post("/login", (req, res) => {
    const { username, password } = req.body;

    // 查询用户
    const user = db.prepare(`
        SELECT * FROM users WHERE username = ?
    `).get(username);

    // 用户不存在
    if (!user) {
        return res.json({
            success: false,
            message: "用户名或密码错误"
        });
    }

    // 验证密码
    const isValid = bcrypt.compareSync(password, user.password);

    if (isValid) {
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username
            }
        });
    } else {
        res.json({
            success: false,
            message: "用户名或密码错误"
        });
    }
});

// 用户资料更新接口（用户名和密码二选一或同时修改）
router.post("/update-profile", (req, res) => {
    const { id, username, password } = req.body;

    if (!id) {
        return res.json({ success: false, message: "缺少用户ID" });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!user) {
        return res.json({ success: false, message: "用户不存在" });
    }

    const nextUsername = typeof username === "string" ? username.trim() : "";
    const nextPassword = typeof password === "string" ? password.trim() : "";

    if (!nextUsername && !nextPassword) {
        return res.json({ success: false, message: "没有可更新的内容" });
    }

    if (nextUsername && nextUsername !== user.username) {
        const existingUser = db.prepare("SELECT * FROM users WHERE username = ?").get(nextUsername);
        if (existingUser) {
            return res.json({ success: false, message: "用户名已存在" });
        }
    }

    const finalUsername = nextUsername || user.username;
    const finalPassword = nextPassword ? bcrypt.hashSync(nextPassword, 10) : user.password;

    try {
        db.prepare("UPDATE users SET username = ?, password = ? WHERE id = ?").run(finalUsername, finalPassword, id);
        return res.json({
            success: true,
            message: "修改成功",
            user: {
                id: user.id,
                username: finalUsername
            }
        });
    } catch (err) {
        return res.json({ success: false, message: "更新失败，请重试" });
    }
});

// 删除账户接口（仅验证）
router.post("/delete-account", (req, res) => {
    const { id, password } = req.body;

    if (!id) {
        return res.json({ success: false, message: "缺少用户ID" });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!user) {
        return res.json({ success: false, message: "用户不存在" });
    }

    if (!password) {
        return res.json({ success: false, message: "请输入密码" });
    }

    // 验证密码
    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
        return res.json({ success: false, message: "密码错误" });
    }

    return res.json({ success: true, message: "验证通过" });
});

// 确认删除账户接口
router.post("/confirm-delete", (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res.json({ success: false, message: "缺少用户ID" });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!user) {
        return res.json({ success: false, message: "用户不存在" });
    }

    try {
        // 先删除用户的所有车票记录
        db.prepare("DELETE FROM tickets WHERE user_id = ?").run(id);
        // 再删除用户
        db.prepare("DELETE FROM users WHERE id = ?").run(id);
        return res.json({ success: true, message: "账户已删除" });
    } catch (err) {
        console.error(err);
        return res.json({ success: false, message: "删除失败，请稍后重试" });
    }
});

// 获取个人运转数据统计
router.get("/statistics", (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.json({ success: false, message: "缺少用户ID" });
    }

    try {
        // 获取用户的出发和到达站点统计（返回全部数据，前端排序取 TOP 10）
        const departureStats = db.prepare(`
            SELECT departure_station as station, COUNT(*) as count
            FROM tickets
            WHERE user_id = ? AND departure_station IS NOT NULL AND departure_station != ''
            GROUP BY departure_station
            ORDER BY count DESC
        `).all(userId);

        const arrivalStats = db.prepare(`
            SELECT arrival_station as station, COUNT(*) as count
            FROM tickets
            WHERE user_id = ? AND arrival_station IS NOT NULL AND arrival_station != ''
            GROUP BY arrival_station
            ORDER BY count DESC
        `).all(userId);

        return res.json({
            success: true,
            data: {
                departures: departureStats,
                arrivals: arrivalStats
            }
        });
    } catch (err) {
        console.error(err);
        return res.json({ success: false, message: "获取统计数据失败" });
    }
});

// 获取用户车票历史记录（用于轨迹地图）
router.get("/ticket-history", (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.json({ success: false, message: "缺少用户ID" });
    }

    try {
        const tickets = db.prepare(`
            SELECT
                id,
                departure_station as departureStation,
                arrival_station as arrivalStation,
                travel_date as travelDate,
                train_no as trainNumber
            FROM tickets
            WHERE user_id = ?
            ORDER BY travel_date DESC
            LIMIT 500
        `).all(userId);

        return res.json({
            success: true,
            data: tickets
        });
    } catch (err) {
        console.error(err);
        return res.json({ success: false, message: "获取历史记录失败" });
    }
});

// 获取月度运转日期数据（日历热力图用）
router.get("/monthly-tickets", (req, res) => {
    const { userId, year, month } = req.query;

    if (!userId) {
        return res.json({ success: false, message: "缺少用户ID" });
    }

    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;
    const prefix = `${y}年${String(m).padStart(2, '0')}月`;

    try {
        const tickets = db.prepare(`
            SELECT travel_date, COUNT(*) as count
            FROM tickets
            WHERE user_id = ?
              AND travel_date LIKE ?
            GROUP BY travel_date
            ORDER BY travel_date
        `).all(userId, `${prefix}%`);

        return res.json({
            success: true,
            data: {
                year: y,
                month: m,
                tickets: tickets
            }
        });
    } catch (err) {
        console.error(err);
        return res.json({ success: false, message: "获取月度数据失败" });
    }
});

export default router;
