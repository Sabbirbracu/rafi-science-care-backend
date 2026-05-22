import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import prisma from "../../config/db.js";
import { BUCKET_NAME, s3 } from "../../config/s3.js";
import ApiError from "../../utils/ApiError.js";

// ─── Upload Recording (Admin only) ───────────────────────────────

export const uploadRecording = async ({
  batchId,
  liveClassId,
  title,
  description,
  file,
}) => {
  if (!batchId || !title || !file) {
    throw new ApiError(400, "Batch ID, title and file are required");
  }

  const batch = await prisma.batch.findUnique({
    where: { id: parseInt(batchId) },
  });

  if (!batch) {
    throw new ApiError(404, "Batch not found");
  }

  // Validate file type
  const allowedMimeTypes = ["video/mp4", "video/webm", "video/quicktime"];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new ApiError(400, "Only MP4, WebM and MOV video files are allowed");
  }

  // Max file size 500MB
  const maxSize = 500 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new ApiError(400, "File size must not exceed 500MB");
  }

  // Validate liveClassId if provided
  if (liveClassId) {
    const liveClass = await prisma.liveClass.findUnique({
      where: { id: parseInt(liveClassId) },
    });

    if (!liveClass) {
      throw new ApiError(404, "Live class not found");
    }

    if (liveClass.batchId !== parseInt(batchId)) {
      throw new ApiError(400, "Live class does not belong to this batch");
    }
  }

  // Generate unique S3 key
  const fileExtension = file.originalname.split(".").pop();
  const s3Key = `recordings/${batchId}/${uuidv4()}.${fileExtension}`;

  // Upload to R2/S3
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }),
  );

  const recording = await prisma.recording.create({
    data: {
      batchId: parseInt(batchId),
      liveClassId: liveClassId ? parseInt(liveClassId) : null,
      title: title.trim(),
      description: description?.trim() || null,
      s3Key,
      isPublished: false,
    },
  });

  return recording;
};

// ─── Get All Recordings for a Batch ──────────────────────────────

export const getRecordingsByBatch = async (batchId, userId, userRole) => {
  const batch = await prisma.batch.findUnique({
    where: { id: parseInt(batchId) },
  });

  if (!batch) {
    throw new ApiError(404, "Batch not found");
  }

  // Students must be enrolled and paid
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
        "You must be enrolled in this batch to view recordings",
      );
    }
  }

  const where = {
    batchId: parseInt(batchId),
    // Students only see published recordings
    ...(userRole === "STUDENT" && { isPublished: true }),
  };

  const recordings = await prisma.recording.findMany({
    where,
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      isPublished: true,
      uploadedAt: true,
      liveClassId: true,
      // Never expose s3Key directly
    },
  });

  return recordings;
};

// ─── Get Signed URL for Playback ─────────────────────────────────

export const getRecordingStreamUrl = async (recordingId, userId, userRole) => {
  const recording = await prisma.recording.findUnique({
    where: { id: parseInt(recordingId) },
  });

  if (!recording) {
    throw new ApiError(404, "Recording not found");
  }

  // Students can only access published recordings
  if (userRole === "STUDENT" && !recording.isPublished) {
    throw new ApiError(403, "This recording is not available yet");
  }

  // Students must be enrolled
  if (userRole === "STUDENT") {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_batchId: {
          userId: parseInt(userId),
          batchId: recording.batchId,
        },
      },
    });

    if (!enrollment || enrollment.paymentStatus !== "PAID") {
      throw new ApiError(403, "You must be enrolled to access this recording");
    }
  }

  // Generate signed URL — expires in 2 hours
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: recording.s3Key,
  });

  const signedUrl = await getSignedUrl(s3, command, { expiresIn: 7200 });

  return {
    id: recording.id,
    title: recording.title,
    description: recording.description,
    streamUrl: signedUrl,
    expiresIn: "2 hours",
  };
};

// ─── Toggle Publish Status (Admin only) ──────────────────────────
export const togglePublishRecording = async (recordingId) => {
  const recording = await prisma.recording.findUnique({
    where: { id: parseInt(recordingId) },
  });

  if (!recording) {
    throw new ApiError(404, "Recording not found");
  }

  const updated = await prisma.recording.update({
    where: { id: parseInt(recordingId) },
    data: { isPublished: !recording.isPublished },
  });

  return updated;
};

// ─── Update Recording (Admin only) ──────────────────────────────

export const updateRecording = async (recordingId, updates) => {
  const recording = await prisma.recording.findUnique({
    where: { id: parseInt(recordingId) },
  });

  if (!recording) {
    throw new ApiError(404, "Recording not found");
  }

  const data = {};
  if (updates.title !== undefined) data.title = updates.title?.trim() || null;
  if (updates.description !== undefined)
    data.description = updates.description?.trim() || null;
  if (updates.liveClassId !== undefined)
    data.liveClassId = updates.liveClassId
      ? parseInt(updates.liveClassId)
      : null;

  const updated = await prisma.recording.update({
    where: { id: parseInt(recordingId) },
    data,
  });

  return updated;
};

// ─── Delete Recording (Admin only) ──────────────────────────────

export const deleteRecording = async (recordingId) => {
  const recording = await prisma.recording.findUnique({
    where: { id: parseInt(recordingId) },
  });

  if (!recording) {
    throw new ApiError(404, "Recording not found");
  }

  // Delete S3 object if present
  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: recording.s3Key,
      }),
    );
  } catch (err) {
    // ignore S3 deletion errors but log if needed
  }

  await prisma.recording.delete({ where: { id: parseInt(recordingId) } });

  return { message: "Recording deleted successfully" };
};
