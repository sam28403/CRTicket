import express from "express";
import { installSecurity } from "./security.js";
import { pathToFileURL } from "node:url";

const app = express();

installSecurity(app);
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
    if (["POST", "PUT"].includes(req.method) && (!req.body || typeof req.body !== "object" || Array.isArray(req.body))) {
        return res.status(400).json({ success: false, message: "请求数据格式错误" });
    }
    next();
});

import userRoutes from "./routes/user.js";
import ticketRoutes from "./routes/ticket.js";

app.use("/api/user", userRoutes);
app.use("/api/ticket", ticketRoutes);

app.use((err, req, res, next) => {
    const status = err.type === "entity.too.large" ? 413 : err instanceof SyntaxError ? 400 : 500;
    res.status(status).json({ success: false, message: status === 500 ? "服务器处理失败" : "请求数据格式错误或过大" });
});

export default app;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) app.listen(3000, "127.0.0.1", () => {
    console.log("后端运行：http://localhost:3000");
});
