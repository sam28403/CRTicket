import express from "express";
const router = express.Router();
import db from "../db/db.js";
import bcrypt from "bcryptjs";
import { attachSession, clearSession, requireSession } from "../auth.js";

const BACKUP_TICKET_FIELDS = [
    "ticket_number",
    "train_no",
    "departure_station",
    "arrival_station",
    "travel_date",
    "departure_time",
    "price",
    "use_credit",
    "seat_type",
    "has_conditioner",
    "seat_no",
    "sell_place",
    "gate_info",
    "message",
    "theme",
    "distance",
];

const normalizeComparableValue = (value) => {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value);
};

const ticketFingerprint = (ticket) => {
    return BACKUP_TICKET_FIELDS.map((field) => normalizeComparableValue(ticket[field])).join("||");
};

const toNullableText = (value) => {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    return String(value);
};

const toNullableNumber = (value) => {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const mapBackupTicket = (ticket) => {
    if (!ticket || typeof ticket !== "object") {
        return null;
    }

    return {
        ticket_number: toNullableText(ticket.ticket_number ?? ticket.number),
        train_no: toNullableText(ticket.train_no ?? ticket.trainNo),
        departure_station: toNullableText(ticket.departure_station ?? ticket.departureStation ?? ticket.from),
        arrival_station: toNullableText(ticket.arrival_station ?? ticket.arrivalStation ?? ticket.to),
        travel_date: toNullableText(ticket.travel_date ?? ticket.travelDate ?? ticket.date),
        departure_time: toNullableText(ticket.departure_time ?? ticket.departureTime ?? ticket.time),
        price: toNullableNumber(ticket.price),
        use_credit: toNullableNumber(ticket.use_credit ?? ticket.useCredit) ?? 0,
        seat_type: toNullableText(ticket.seat_type ?? ticket.seatType),
        has_conditioner: toNullableNumber(ticket.has_conditioner ?? ticket.hasConditioner) ?? 0,
        seat_no: toNullableText(ticket.seat_no ?? ticket.seatNo),
        sell_place: toNullableText(ticket.sell_place ?? ticket.sellPlace),
        gate_info: toNullableText(ticket.gate_info ?? ticket.gate),
        message: toNullableText(ticket.message),
        theme: toNullableText(ticket.theme),
        distance: toNullableNumber(ticket.distance) ?? 0,
    };
};

// 注册接口
router.post("/register", (req, res) => {
    const { username, password } = req.body;

    if (!password || password.length < 8) {
        return res.json({ success: false, message: "密码长度至少为8位" });
    }
    if (!/\d/.test(password)) {
        return res.json({ success: false, message: "密码中必须包含数字" });
    }
    let types = 0;
    if (/\d/.test(password)) types++;
    if (/[A-Z]/.test(password)) types++;
    if (/[a-z]/.test(password)) types++;
    if (/[^A-Za-z0-9]/.test(password)) types++;
    if (types < 2) {
        return res.json({ success: false, message: "密码在数字、大写字母、小写字母、特殊符号中至少要包含两种" });
    }

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
        attachSession(res, user);
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

router.post("/logout", (req, res) => {
    clearSession(req, res);
    return res.json({ success: true, message: "已退出登录" });
});

// 用户资料更新接口（用户名和密码二选一或同时修改）
router.post("/update-profile", (req, res) => {
    const sessionUser = requireSession(req, res);
    if (!sessionUser) {
        return;
    }

    const { username, password } = req.body;

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(sessionUser.userId);
    if (!user) {
        return res.json({ success: false, message: "用户不存在" });
    }

    const nextUsername = typeof username === "string" ? username.trim() : "";
    const nextPassword = typeof password === "string" ? password.trim() : "";

    if (!nextUsername && !nextPassword) {
        return res.json({ success: false, message: "没有可更新的内容" });
    }

    if (nextPassword) {
        if (nextPassword.length < 8) {
            return res.json({ success: false, message: "密码长度至少为8位" });
        }
        if (!/\d/.test(nextPassword)) {
            return res.json({ success: false, message: "密码中必须包含数字" });
        }
        let types = 0;
        if (/\d/.test(nextPassword)) types++;
        if (/[A-Z]/.test(nextPassword)) types++;
        if (/[a-z]/.test(nextPassword)) types++;
        if (/[^A-Za-z0-9]/.test(nextPassword)) types++;
        if (types < 2) {
            return res.json({ success: false, message: "密码在数字、大写字母、小写字母、特殊符号中至少要包含两种" });
        }
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
        db.prepare("UPDATE users SET username = ?, password = ? WHERE id = ?").run(finalUsername, finalPassword, sessionUser.userId);
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
    const sessionUser = requireSession(req, res);
    if (!sessionUser) {
        return;
    }

    const { password } = req.body;

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(sessionUser.userId);
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
    const sessionUser = requireSession(req, res);
    if (!sessionUser) {
        return;
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(sessionUser.userId);
    if (!user) {
        return res.json({ success: false, message: "用户不存在" });
    }

    try {
        // 先删除用户的所有车票记录
        db.prepare("DELETE FROM tickets WHERE user_id = ?").run(sessionUser.userId);
        // 再删除用户
        db.prepare("DELETE FROM users WHERE id = ?").run(sessionUser.userId);
        clearSession(req, res);
        return res.json({ success: true, message: "账户已删除" });
    } catch (err) {
        console.error(err);
        return res.json({ success: false, message: "删除失败，请稍后重试" });
    }
});

// 获取个人运转数据统计
router.get("/statistics", (req, res) => {
    const sessionUser = requireSession(req, res);
    if (!sessionUser) {
        return;
    }

    try {
        // 获取用户的出发和到达站点统计（返回全部数据，前端排序取 TOP 10）
        const departureStats = db.prepare(`
            SELECT departure_station as station, COUNT(*) as count
            FROM tickets
            WHERE user_id = ? AND departure_station IS NOT NULL AND departure_station != ''
            GROUP BY departure_station
            ORDER BY count DESC
        `).all(sessionUser.userId);

        const arrivalStats = db.prepare(`
            SELECT arrival_station as station, COUNT(*) as count
            FROM tickets
            WHERE user_id = ? AND arrival_station IS NOT NULL AND arrival_station != ''
            GROUP BY arrival_station
            ORDER BY count DESC
        `).all(sessionUser.userId);

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
    const sessionUser = requireSession(req, res);
    if (!sessionUser) {
        return;
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
        `).all(sessionUser.userId);

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
    const sessionUser = requireSession(req, res);
    if (!sessionUser) {
        return;
    }

    const { year, month } = req.query;

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
        `).all(sessionUser.userId, `${prefix}%`);

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

// 导入备份数据，完全相同的车票记录自动略过
router.post("/import-backup", (req, res) => {
    const sessionUser = requireSession(req, res);
    if (!sessionUser) {
        return;
    }

    const { backup } = req.body;

    const user = db.prepare("SELECT id FROM users WHERE id = ?").get(sessionUser.userId);
    if (!user) {
        return res.json({ success: false, message: "用户不存在" });
    }

    let payload = backup;
    if (typeof payload === "string") {
        try {
            payload = JSON.parse(payload);
        } catch (err) {
            return res.json({ success: false, message: "备份文件格式错误" });
        }
    }

    const sourceTickets = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.tickets)
            ? payload.tickets
            : null;

    if (!sourceTickets) {
        return res.json({ success: false, message: "未找到可导入的车票数据" });
    }

    try {
        const existingTickets = db.prepare(`
            SELECT
                ticket_number,
                train_no,
                departure_station,
                arrival_station,
                travel_date,
                departure_time,
                price,
                use_credit,
                seat_type,
                has_conditioner,
                seat_no,
                sell_place,
                gate_info,
                message,
                theme,
                distance
            FROM tickets
            WHERE user_id = ?
        `).all(sessionUser.userId);

        const existingSet = new Set(existingTickets.map(ticketFingerprint));
        const insertStmt = db.prepare(`
            INSERT INTO tickets (
                user_id, ticket_number, train_no,
                departure_station, arrival_station,
                travel_date, departure_time,
                price, use_credit,
                seat_type, has_conditioner,
                seat_no, sell_place, gate_info,
                message, theme, distance
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let imported = 0;
        let skipped = 0;
        let invalid = 0;

        const insertMany = db.transaction((tickets) => {
            for (const rawTicket of tickets) {
                const ticket = mapBackupTicket(rawTicket);
                if (!ticket) {
                    invalid += 1;
                    continue;
                }

                const fingerprint = ticketFingerprint(ticket);
                if (existingSet.has(fingerprint)) {
                    skipped += 1;
                    continue;
                }

                insertStmt.run(
                    sessionUser.userId,
                    ticket.ticket_number,
                    ticket.train_no,
                    ticket.departure_station,
                    ticket.arrival_station,
                    ticket.travel_date,
                    ticket.departure_time,
                    ticket.price,
                    ticket.use_credit,
                    ticket.seat_type,
                    ticket.has_conditioner,
                    ticket.seat_no,
                    ticket.sell_place,
                    ticket.gate_info,
                    ticket.message,
                    ticket.theme,
                    ticket.distance
                );

                existingSet.add(fingerprint);
                imported += 1;
            }
        });

        insertMany(sourceTickets);

        return res.json({
            success: true,
            message: "备份导入完成",
            data: {
                imported,
                skipped,
                invalid,
                total: sourceTickets.length,
            }
        });
    } catch (err) {
        console.error(err);
        return res.json({ success: false, message: "导入备份失败" });
    }
});

export default router;
