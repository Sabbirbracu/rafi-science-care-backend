import prisma from "../../config/db.js";
import ApiError from "../../utils/ApiError.js";

// ─── Get Student Dashboard ────────────────────────────────────────

export const getStudentDashboard = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: parseInt(userId) },
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

  // Get all paid enrollments with batch details
  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId: parseInt(userId),
      paymentStatus: "PAID",
    },
    select: {
      id: true,
      enrolledAt: true,
      batch: {
        select: {
          id: true,
          title: true,
          description: true,
          startDate: true,
          endDate: true,
          isActive: true,
        },
      },
    },
  });

  return {
    user,
    enrolledBatches: enrollments,
    totalEnrolled: enrollments.length,
  };
};

// ─── Get Student's Enrolled Batches ───────────────────────────────

export const getMyBatches = async (userId) => {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId: parseInt(userId),
      paymentStatus: "PAID",
    },
    orderBy: { enrolledAt: "desc" },
    select: {
      id: true,
      enrolledAt: true,
      batch: {
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          startDate: true,
          endDate: true,
          isActive: true,
          _count: {
            select: {
              liveClasses: true,
              recordings: true,
              exams: true,
            },
          },
        },
      },
    },
  });

  return enrollments;
};

// ─── Get Student's Upcoming Live Classes ──────────────────────────

export const getMyUpcomingLiveClasses = async (userId) => {
  // Get all paid batch IDs for this student
  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId: parseInt(userId),
      paymentStatus: "PAID",
    },
    select: { batchId: true },
  });

  const batchIds = enrollments.map((e) => e.batchId);

  if (batchIds.length === 0) {
    return [];
  }

  const liveClasses = await prisma.liveClass.findMany({
    where: {
      batchId: { in: batchIds },
      status: { in: ["SCHEDULED", "LIVE"] },
    },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      durationMinutes: true,
      status: true,
      // Only expose streamUrl if class is LIVE
      batch: {
        select: { id: true, title: true },
      },
    },
  });

  // Only show streamUrl if class is currently LIVE
  return liveClasses.map((cls) => ({
    ...cls,
    streamUrl: cls.status === "LIVE" ? cls.streamUrl : null,
  }));
};

// ─── Get Student's Pending Exams ──────────────────────────────────

export const getMyPendingExams = async (userId) => {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId: parseInt(userId),
      paymentStatus: "PAID",
    },
    select: { batchId: true },
  });

  const batchIds = enrollments.map((e) => e.batchId);

  if (batchIds.length === 0) {
    return [];
  }

  // Get all published exams for enrolled batches
  const exams = await prisma.exam.findMany({
    where: {
      batchId: { in: batchIds },
      isPublished: true,
    },
    orderBy: { examDate: "asc" },
    select: {
      id: true,
      title: true,
      examDate: true,
      durationMinutes: true,
      batch: { select: { id: true, title: true } },
    },
  });

  // Get this student's existing submissions
  const submissions = await prisma.examSubmission.findMany({
    where: {
      studentId: parseInt(userId),
      examId: { in: exams.map((e) => e.id) },
    },
    select: { examId: true, status: true, marksObtained: true },
  });

  const submissionMap = {};
  submissions.forEach((s) => {
    submissionMap[s.examId] = s;
  });

  // Attach submission status to each exam
  return exams.map((exam) => ({
    ...exam,
    hasOMRSheet: true,
    submission: submissionMap[exam.id] || null,
    isSubmitted: !!submissionMap[exam.id],
  }));
};

// ─── Get Student's Exam Results ───────────────────────────────────

export const getMyResults = async (userId) => {
  const submissions = await prisma.examSubmission.findMany({
    where: {
      studentId: parseInt(userId),
      status: "PROCESSED",
    },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      submittedAt: true,
      marksObtained: true,
      status: true,
      exam: {
        select: {
          id: true,
          title: true,
          examDate: true,
          batch: { select: { id: true, title: true } },
        },
      },
    },
  });

  return submissions;
};

// ─── Get Student Profile ──────────────────────────────────────────

export const getStudentProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: parseInt(userId) },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
};

// ─── Update Student Profile ───────────────────────────────────────

export const updateStudentProfile = async (userId, updates) => {
  const user = await prisma.user.findUnique({
    where: { id: parseInt(userId) },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const data = {};

  if (updates.name) {
    if (updates.name.trim().length < 2) {
      throw new ApiError(400, "Name must be at least 2 characters");
    }
    data.name = updates.name.trim();
  }

  if (updates.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(updates.email)) {
      throw new ApiError(400, "Invalid email format");
    }

    // Check email not taken by another user
    const existingEmail = await prisma.user.findUnique({
      where: { email: updates.email.toLowerCase() },
    });

    if (existingEmail && existingEmail.id !== parseInt(userId)) {
      throw new ApiError(409, "Email already in use by another account");
    }

    data.email = updates.email.trim().toLowerCase();
  }

  const updated = await prisma.user.update({
    where: { id: parseInt(userId) },
    data,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      createdAt: true,
    },
  });

  return updated;
};

// ─── Change Password ──────────────────────────────────────────────

import bcrypt from "bcryptjs";

export const changePassword = async (
  userId,
  { currentPassword, newPassword },
) => {
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Current password and new password are required");
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, "New password must be at least 6 characters");
  }

  if (currentPassword === newPassword) {
    throw new ApiError(
      400,
      "New password must be different from current password",
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: parseInt(userId) },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isCorrect = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCorrect) {
    throw new ApiError(401, "Current password is incorrect");
  }

  const newHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: parseInt(userId) },
    data: { passwordHash: newHash },
  });

  return { message: "Password changed successfully" };
};

// ─── Admin — Get All Students ─────────────────────────────────────

export const getAllStudents = async ({ page = 1, limit = 20, search }) => {
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {
    role: "STUDENT",
    ...(search && {
      OR: [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ],
    }),
  };

  const [students, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        _count: {
          select: { enrollments: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    students,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
};

// ─── Admin — Get Single Student Detail ───────────────────────────

export const getStudentDetail = async (studentId) => {
  const student = await prisma.user.findUnique({
    where: { id: parseInt(studentId), role: "STUDENT" },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      createdAt: true,
      enrollments: {
        select: {
          id: true,
          enrolledAt: true,
          paymentStatus: true,
          batch: {
            select: { id: true, title: true, isActive: true },
          },
        },
      },
      examSubmissions: {
        select: {
          id: true,
          submittedAt: true,
          status: true,
          marksObtained: true,
          exam: {
            select: { id: true, title: true },
          },
        },
      },
    },
  });

  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  return student;
};
