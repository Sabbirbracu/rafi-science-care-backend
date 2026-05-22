import { Router } from "express";
import { verifyJWT } from "../../middleware/auth.js";
import { isAdmin } from "../../middleware/isAdmin.js";
import {
  cancel,
  fail,
  history,
  initiate,
  ipn,
  myPayments,
  success,
} from "./payment.controller.js";

const router = Router();

// Student — initiate payment
router.post("/initiate", verifyJWT, initiate);

// Student — own payment history
router.get("/my-payments", verifyJWT, myPayments);

// Admin — full payment history
router.get("/", verifyJWT, isAdmin, history);

// SSLCommerz callbacks — public, no JWT
router.post("/success", success);
router.post("/fail", fail);
router.post("/cancel", cancel);
router.post("/ipn", ipn);

export default router;
