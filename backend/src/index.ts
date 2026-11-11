import express from "express";
import { accountsRouter } from "./routes/accounts.js";
import { recordsRouter } from "./routes/records.js";
import { tasksRouter } from "./routes/tasks.js";
import { restoreJobs } from "./scheduler/cron.js";
import { loadStore } from "./store/jsonStore.js";

const PORT = Number(process.env.PORT) || 3001;
const app = express();

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, data: { status: "up" } });
});

app.use("/api/accounts", accountsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/records", recordsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "内部错误";
  res.status(500).json({ ok: false, error: message });
});

const started = await loadStore();
restoreJobs();
app.listen(PORT, "0.0.0.0", () => {
  console.log(`backend listening on ${PORT}, corrupted=${started.corrupted}`);
});
