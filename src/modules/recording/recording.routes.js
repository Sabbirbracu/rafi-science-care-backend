import { Router } from "express";
import multer from "multer";
import { verifyJWT } from "../../middleware/auth.js";
import { isAdmin } from "../../middleware/isAdmin.js";
import {
  getByBatch,
  getStreamUrl,
  remove,
  togglePublish,
  update,
  upload,
} from "./recording.controller.js";

// Store file in memory buffer — we upload directly to R2
const storage = multer.memoryStorage();
const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    const allowed = ["video/mp4", "video/webm", "video/quicktime"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only MP4, WebM and MOV files are allowed"), false);
    }
  },
});

const router = Router();

// Student + Admin
router.get("/batch/:batchId", verifyJWT, getByBatch);
router.get("/:id/stream", verifyJWT, getStreamUrl);

// Admin only
router.post("/", verifyJWT, isAdmin, uploadMiddleware.single("video"), upload);
router.put("/:id", verifyJWT, isAdmin, update);
router.patch("/:id/toggle-publish", verifyJWT, isAdmin, togglePublish);
router.delete("/:id", verifyJWT, isAdmin, remove);

export default router;
