import { randomBytes } from "node:crypto";

const SESSION_COOKIE_NAME = "crticket_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const sessions = new Map();

const parseCookies = (cookieHeader = "") => {
    return cookieHeader
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .reduce((acc, part) => {
            const index = part.indexOf("=");
            if (index === -1) {
                return acc;
            }

            const key = part.slice(0, index).trim();
            const value = part.slice(index + 1).trim();
            if (key) {
                acc[key] = value;
            }
            return acc;
        }, Object.create(null));
};

const buildCookie = (name, value, maxAgeSeconds) => {
    return [
        `${name}=${value}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
        `Max-Age=${maxAgeSeconds}`,
    ].join("; ");
};

const createSessionToken = () => randomBytes(32).toString("hex");

export const revokeUserSessions = (userId) => {
    for (const [token, session] of sessions) {
        if (session.userId === userId) sessions.delete(token);
    }
};

const cleanup = setInterval(() => {
    for (const [token, session] of sessions) {
        if (session.expiresAt <= Date.now()) sessions.delete(token);
    }
}, 60000);
cleanup.unref();

export const attachSession = (res, user) => {
    // 限制每个账户的活跃会话数量。
    const userTokens = [...sessions].filter(([, session]) => session.userId === user.id);
    for (const [token] of userTokens.slice(0, Math.max(0, userTokens.length - 4))) sessions.delete(token);
    if (sessions.size >= 10000) sessions.delete(sessions.keys().next().value);
    const token = createSessionToken();
    sessions.set(token, {
        userId: user.id,
        username: user.username,
        expiresAt: Date.now() + SESSION_TTL_MS,
    });

    res.setHeader("Set-Cookie", buildCookie(SESSION_COOKIE_NAME, token, Math.floor(SESSION_TTL_MS / 1000)));
    return token;
};

export const clearSession = (req, res) => {
    const cookies = parseCookies(req.headers.cookie || "");
    const token = cookies[SESSION_COOKIE_NAME];

    if (token) {
        sessions.delete(token);
    }

    res.setHeader(
        "Set-Cookie",
        buildCookie(SESSION_COOKIE_NAME, "", 0)
    );
};

export const getSessionUser = (req) => {
    const cookies = parseCookies(req.headers.cookie || "");
    const token = cookies[SESSION_COOKIE_NAME];

    if (!token) {
        return null;
    }

    const session = sessions.get(token);
    if (!session) {
        return null;
    }

    if (session.expiresAt <= Date.now()) {
        sessions.delete(token);
        return null;
    }

    return {
        token,
        userId: session.userId,
        username: session.username,
    };
};

export const requireSession = (req, res) => {
    const sessionUser = getSessionUser(req);
    if (!sessionUser) {
        res.status(401).json({ success: false, message: "请先登录" });
        return null;
    }

    return sessionUser;
};
