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
        }, {});
};

const buildCookie = (name, value, maxAgeSeconds) => {
    return [
        `${name}=${value}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${maxAgeSeconds}`,
    ].join("; ");
};

const createSessionToken = () => randomBytes(32).toString("hex");

export const attachSession = (res, user) => {
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
        [
            `${SESSION_COOKIE_NAME}=`,
            "Path=/",
            "HttpOnly",
            "SameSite=Lax",
            "Max-Age=0",
        ].join("; ")
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
