// JWT Verification - Checks for a valid JWT in the request and attaches the user info to req.user if valid.
import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import prisma from "../config/db.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.headers["authorization"]?.replace("Bearer ", "");

  if (!token) {
    throw new ApiError(401, "Unauthorized — no token provided");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new ApiError(401, "Unauthorized — invalid or expired token");
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { id: true, name: true, email: true, phone: true, role: true },
  });

  if (!user) {
    throw new ApiError(401, "Unauthorized — user no longer exists");
  }

  req.user = user;
  next();
});