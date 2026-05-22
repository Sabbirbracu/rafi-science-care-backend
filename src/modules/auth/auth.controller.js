// Thin layer — just handles request/response, calls service:

import ApiResponse from "../../utils/ApiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { loginUser, refreshAccessToken, registerUser } from "./auth.service.js";

const COOKIE_OPTIONS = {
  httpOnly: true, // JS cannot access — XSS protection
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ─── Register ─────────────────────────────────────────────────────

export const register = asyncHandler(async (req, res) => {
  const { name, phone, email, password } = req.body;
  const user = await registerUser({ name, phone, email, password });

  return res
    .status(201)
    .json(new ApiResponse(201, user, "Registration successful"));
});

// ─── Login ────────────────────────────────────────────────────────

export const login = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;
  const { user, accessToken, refreshToken } = await loginUser({
    phone,
    password,
  });

  return res
    .status(200)
    .cookie("refreshToken", refreshToken, COOKIE_OPTIONS)
    .json(new ApiResponse(200, { user, accessToken }, "Login successful"));
});

// ─── Refresh Token ────────────────────────────────────────────────

export const refresh = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;

  const { accessToken, refreshToken } =
    await refreshAccessToken(incomingRefreshToken);

  return res
    .status(200)
    .cookie("refreshToken", refreshToken, COOKIE_OPTIONS)
    .json(new ApiResponse(200, { accessToken }, "Token refreshed"));
});

// ─── Logout ───────────────────────────────────────────────────────

export const logout = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .clearCookie("refreshToken", COOKIE_OPTIONS)
    .json(new ApiResponse(200, null, "Logged out successfully"));
});

// ─── Get Current User ─────────────────────────────────────────────

export const getMe = asyncHandler(async (req, res) => {
  // DOUBLE QUERRY. We already have user in req.user from auth middleware.
  // const user = await getCurrentUser(req.user.id);
  return res
    .status(200)
    .json(new ApiResponse(200, user, "User fetched successfully"));
});
