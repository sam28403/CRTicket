import express from "express";
const router = express.Router();
import db from "../db/db.js";
import { INSERT_TICKET_SQL } from "../db/ticketQueries.js";
import { requireSession } from "../auth.js";
import { validTicket, ticketQuota } from "./ticketValidation.js";
import { ticketFieldValues } from "../../src/utils/ticketFields.js";
import { createTicketBatchHandler } from "./ticketBatch.js";

router.post("/add-batch", createTicketBatchHandler(db));

// 添加车票
router.post("/add", (req, res) => {
    const t = req.body;
    const sessionUser = requireSession(req, res);
    if (!sessionUser) {
        return;
    }

    if (!validTicket(t)) return res.status(400).json({ success: false, message: "车票字段格式错误或过长" });
    if (
        db.prepare("SELECT COUNT(*) AS count FROM tickets WHERE user_id = ?")
            .get(sessionUser.userId).count >= ticketQuota
    ) {
        return res.status(409).json({ success: false, message: "车票数量已达10000条上限" });
    }
    try {
        const stmt = db.prepare(INSERT_TICKET_SQL);

        stmt.run(
            sessionUser.userId,
            ...ticketFieldValues(t),
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

    if (!validTicket(t)) return res.status(400).json({ success: false, message: "车票字段格式错误或过长" });
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
            ...ticketFieldValues(t),
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
