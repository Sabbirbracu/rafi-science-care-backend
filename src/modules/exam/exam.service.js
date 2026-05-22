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

// ─── Create Exam (Admin only) ─────────────────────────────────────

export const createExam = async ({
  batchId,
  title,
  examDate,
  durationMinutes,
}) => {
  if (!batchId || !title || !examDate || !durationMinutes) {
    throw new ApiError(
      400,
      "Batch ID, title, exam date and duration are required",
    );
  }

  const batch = await prisma.batch.findUnique({
    where: { id: parseInt(batchId) },
  });

  if (!batch) {
    throw new ApiError(404, "Batch not found");
  }

  if (!batch.isActive) {
    throw new ApiError(400, "Cannot add exam to an inactive batch");
  }

  const date = new Date(examDate);
  if (isNaN(date.getTime())) {
    throw new ApiError(400, "Invalid exam date format");
  }

  const duration = parseInt(durationMinutes);
  if (isNaN(duration) || duration <= 0) {
    throw new ApiError(400, "Duration must be a positive number in minutes");
  }

  const exam = await prisma.exam.create({
    data: {
      batchId: parseInt(batchId),
      title: title.trim(),
      examDate: date,
      durationMinutes: duration,
      isPublished: false,
    },
  });

  return exam;
};

// ─── Upload OMR Sheet PDF (Admin only) ────────────────────────────

export const uploadOMRSheet = async (examId, file) => {
  if (!file) {
    throw new ApiError(400, "OMR sheet PDF file is required");
  }

  const exam = await prisma.exam.findUnique({
    where: { id: parseInt(examId) },
  });

  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  // Only PDF allowed for OMR sheet
  if (file.mimetype !== "application/pdf") {
    throw new ApiError(400, "OMR sheet must be a PDF file");
  }

  // Max 10MB for PDF
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new ApiError(400, "OMR sheet PDF must not exceed 10MB");
  }

  // Delete old OMR sheet from R2 if exists
  if (exam.omrSheetKey) {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: exam.omrSheetKey,
      }),
    );
  }

  const s3Key = `omr-sheets/${examId}/${uuidv4()}.pdf`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: file.buffer,
      ContentType: "application/pdf",
    }),
  );

  const updated = await prisma.exam.update({
    where: { id: parseInt(examId) },
    data: { omrSheetKey: s3Key },
  });

  return updated;
};

// ─── Get OMR Sheet Download URL ───────────────────────────────────

export const getOMRSheetUrl = async (examId, userId, userRole) => {
  const exam = await prisma.exam.findUnique({
    where: { id: parseInt(examId) },
  });

  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  if (!exam.omrSheetKey) {
    throw new ApiError(404, "No OMR sheet uploaded for this exam yet");
  }

  // Students must be enrolled and exam must be published
  if (userRole === "STUDENT") {
    if (!exam.isPublished) {
      throw new ApiError(403, "This exam is not available yet");
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_batchId: {
          userId: parseInt(userId),
          batchId: exam.batchId,
        },
      },
    });

    if (!enrollment || enrollment.paymentStatus !== "PAID") {
      throw new ApiError(403, "You must be enrolled to access this exam");
    }
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: exam.omrSheetKey,
  });

  // OMR sheet URL expires in 30 minutes
  const signedUrl = await getSignedUrl(s3, command, { expiresIn: 1800 });

  return { downloadUrl: signedUrl, expiresIn: "30 minutes" };
};

// ─── Get All Exams for a Batch ────────────────────────────────────

export const getExamsByBatch = async (batchId, userId, userRole) => {
  const batch = await prisma.batch.findUnique({
    where: { id: parseInt(batchId) },
  });

  if (!batch) {
    throw new ApiError(404, "Batch not found");
  }

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
      throw new ApiError(403, "You must be enrolled to view exams");
    }
  }

  const exams = await prisma.exam.findMany({
    where: {
      batchId: parseInt(batchId),
      ...(userRole === "STUDENT" && { isPublished: true }),
    },
    orderBy: { examDate: "asc" },
    select: {
      id: true,
      title: true,
      examDate: true,
      durationMinutes: true,
      isPublished: true,
      omrSheetKey: userRole === "ADMIN",
      createdAt: true,
      _count: { select: { submissions: true } },
    },
  });

  // For students show whether OMR sheet is available without exposing the key
  if (userRole === "STUDENT") {
    return exams.map((exam) => ({
      ...exam,
      hasOMRSheet: !!exam.omrSheetKey,
      omrSheetKey: undefined,
    }));
  }

  return exams;
};

// ─── Get Single Exam ──────────────────────────────────────────────

export const getExamById = async (examId, userId, userRole) => {
  const exam = await prisma.exam.findUnique({
    where: { id: parseInt(examId) },
    include: { _count: { select: { submissions: true } } },
  });

  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  if (userRole === "STUDENT") {
    if (!exam.isPublished) {
      throw new ApiError(403, "This exam is not available yet");
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_batchId: {
          userId: parseInt(userId),
          batchId: exam.batchId,
        },
      },
    });

    if (!enrollment || enrollment.paymentStatus !== "PAID") {
      throw new ApiError(403, "You must be enrolled to access this exam");
    }

    return {
      ...exam,
      hasOMRSheet: !!exam.omrSheetKey,
      omrSheetKey: undefined,
    };
  }

  return exam;
};

// ─── Toggle Publish Exam (Admin only) ────────────────────────────

export const togglePublishExam = async (examId) => {
  const exam = await prisma.exam.findUnique({
    where: { id: parseInt(examId) },
  });

  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  // Must have OMR sheet before publishing
  if (!exam.isPublished && !exam.omrSheetKey) {
    throw new ApiError(
      400,
      "Please upload OMR sheet before publishing the exam",
    );
  }

  const updated = await prisma.exam.update({
    where: { id: parseInt(examId) },
    data: { isPublished: !exam.isPublished },
  });

  return updated;
};

// ─── Update Exam (Admin only) ─────────────────────────────────────

export const updateExam = async (examId, updates) => {
  const exam = await prisma.exam.findUnique({
    where: { id: parseInt(examId) },
  });

  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  const data = {};
  if (updates.title) data.title = updates.title.trim();
  if (updates.examDate) {
    const date = new Date(updates.examDate);
    if (isNaN(date.getTime())) throw new ApiError(400, "Invalid exam date");
    data.examDate = date;
  }
  if (updates.durationMinutes) {
    const duration = parseInt(updates.durationMinutes);
    if (isNaN(duration) || duration <= 0) {
      throw new ApiError(400, "Duration must be a positive number");
    }
    data.durationMinutes = duration;
  }

  const updated = await prisma.exam.update({
    where: { id: parseInt(examId) },
    data,
  });

  return updated;
};

// ─── Delete Exam (Admin only) ─────────────────────────────────────

export const deleteExam = async (examId) => {
  const exam = await prisma.exam.findUnique({
    where: { id: parseInt(examId) },
    include: { _count: { select: { submissions: true } } },
  });

  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  if (exam._count.submissions > 0) {
    throw new ApiError(400, "Cannot delete exam with existing submissions");
  }

  // Delete OMR sheet from R2 if exists
  if (exam.omrSheetKey) {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: exam.omrSheetKey,
      }),
    );
  }

  await prisma.exam.delete({ where: { id: parseInt(examId) } });

  return { message: "Exam deleted successfully" };
};

// ─── Submit OMR Answer (Student) ──────────────────────────────────

export const submitOMR = async (examId, studentId, file) => {
  if (!file) {
    throw new ApiError(400, "OMR answer image is required");
  }

  const exam = await prisma.exam.findUnique({
    where: { id: parseInt(examId) },
  });

  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  if (!exam.isPublished) {
    throw new ApiError(403, "This exam is not available");
  }

  // Check enrollment
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_batchId: {
        userId: parseInt(studentId),
        batchId: exam.batchId,
      },
    },
  });

  if (!enrollment || enrollment.paymentStatus !== "PAID") {
    throw new ApiError(403, "You must be enrolled to submit this exam");
  }

  // Check duplicate submission
  const existing = await prisma.examSubmission.findUnique({
    where: {
      examId_studentId: {
        examId: parseInt(examId),
        studentId: parseInt(studentId),
      },
    },
  });

  if (existing) {
    throw new ApiError(409, "You have already submitted this exam");
  }

  // Validate image file
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
  if (!allowedTypes.includes(file.mimetype)) {
    throw new ApiError(400, "OMR answer must be a JPG or PNG image");
  }

  // Max 5MB
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new ApiError(400, "Image must not exceed 5MB");
  }

  const s3Key = `omr-answers/${examId}/${studentId}/${uuidv4()}.${file.originalname.split(".").pop()}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }),
  );

  const submission = await prisma.examSubmission.create({
    data: {
      examId: parseInt(examId),
      studentId: parseInt(studentId),
      omrImageKey: s3Key,
      status: "PENDING",
    },
  });

  return submission;
};

// ─── Get All Submissions for an Exam (Admin only) ─────────────────

export const getSubmissions = async (examId) => {
  const exam = await prisma.exam.findUnique({
    where: { id: parseInt(examId) },
  });

  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  const submissions = await prisma.examSubmission.findMany({
    where: { examId: parseInt(examId) },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      submittedAt: true,
      status: true,
      marksObtained: true,
      divoResult: true,
      student: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      },
    },
  });

  return submissions;
};

// ─── Get Student's Own Submission ─────────────────────────────────

export const getMySubmission = async (examId, studentId) => {
  const submission = await prisma.examSubmission.findUnique({
    where: {
      examId_studentId: {
        examId: parseInt(examId),
        studentId: parseInt(studentId),
      },
    },
    select: {
      id: true,
      submittedAt: true,
      status: true,
      marksObtained: true,
      // Don't expose omrImageKey or divoResult internals to student
    },
  });

  if (!submission) {
    throw new ApiError(404, "No submission found for this exam");
  }

  return submission;
};

// ─── Manually Enter Marks (Admin only — pre DIVO) ─────────────────

export const enterMarksManually = async (submissionId, marksObtained) => {
  if (marksObtained === undefined || marksObtained === null) {
    throw new ApiError(400, "Marks are required");
  }

  const marks = parseFloat(marksObtained);
  if (isNaN(marks) || marks < 0) {
    throw new ApiError(400, "Marks must be a valid non-negative number");
  }

  const submission = await prisma.examSubmission.findUnique({
    where: { id: parseInt(submissionId) },
  });

  if (!submission) {
    throw new ApiError(404, "Submission not found");
  }

  const updated = await prisma.examSubmission.update({
    where: { id: parseInt(submissionId) },
    data: {
      marksObtained: marks,
      status: "PROCESSED",
    },
  });

  return updated;
};
