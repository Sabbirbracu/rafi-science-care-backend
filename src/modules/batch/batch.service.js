import prisma from "../../config/db.js";
import ApiError from "../../utils/ApiError.js";

// ─── Create Batch (Admin only) ────────────────────────────────────

export const createBatch = async ({
  title,
  description,
  price,
  startDate,
  endDate,
}) => {
  if (!title || !price || !startDate) {
    throw new ApiError(400, "Title, price and start date are required");
  }

  if (isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
    throw new ApiError(400, "Price must be a valid positive number");
  }

  const start = new Date(startDate);
  if (isNaN(start.getTime())) {
    throw new ApiError(400, "Invalid start date format");
  }

  let end = null;
  if (endDate) {
    end = new Date(endDate);
    if (isNaN(end.getTime())) {
      throw new ApiError(400, "Invalid end date format");
    }
    if (end <= start) {
      throw new ApiError(400, "End date must be after start date");
    }
  }

  const batch = await prisma.batch.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      price: parseFloat(price),
      startDate: start,
      endDate: end,
      isActive: true,
    },
  });

  return batch;
};

// ─── Get All Batches (Public) ─────────────────────────────────────

export const getAllBatches = async () => {
  const batches = await prisma.batch.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      startDate: true,
      endDate: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: { enrollments: true },
      },
    },
  });

  return batches;
};

// ─── Get Single Batch ─────────────────────────────────────────────

export const getBatchById = async (batchId) => {
  const batch = await prisma.batch.findUnique({
    where: { id: parseInt(batchId) },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      startDate: true,
      endDate: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: { enrollments: true },
      },
    },
  });

  if (!batch) {
    throw new ApiError(404, "Batch not found");
  }

  return batch;
};

// ─── Update Batch (Admin only) ────────────────────────────────────

export const updateBatch = async (batchId, updates) => {
  const batch = await prisma.batch.findUnique({
    where: { id: parseInt(batchId) },
  });

  if (!batch) {
    throw new ApiError(404, "Batch not found");
  }

  const data = {};

  if (updates.title) data.title = updates.title.trim();
  if (updates.description !== undefined)
    data.description = updates.description?.trim() || null;
  if (updates.price !== undefined) {
    if (isNaN(parseFloat(updates.price)) || parseFloat(updates.price) <= 0) {
      throw new ApiError(400, "Price must be a valid positive number");
    }
    data.price = parseFloat(updates.price);
  }
  if (updates.startDate) {
    const start = new Date(updates.startDate);
    if (isNaN(start.getTime())) throw new ApiError(400, "Invalid start date");
    data.startDate = start;
  }
  if (updates.endDate) {
    const end = new Date(updates.endDate);
    if (isNaN(end.getTime())) throw new ApiError(400, "Invalid end date");
    data.endDate = end;
  }
  if (updates.isActive !== undefined) data.isActive = Boolean(updates.isActive);

  const updated = await prisma.batch.update({
    where: { id: parseInt(batchId) },
    data,
  });

  return updated;
};

// ─── Toggle Batch Active Status (Admin only) ──────────────────────

export const toggleBatchStatus = async (batchId) => {
  const batch = await prisma.batch.findUnique({
    where: { id: parseInt(batchId) },
  });

  if (!batch) {
    throw new ApiError(404, "Batch not found");
  }

  const updated = await prisma.batch.update({
    where: { id: parseInt(batchId) },
    data: { isActive: !batch.isActive },
  });

  return updated;
};

// ─── Delete Batch (Admin only) ────────────────────────────────────

export const deleteBatch = async (batchId) => {
  const batch = await prisma.batch.findUnique({
    where: { id: parseInt(batchId) },
    include: { _count: { select: { enrollments: true } } },
  });

  if (!batch) {
    throw new ApiError(404, "Batch not found");
  }

  // Prevent deleting a batch that has enrolled students
  if (batch._count.enrollments > 0) {
    throw new ApiError(
      400,
      "Cannot delete a batch with enrolled students. Deactivate it instead.",
    );
  }

  await prisma.batch.delete({ where: { id: parseInt(batchId) } });

  return { message: "Batch deleted successfully" };
};

// ─── Get Enrolled Students in a Batch (Admin only) ────────────────

export const getBatchStudents = async (batchId) => {
  const batch = await prisma.batch.findUnique({
    where: { id: parseInt(batchId) },
  });

  if (!batch) {
    throw new ApiError(404, "Batch not found");
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      batchId: parseInt(batchId),
      paymentStatus: "PAID",
    },
    select: {
      id: true,
      enrolledAt: true,
      paymentStatus: true,
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  return enrollments;
};
