import ApiResponse from "../../utils/ApiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";
import {
  createExam,
  deleteExam,
  enterMarksManually,
  getExamById,
  getExamsByBatch,
  getMySubmission,
  getOMRSheetUrl,
  getSubmissions,
  submitOMR,
  togglePublishExam,
  updateExam,
  uploadOMRSheet,
} from "./exam.service.js";

export const create = asyncHandler(async (req, res) => {
  const exam = await createExam(req.body);
  return res
    .status(201)
    .json(new ApiResponse(201, exam, "Exam created successfully"));
});

export const uploadOMR = asyncHandler(async (req, res) => {
  const exam = await uploadOMRSheet(req.params.id, req.file);
  return res
    .status(200)
    .json(new ApiResponse(200, exam, "OMR sheet uploaded successfully"));
});

export const getOMRUrl = asyncHandler(async (req, res) => {
  const data = await getOMRSheetUrl(req.params.id, req.user.id, req.user.role);
  return res
    .status(200)
    .json(new ApiResponse(200, data, "OMR sheet URL generated"));
});

export const getByBatch = asyncHandler(async (req, res) => {
  const exams = await getExamsByBatch(
    req.params.batchId,
    req.user.id,
    req.user.role,
  );
  return res
    .status(200)
    .json(new ApiResponse(200, exams, "Exams fetched successfully"));
});

export const getOne = asyncHandler(async (req, res) => {
  const exam = await getExamById(req.params.id, req.user.id, req.user.role);
  return res
    .status(200)
    .json(new ApiResponse(200, exam, "Exam fetched successfully"));
});

export const togglePublish = asyncHandler(async (req, res) => {
  const exam = await togglePublishExam(req.params.id);
  return res
    .status(200)
    .json(new ApiResponse(200, exam, "Exam publish status updated"));
});

export const update = asyncHandler(async (req, res) => {
  const exam = await updateExam(req.params.id, req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, exam, "Exam updated successfully"));
});

export const remove = asyncHandler(async (req, res) => {
  const result = await deleteExam(req.params.id);
  return res
    .status(200)
    .json(new ApiResponse(200, result, "Exam deleted successfully"));
});

export const submit = asyncHandler(async (req, res) => {
  const submission = await submitOMR(req.params.id, req.user.id, req.file);
  return res
    .status(201)
    .json(new ApiResponse(201, submission, "OMR submitted successfully"));
});

export const getSubmissionList = asyncHandler(async (req, res) => {
  const submissions = await getSubmissions(req.params.id);
  return res
    .status(200)
    .json(
      new ApiResponse(200, submissions, "Submissions fetched successfully"),
    );
});

export const getMySubmissionResult = asyncHandler(async (req, res) => {
  const submission = await getMySubmission(req.params.id, req.user.id);
  return res
    .status(200)
    .json(new ApiResponse(200, submission, "Your submission fetched"));
});

export const enterMarks = asyncHandler(async (req, res) => {
  const { marksObtained } = req.body;
  const submission = await enterMarksManually(
    req.params.submissionId,
    marksObtained,
  );
  return res
    .status(200)
    .json(new ApiResponse(200, submission, "Marks entered successfully"));
});
