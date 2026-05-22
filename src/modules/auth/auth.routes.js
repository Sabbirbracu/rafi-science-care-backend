import { Router } from "express";
import { verifyJWT } from "../../middleware/auth.js";
import { getMe, login, logout, refresh, register } from "./auth.controller.js";

const router = Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);

// Protected routes
router.post("/logout", verifyJWT, logout);
router.get("/me", verifyJWT, getMe);

export default router;
