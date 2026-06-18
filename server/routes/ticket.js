import express from "express";
const router = express.Router();
import db from "../db/db.js";  // 确保 db.js 也改成了 ES 模块语法
import { requireSession } from "../auth.js";

// 添加车票
router.post("/add", (req, res) => {
    const t = req.body;
    const sessionUser = requireSession(req, res);
    if (!sessionUser) {
        return;
    }

    try {
        const stmt = db.prepare(`
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

        stmt.run(
            sessionUser.userId,
            t.ticket_number,
            t.train_no,
            t.departure_station,
            t.arrival_station,
            t.travel_date,
            t.departure_time,
            t.price,
            t.use_credit,
            t.seat_type,
            t.has_conditioner,
            t.seat_no,
            t.sell_place,
            t.gate_info,
            t.message,
            t.theme,
            t.distance,
        );

        res.json({ success: true, message: "保存成功" });
    } catch (err) {
        console.log(err)
        res.json({ success: false, message: "保存失败" });
        /*res.json({
            success: false,
            message: err.message
        });*/
    }
});

// 查询车票
router.get("/list/:userId", (req, res) => {
    const userId = req.params.userId;
    const sessionUser = requireSession(req, res);
    if (!sessionUser) {
        return;
    }

    if (String(sessionUser.userId) !== String(userId)) {
        return res.status(403).json({ success: false, message: "无权访问该用户数据" });
    }

    const list = db.prepare(`
        SELECT * FROM tickets WHERE user_id = ?
        ORDER BY created_at DESC
    `).all(sessionUser.userId);

    res.json(list);
});

// 删除车票
router.delete("/delete/:id", (req, res) => {
    const id = req.params.id;
    const sessionUser = requireSession(req, res);
    if (!sessionUser) {
        return;
    }

    db.prepare(`DELETE FROM tickets WHERE id = ? AND user_id = ?`).run(id, sessionUser.userId);

    res.json({ success: true });
});

const updateTicketHandler = (req, res) => {
    const id = req.params.id;
    const t = req.body;
    const sessionUser = requireSession(req, res);
    if (!sessionUser) {
        return;
    }

    try {
        const stmt = db.prepare(`
            UPDATE tickets SET
                ticket_number = ?,
                train_no = ?,
                departure_station = ?,
                arrival_station = ?,
                travel_date = ?,
                departure_time = ?,
                price = ?,
                use_credit = ?,
                seat_type = ?,
                has_conditioner = ?,
                seat_no = ?,
                sell_place = ?,
                gate_info = ?,
                message = ?,
                theme = ?,
                distance = ?
            WHERE id = ? AND user_id = ?
        `);

        const result = stmt.run(
            t.ticket_number,
            t.train_no,
            t.departure_station,
            t.arrival_station,
            t.travel_date,
            t.departure_time,
            t.price,
            t.use_credit,
            t.seat_type,
            t.has_conditioner,
            t.seat_no,
            t.sell_place,
            t.gate_info,
            t.message,
            t.theme,
            t.distance,
            id,
            sessionUser.userId
        );

        if (result.changes > 0) {
            res.json({ success: true, message: "更新成功" });
        } else {
            res.json({ success: false, message: "未找到可更新记录" });
        }
    } catch (err) {
        console.log(err);
        res.json({ success: false, message: "更新失败" });
    }
};

// 更新车票（兼容 PUT / POST）
router.put("/update/:id", updateTicketHandler);
router.post("/update/:id", updateTicketHandler);

export default router;
