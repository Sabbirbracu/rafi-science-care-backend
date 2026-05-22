import SSLCommerzPayment from "sslcommerz-lts";
import prisma from "../../config/db.js";
import ApiError from "../../utils/ApiError.js";

const sslConfig = {
  store_id: process.env.SSL_STORE_ID,
  store_passwd: process.env.SSL_STORE_PASSWORD,
  is_live: process.env.SSL_IS_LIVE === "true",
};

// ─── Initiate Payment ─────────────────────────────────────────────

export const initiatePayment = async (batchId, userId) => {
  const batch = await prisma.batch.findUnique({
    where: { id: parseInt(batchId) },
  });

  if (!batch) {
    throw new ApiError(404, "Batch not found");
  }

  if (!batch.isActive) {
    throw new ApiError(400, "This batch is no longer active");
  }

  // Check if already enrolled
  const existingEnrollment = await prisma.enrollment.findUnique({
    where: {
      userId_batchId: {
        userId: parseInt(userId),
        batchId: parseInt(batchId),
      },
    },
  });

  if (existingEnrollment?.paymentStatus === "PAID") {
    throw new ApiError(409, "You are already enrolled in this batch");
  }

  const user = await prisma.user.findUnique({
    where: { id: parseInt(userId) },
  });

  // Create or reuse pending enrollment
  let enrollment;
  if (existingEnrollment) {
    enrollment = await prisma.enrollment.update({
      where: {
        userId_batchId: {
          userId: parseInt(userId),
          batchId: parseInt(batchId),
        },
      },
      data: { paymentStatus: "PENDING" },
    });
  } else {
    enrollment = await prisma.enrollment.create({
      data: {
        userId: parseInt(userId),
        batchId: parseInt(batchId),
        paymentStatus: "PENDING",
      },
    });
  }

  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      userId: parseInt(userId),
      batchId: parseInt(batchId),
      gateway: "SSLCOMMERZ",
      amount: batch.price,
      status: "PENDING",
    },
  });

  const transactionId = `RSC-${payment.id}-${Date.now()}`;

  // Update payment with transaction ID
  await prisma.payment.update({
    where: { id: payment.id },
    data: { transactionId },
  });

  const sslData = {
    total_amount: parseFloat(batch.price),
    currency: "BDT",
    tran_id: transactionId,
    success_url: `${process.env.BACKEND_URL}/api/v1/payments/success`,
    fail_url: `${process.env.BACKEND_URL}/api/v1/payments/fail`,
    cancel_url: `${process.env.BACKEND_URL}/api/v1/payments/cancel`,
    ipn_url: `${process.env.BACKEND_URL}/api/v1/payments/ipn`,
    shipping_method: "NO",
    product_name: batch.title,
    product_category: "Education",
    product_profile: "general",
    cus_name: user.name,
    cus_email: user.email || "noemail@rafisciencecare.com",
    cus_add1: "Dhaka",
    cus_country: "Bangladesh",
    cus_phone: user.phone,
  };

  const sslcz = new SSLCommerzPayment(
    sslConfig.store_id,
    sslConfig.store_passwd,
    sslConfig.is_live,
  );

  const apiResponse = await sslcz.init(sslData);

  if (!apiResponse?.GatewayPageURL) {
    throw new ApiError(500, "Failed to initiate payment gateway");
  }

  return {
    paymentUrl: apiResponse.GatewayPageURL,
    transactionId,
    amount: batch.price,
  };
};

// ─── Payment Success Callback ─────────────────────────────────────

export const handleSuccess = async (body) => {
  const { tran_id, val_id, status } = body;

  if (status !== "VALID" && status !== "VALIDATED") {
    throw new ApiError(400, "Invalid payment status");
  }

  const payment = await prisma.payment.findUnique({
    where: { transactionId: tran_id },
  });

  if (!payment) {
    throw new ApiError(404, "Payment record not found");
  }

  if (payment.status === "PAID") {
    return { message: "Payment already processed" };
  }

  // Validate with SSLCommerz
  const sslcz = new SSLCommerzPayment(
    sslConfig.store_id,
    sslConfig.store_passwd,
    sslConfig.is_live,
  );

  const validation = await sslcz.validate({ val_id });

  if (validation?.status !== "VALID" && validation?.status !== "VALIDATED") {
    // Mark payment as failed if validation fails
    await prisma.payment.update({
      where: { transactionId: tran_id },
      data: { status: "FAILED" },
    });
    throw new ApiError(400, "Payment validation failed");
  }

  // Update payment and enrollment in a transaction
  await prisma.$transaction([
    prisma.payment.update({
      where: { transactionId: tran_id },
      data: { status: "PAID", paidAt: new Date() },
    }),
    prisma.enrollment.update({
      where: {
        userId_batchId: {
          userId: payment.userId,
          batchId: payment.batchId,
        },
      },
      data: { paymentStatus: "PAID" },
    }),
  ]);

  return { message: "Payment successful", transactionId: tran_id };
};

// ─── Payment Fail Callback ────────────────────────────────────────

export const handleFail = async (body) => {
  const { tran_id } = body;

  if (tran_id) {
    await prisma.payment.updateMany({
      where: { transactionId: tran_id },
      data: { status: "FAILED" },
    });
  }

  return { message: "Payment failed" };
};

// ─── Payment Cancel Callback ──────────────────────────────────────

export const handleCancel = async (body) => {
  const { tran_id } = body;

  if (tran_id) {
    await prisma.payment.updateMany({
      where: { transactionId: tran_id },
      data: { status: "FAILED" },
    });
  }

  return { message: "Payment cancelled" };
};

// ─── Get Payment History (Admin) ──────────────────────────────────

export const getPaymentHistory = async ({ page = 1, limit = 20, status }) => {
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {};
  if (status) where.status = status;

  const [payments, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        transactionId: true,
        amount: true,
        gateway: true,
        status: true,
        paidAt: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, phone: true, email: true },
        },
        batch: {
          select: { id: true, title: true },
        },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    payments,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
};

// ─── Get My Payment History (Student) ────────────────────────────

export const getMyPayments = async (userId) => {
  const payments = await prisma.payment.findMany({
    where: { userId: parseInt(userId) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      transactionId: true,
      amount: true,
      gateway: true,
      status: true,
      paidAt: true,
      createdAt: true,
      batch: {
        select: { id: true, title: true },
      },
    },
  });

  return payments;
};
