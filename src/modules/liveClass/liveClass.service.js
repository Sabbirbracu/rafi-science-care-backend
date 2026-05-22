import prisma from "../../config/db.js";
import ApiError from "../../utils/ApiError.js";

// ─── Create Live Class (Admin only) ──────────────────────────────

export const createLiveClass = async ({
  batchId,
  title,
  scheduledAt,
  durationMinutes,
  streamUrl,
}) => {
  if (!batchId || !title || !scheduledAt || !durationMinutes) {
    throw new ApiError(
      400,
      "Batch ID, title, scheduled time and duration are required",
    );
  }

  const batch = await prisma.batch.findUnique({
    where: { id: parseInt(batchId) },
  });

  if (!batch) {
    throw new ApiError(404, "Batch not found");
  }

  if (!batch.isActive) {
    throw new ApiError(400, "Cannot add live class to an inactive batch");
  }

  const scheduled = new Date(scheduledAt);
  if (isNaN(scheduled.getTime())) {
    throw new ApiError(400, "Invalid scheduled date format");
  }

  if (scheduled < new Date()) {
    throw new ApiError(400, "Scheduled time must be in the future");
  }

  const duration = parseInt(durationMinutes);
  if (isNaN(duration) || duration <= 0) {
    throw new ApiError(400, "Duration must be a positive number in minutes");
  }

  const liveClass = await prisma.liveClass.create({
    data: {
      batchId: parseInt(batchId),
      title: title.trim(),
      scheduledAt: scheduled,
      durationMinutes: duration,
      streamUrl: streamUrl?.trim() || null,
      status: "SCHEDULED",
    },
  });

  return liveClass;
};

// ─── Get All Live Classes for a Batch ────────────────────────────

export const getLiveClassesByBatch = async (batchId, userId, userRole) => {
  const batch = await prisma.batch.findUnique({
    where: { id: parseInt(batchId) },
  });

  if (!batch) {
    throw new ApiError(404, "Batch not found");
  }

  // Students must be enrolled to see live classes
  if (userRole === "STUDENT") {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_batchId: {
          userId: parseInt(userId),
          batchId: parseInt(batchId),
        },
      },
    });

    if (!enrollment || enrollment.paymentStatus !== "PAID") {
      throw new ApiError(
        403,
        "You must be enrolled in this batch to view live classes",
      );
    }
  }

  const liveClasses = await prisma.liveClass.findMany({
    where: { batchId: parseInt(batchId) },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      durationMinutes: true,
      status: true,
      // Only expose streamUrl if class is LIVE
      // Students should not see the URL before class starts
      streamUrl: userRole === "ADMIN" ? true : false,
      createdAt: true,
    },
  });

  // For students — only show streamUrl when class is actually LIVE
  if (userRole === "STUDENT") {
    return liveClasses.map((cls) => ({
      ...cls,
      streamUrl: cls.status === "LIVE" ? cls.streamUrl : null,
    }));
  }

  return liveClasses;
};

// ─── Get Single Live Class ────────────────────────────────────────

export const getLiveClassById = async (liveClassId, userId, userRole) => {
  const liveClass = await prisma.liveClass.findUnique({
    where: { id: parseInt(liveClassId) },
  });

  if (!liveClass) {
    throw new ApiError(404, "Live class not found");
  }

  // Students must be enrolled
  if (userRole === "STUDENT") {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_batchId: {
          userId: parseInt(userId),
          batchId: liveClass.batchId,
        },
      },
    });

    if (!enrollment || enrollment.paymentStatus !== "PAID") {
      throw new ApiError(403, "You must be enrolled to access this live class");
    }

    // Only return streamUrl if class is LIVE
    return {
      ...liveClass,
      streamUrl: liveClass.status === "LIVE" ? liveClass.streamUrl : null,
    };
  }

  return liveClass;
};

// ─── Update Live Class (Admin only) ──────────────────────────────

export const updateLiveClass = async (liveClassId, updates) => {
  const liveClass = await prisma.liveClass.findUnique({
    where: { id: parseInt(liveClassId) },
  });

  if (!liveClass) {
    throw new ApiError(404, "Live class not found");
  }

  if (liveClass.status === "ENDED") {
    throw new ApiError(400, "Cannot update an ended live class");
  }

  const data = {};

  if (updates.title) data.title = updates.title.trim();
  if (updates.streamUrl !== undefined)
    data.streamUrl = updates.streamUrl?.trim() || null;
  if (updates.durationMinutes) {
    const duration = parseInt(updates.durationMinutes);
    if (isNaN(duration) || duration <= 0) {
      throw new ApiError(400, "Duration must be a positive number");
    }
    data.durationMinutes = duration;
  }
  if (updates.scheduledAt) {
    const scheduled = new Date(updates.scheduledAt);
    if (isNaN(scheduled.getTime())) {
      throw new ApiError(400, "Invalid scheduled date format");
    }
    data.scheduledAt = scheduled;
  }

  const updated = await prisma.liveClass.update({
    where: { id: parseInt(liveClassId) },
    data,
  });

  return updated;
};

// ─── Go Live (Admin only) ─────────────────────────────────────────

export const goLive = async (liveClassId, streamUrl) => {
  const liveClass = await prisma.liveClass.findUnique({
    where: { id: parseInt(liveClassId) },
  });

  if (!liveClass) {
    throw new ApiError(404, "Live class not found");
  }

  if (liveClass.status === "LIVE") {
    throw new ApiError(400, "Class is already live");
  }

  if (liveClass.status === "ENDED") {
    throw new ApiError(400, "Cannot go live on an ended class");
  }

  if (!streamUrl && !liveClass.streamUrl) {
    throw new ApiError(400, "Stream URL is required to go live");
  }

  const updated = await prisma.liveClass.update({
    where: { id: parseInt(liveClassId) },
    data: {
      status: "LIVE",
      streamUrl: streamUrl?.trim() || liveClass.streamUrl,
    },
  });

  return updated;
};

// ─── End Live Class (Admin only) ──────────────────────────────────

export const endLiveClass = async (liveClassId) => {
  const liveClass = await prisma.liveClass.findUnique({
    where: { id: parseInt(liveClassId) },
  });

  if (!liveClass) {
    throw new ApiError(404, "Live class not found");
  }

  if (liveClass.status === "ENDED") {
    throw new ApiError(400, "Class has already ended");
  }

  if (liveClass.status === "SCHEDULED") {
    throw new ApiError(400, "Class has not started yet");
  }

  const updated = await prisma.liveClass.update({
    where: { id: parseInt(liveClassId) },
    data: { status: "ENDED" },
  });

  return updated;
};

// ─── Delete Live Class (Admin only) ──────────────────────────────

export const deleteLiveClass = async (liveClassId) => {
  const liveClass = await prisma.liveClass.findUnique({
    where: { id: parseInt(liveClassId) },
  });

  if (!liveClass) {
    throw new ApiError(404, "Live class not found");
  }

  if (liveClass.status === "LIVE") {
    throw new ApiError(400, "Cannot delete a class that is currently live");
  }

  await prisma.liveClass.delete({ where: { id: parseInt(liveClassId) } });

  return { message: "Live class deleted successfully" };
};
