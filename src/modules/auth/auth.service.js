import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../../config/db.js";
import ApiError from "../../utils/ApiError.js";

// ─── Token Generators ─────────────────────────────────────────────

export const generateAccessToken = (user) => {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });
};

export const generateRefreshToken = (user) => {
  return jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });
};

// ─── Register ─────────────────────────────────────────────────────

export const registerUser = async ({ name, phone, email, password }) => {
  // Check phone is provided
  if (!name || !phone || !password) {
    throw new ApiError(400, "Name, phone and password are required");
  }

  // Phone format validation (BD number)
  const phoneRegex = /^(?:\+8801|8801|01)[3-9]\d{8}$/;
  if (!phoneRegex.test(phone)) {
    throw new ApiError(400, "Invalid Bangladeshi phone number");
  }

  // Password strength
  if (password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters");
  }

  // Check duplicate phone
  const existingPhone = await prisma.user.findUnique({ where: { phone } });
  if (existingPhone) {
    throw new ApiError(409, "Phone number already registered");
  }

  // Check duplicate email if provided
  if (email) {
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      throw new ApiError(409, "Email already registered");
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim().toLowerCase() : null,
      passwordHash,
      role: "STUDENT",
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return user;
};

// ─── Register and Get Tokens (for checkout flow) ──────────────────

export const registerAndGetTokens = async ({
  name,
  phone,
  email,
  password,
}) => {
  const user = await registerUser({ name, phone, email, password });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return { user, accessToken, refreshToken };
};

// ─── Login ────────────────────────────────────────────────────────

export const loginUser = async ({ phone, password }) => {
  if (!phone || !password) {
    throw new ApiError(400, "Phone and password are required");
  }

  // Find user — include passwordHash for comparison
  const user = await prisma.user.findUnique({ where: { phone } });

  // Generic message — don't reveal whether phone exists or not
  if (!user) {
    throw new ApiError(401, "Invalid phone number or password");
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid phone number or password");
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  const safeUser = {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
  };

  return { user: safeUser, accessToken, refreshToken };
};

// ─── Refresh Token ────────────────────────────────────────────────

export const refreshAccessToken = async (incomingRefreshToken) => {
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token missing");
  }

  let decoded;
  try {
    decoded = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user) {
    throw new ApiError(401, "User no longer exists");
  }

  const accessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  return { accessToken, refreshToken: newRefreshToken };
};

// ─── Get Current User ─────────────────────────────────────────────

export const getCurrentUser = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
};
