import { Router } from "express";
import multer from "multer";
import { verifyJWT } from "../../middleware/auth.js";
import { isAdmin } from "../../middleware/isAdmin.js";
import {
  create,
  enterMarks,
  getByBatch,
  getOMRUrl,
  getOne,
  getSubmissionList,
  remove,
  submit,
  togglePublish,
  update,
  uploadOMR,
} from "./exam.controller.js";

const storage = multer.memoryStorage();

const pdfUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  },
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG and PNG images are allowed"), false);
    }
  },
});

const router = Router();

// Batch level
router.get("/batch/:batchId", verifyJWT, getByBatch);

// Single exam
router.get("/:id", verifyJWT, getOne);
router.get("/:id/omr-sheet", verifyJWT, getOMRUrl);
router.get("/:id/my-submission", verifyJWT, submit);
router.get("/:id/submissions", verifyJWT, isAdmin, getSubmissionList);

// Admin only
router.post("/", verifyJWT, isAdmin, create);
router.post(
  "/:id/omr-sheet",
  verifyJWT,
  isAdmin,
  pdfUpload.single("omrSheet"),
  uploadOMR,
);
router.put("/:id", verifyJWT, isAdmin, update);
router.patch("/:id/toggle-publish", verifyJWT, isAdmin, togglePublish);
router.patch(
  "/submissions/:submissionId/marks",
  verifyJWT,
  isAdmin,
  enterMarks,
);
router.delete("/:id", verifyJWT, isAdmin, remove);

// Student
router.post("/:id/submit", verifyJWT, imageUpload.single("omrAnswer"), submit);

export default router;
