import cors from "cors";

export const rateLimit = (limit, windowMs) => {
    const entries = new Map();
    const timer = setInterval(() => {
        for (const [key, value] of entries) {
            if (value.until <= Date.now()) entries.delete(key);
        }
    }, windowMs);
    timer.unref();
    return (req, res, next) => {
        const key = req.ip;
        const now = Date.now();
        let entry = entries.get(key);
        if (!entry || entry.until <= now) {
            if (entries.size >= 10000) {
                return res.status(429).json({ success: false, message: "请求过于频繁，请稍后重试" });
            }
            entry = { count: 0, until: now + windowMs };
            entries.set(key, entry);
        }
        if (++entry.count > limit) {
            res.setHeader("Retry-After", Math.ceil((entry.until - now) / 1000));
            return res.status(429).json({ success: false, message: "请求过于频繁，请稍后重试" });
        }
        next();
    };
};

export const installSecurity = (app) => {
    const origins = new Set((process.env.ALLOWED_ORIGINS || (process.env.NODE_ENV === "production"
        ? "" : "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"))
        .split(",").map(value => value.trim()).filter(Boolean));
    app.disable("x-powered-by");
    app.use((req, res, next) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "no-store");
        const origin = req.get("Origin");
        if (origin && !origins.has(origin)) {
            return res.status(403).json({ success: false, message: "不允许的请求来源" });
        }
        next();
    });
    app.use(cors({ origin: [...origins], credentials: true,
        allowedHeaders: ["Content-Type", "X-CRTicket-Request"],
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] }));
    app.use("/api", rateLimit(300, 60 * 1000));
    // 浏览器跨域脚本必须经过预检，普通表单无法提供此请求头。
    app.use("/api", (req, res, next) => {
        if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("X-CRTicket-Request") !== "1") {
            return res.status(403).json({ success: false, message: "请求校验失败" });
        }
        next();
    });
};

export const validPassword = value => typeof value === "string" && value.length > 0 && Buffer.byteLength(value, "utf8") <= 72;
export const validUsername = value => typeof value === "string" && value.trim().length > 0 && value.length <= 64 && !/[\u0000-\u001f\u007f]/.test(value);
