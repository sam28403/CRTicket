import express from "express";
import cors from "cors";

const app = express();

app.use(cors({
    origin: true,
    credentials: true,
}));
app.use(express.json());

import userRoutes from "./routes/user.js";
import ticketRoutes from "./routes/ticket.js";

app.use("/api/user", userRoutes);
app.use("/api/ticket", ticketRoutes);

app.listen(3000, () => {
    console.log("后端运行：http://localhost:3000");
});
