import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { errorHandler } from "./src/middleware/errorHandler.js";

// Route imports (we'll uncomment these as we build each module)
import authRoutes from "./src/modules/auth/auth.routes.js";
import batchRoutes from "./src/modules/batch/batch.routes.js";
import liveClassRoutes from "./src/modules/liveClass/liveClass.routes.js";
import recordingRoutes from "./src/modules/recording/recording.routes.js";
// import examRoutes from "./src/modules/exam/exam.routes.js";
// import paymentRoutes from "./src/modules/payment/payment.routes.js";
// import studentRoutes from "./src/modules/student/student.routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Global Middleware ───────────────────────────────────────────
app.use(helmet());
app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true, // allows cookies to be sent cross-origin
  }),
);

// ─── Health Check ────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Server is running" });
});

// ─── Routes ──────────────────────────────────────────────────────
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/batches", batchRoutes);
app.use("/api/v1/live-classes", liveClassRoutes);
app.use("/api/v1/recordings", recordingRoutes);
// app.use("/api/v1/exams", examRoutes);
// app.use("/api/v1/payments", paymentRoutes);
// app.use("/api/v1/students", studentRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ─── Global Error Handler ─────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
