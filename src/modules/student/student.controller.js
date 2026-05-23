import ApiResponse from "../../utils/ApiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";
import {
  changePassword,
  getAllStudents,
  getMyBatches,
  getMyPendingExams,
  getMyResults,
  getMyUpcomingLiveClasses,
  getStudentDashboard,
  getStudentDetail,
  getStudentProfile,
  updateStudentProfile,
} from "./student.service.js";

// ─── Student Routes ───────────────────────────────────────────────

export const dashboard = asyncHandler(async (req, res) => {
  const data = await getStudentDashboard(req.user.id);
  return res
    .status(200)
    .json(new ApiResponse(200, data, "Dashboard fetched successfully"));
});

export const myBatches = asyncHandler(async (req, res) => {
  const batches = await getMyBatches(req.user.id);
  return res
    .status(200)
    .json(new ApiResponse(200, batches, "Your batches fetched successfully"));
});

export const myUpcomingClasses = asyncHandler(async (req, res) => {
  const classes = await getMyUpcomingLiveClasses(req.user.id);
  return res
    .status(200)
    .json(
      new ApiResponse(200, classes, "Upcoming classes fetched successfully"),
    );
});

export const myPendingExams = asyncHandler(async (req, res) => {
  const exams = await getMyPendingExams(req.user.id);
  return res
    .status(200)
    .json(new ApiResponse(200, exams, "Pending exams fetched successfully"));
});

export const myResults = asyncHandler(async (req, res) => {
  const results = await getMyResults(req.user.id);
  return res
    .status(200)
    .json(new ApiResponse(200, results, "Your results fetched successfully"));
});

export const profile = asyncHandler(async (req, res) => {
  const user = await getStudentProfile(req.user.id);
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Profile fetched successfully"));
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await updateStudentProfile(req.user.id, req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Profile updated successfully"));
});

export const updatePassword = asyncHandler(async (req, res) => {
  const result = await changePassword(req.user.id, req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, result, "Password changed successfully"));
});

// ─── Admin Routes ─────────────────────────────────────────────────

export const allStudents = asyncHandler(async (req, res) => {
  const { page, limit, search } = req.query;
  const result = await getAllStudents({ page, limit, search });
  return res
    .status(200)
    .json(new ApiResponse(200, result, "Students fetched successfully"));
});

export const studentDetail = asyncHandler(async (req, res) => {
  const student = await getStudentDetail(req.params.id);
  return res
    .status(200)
    .json(new ApiResponse(200, student, "Student detail fetched successfully"));
});
