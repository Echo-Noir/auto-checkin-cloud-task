import { Router } from "express";
import { getData } from "../store/jsonStore.js";
import { ok } from "../util.js";

export const recordsRouter = Router();

recordsRouter.get("/", (req, res) => {
  const accountId = typeof req.query.accountId === "string" ? req.query.accountId : "";
  let limit = Number(req.query.limit);
  if (!Number.isFinite(limit) || limit <= 0) limit = 100;
  if (limit > 100) limit = 100;
  let list = [...getData().records].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  if (accountId) list = list.filter((r) => r.accountId === accountId);
  res.json(ok({ records: list.slice(0, limit) }));
});
