import ApiError from "../../utils/ApiError.js";
import ApiResponse from "../../utils/ApiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";
import {
  checkoutRegisterPayment,
  getMyPayments,
  getPaymentHistory,
  handleCancel,
  handleFail,
  handleSuccess,
  initiatePayment,
} from "./payment.service.js";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ─── Checkout Register — Create account + initiate payment ────────

export const checkoutRegister = asyncHandler(async (req, res) => {
  const { name, phone, email, password, batchId } = req.body;

  // Validate required fields
  if (!name || !phone || !password || !batchId) {
    throw new ApiError(400, "Name, phone, password, and batchId are required");
  }

  const result = await checkoutRegisterPayment(
    { name, phone, email, password },
    batchId,
  );

  return res
    .status(201)
    .cookie("refreshToken", result.refreshToken, COOKIE_OPTIONS)
    .json(
      new ApiResponse(
        201,
        {
          user: result.user,
          accessToken: result.accessToken,
          paymentUrl: result.paymentUrl,
          transactionId: result.transactionId,
          amount: result.amount,
        },
        "Account created. Redirecting to payment...",
      ),
    );
});

export const initiate = asyncHandler(async (req, res) => {
  const { batchId } = req.body;
  const result = await initiatePayment(batchId, req.user.id);
  return res
    .status(200)
    .json(new ApiResponse(200, result, "Payment initiated successfully"));
});

// SSLCommerz callbacks — NO JWT middleware, SSLCommerz hits these directly
export const success = asyncHandler(async (req, res) => {
  await handleSuccess(req.body);
  return res.redirect(`${process.env.CLIENT_URL}/payment/success`);
});

export const fail = asyncHandler(async (req, res) => {
  await handleFail(req.body);
  return res.redirect(`${process.env.CLIENT_URL}/payment/fail`);
});

export const cancel = asyncHandler(async (req, res) => {
  await handleCancel(req.body);
  return res.redirect(`${process.env.CLIENT_URL}/payment/cancel`);
});

export const ipn = asyncHandler(async (req, res) => {
  // IPN is a background validation hit from SSLCommerz
  await handleSuccess(req.body);
  return res.status(200).json({ message: "IPN received" });
});

export const history = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const result = await getPaymentHistory({ page, limit, status });
  return res
    .status(200)
    .json(new ApiResponse(200, result, "Payment history fetched"));
});

export const myPayments = asyncHandler(async (req, res) => {
  const payments = await getMyPayments(req.user.id);
  return res
    .status(200)
    .json(new ApiResponse(200, payments, "Your payment history fetched"));
});
