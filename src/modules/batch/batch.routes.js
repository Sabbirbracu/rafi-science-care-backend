import { Router } from "express";
import {
  create,
  getAll,
  getOne,
  update,
  toggle,
  remove,
  getStudents,
} from "./batch.controller.js";
import { verifyJWT } from "../../middleware/auth.js";
import { isAdmin } from "../../middleware/isAdmin.js";

const router = Router();

// Public
router.get("/", getAll);
router.get("/:id", getOne);

// Admin only
router.post("/", verifyJWT, isAdmin, create);
router.put("/:id", verifyJWT, isAdmin, update);
router.patch("/:id/toggle", verifyJWT, isAdmin, toggle);
router.delete("/:id", verifyJWT, isAdmin, remove);
router.get("/:id/students", verifyJWT, isAdmin, getStudents);

export default router;