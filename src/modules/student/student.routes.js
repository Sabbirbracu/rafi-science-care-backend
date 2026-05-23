import { Router } from "express";
import { verifyJWT } from "../../middleware/auth.js";
import { isAdmin } from "../../middleware/isAdmin.js";
import {
  allStudents,
  dashboard,
  myBatches,
  myPendingExams,
  myResults,
  myUpcomingClasses,
  profile,
  studentDetail,
  updatePassword,
  updateProfile,
} from "./student.controller.js";

const router = Router();

// ─── Student routes (protected) ───────────────────────────────────
router.get("/dashboard", verifyJWT, dashboard);
router.get("/my-batches", verifyJWT, myBatches);
router.get("/my-live-classes", verifyJWT, myUpcomingClasses);
router.get("/my-exams", verifyJWT, myPendingExams);
router.get("/my-results", verifyJWT, myResults);
router.get("/profile", verifyJWT, profile);
router.put("/profile", verifyJWT, updateProfile);
router.patch("/change-password", verifyJWT, updatePassword);

// ─── Admin routes ─────────────────────────────────────────────────
router.get("/", verifyJWT, isAdmin, allStudents);
router.get("/:id", verifyJWT, isAdmin, studentDetail);

export default router;
