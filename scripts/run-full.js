import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mode = process.argv[2];
if (!new Set(["dev", "preview"]).has(mode)) {
    console.error("Usage: node scripts/run-full.js <dev|preview>");
    process.exit(1);
}

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const viteCli = resolve(root, "node_modules/vite/bin/vite.js");
const children = [
    spawn(process.execPath, [viteCli, ...(mode === "preview" ? ["preview"] : [])], {
        cwd: root,
        stdio: "inherit",
    }),
    spawn(process.execPath, [resolve(root, "server/app.js")], {
        cwd: root,
        stdio: "inherit",
    }),
];

let stopping = false;
function stop(signal = "SIGTERM", exitCode = 0) {
    if (stopping) return;
    stopping = true;
    for (const child of children) {
        if (child.exitCode === null && child.signalCode === null) child.kill(signal);
    }
    process.exitCode = exitCode;
}

for (const child of children) {
    child.on("error", (error) => {
        console.error(error);
        stop("SIGTERM", 1);
    });
    child.on("exit", (code) => {
        if (!stopping) stop("SIGTERM", code ?? 1);
    });
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
