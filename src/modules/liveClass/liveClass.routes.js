import { Router } from "express";
import { verifyJWT } from "../../middleware/auth.js";
import { isAdmin } from "../../middleware/isAdmin.js";
import {
  create,
  endLive,
  getByBatch,
  getOne,
  remove,
  startLive,
  update,
} from "./liveClass.controller.js";

const router = Router();

// All live class routes require login
router.get("/batch/:batchId", verifyJWT, getByBatch);
router.get("/:id", verifyJWT, getOne);

// Admin only
router.post("/", verifyJWT, isAdmin, create);
router.put("/:id", verifyJWT, isAdmin, update);
router.patch("/:id/go-live", verifyJWT, isAdmin, startLive);
router.patch("/:id/end", verifyJWT, isAdmin, endLive);
router.delete("/:id", verifyJWT, isAdmin, remove);

export default router;
