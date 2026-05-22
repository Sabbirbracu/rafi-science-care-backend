import ApiResponse from "../../utils/ApiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";
import {
  getMyPayments,
  getPaymentHistory,
  handleCancel,
  handleFail,
  handleSuccess,
  initiatePayment,
} from "./payment.service.js";

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
