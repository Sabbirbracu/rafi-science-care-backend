import ApiResponse from "../../utils/ApiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";
import {
  createBatch,
  deleteBatch,
  getAllBatches,
  getBatchById,
  getBatchStudents,
  toggleBatchStatus,
  updateBatch,
} from "./batch.service.js";

export const create = asyncHandler(async (req, res) => {
  const batch = await createBatch(req.body);
  return res
    .status(201)
    .json(new ApiResponse(201, batch, "Batch created successfully"));
});

export const getAll = asyncHandler(async (req, res) => {
  const batches = await getAllBatches();
  return res
    .status(200)
    .json(new ApiResponse(200, batches, "Batches fetched successfully"));
});

export const getOne = asyncHandler(async (req, res) => {
  const batch = await getBatchById(req.params.id);
  return res
    .status(200)
    .json(new ApiResponse(200, batch, "Batch fetched successfully"));
});

export const update = asyncHandler(async (req, res) => {
  const batch = await updateBatch(req.params.id, req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, batch, "Batch updated successfully"));
});

export const toggle = asyncHandler(async (req, res) => {
  const batch = await toggleBatchStatus(req.params.id);
  return res
    .status(200)
    .json(new ApiResponse(200, batch, "Batch status toggled successfully"));
});

export const remove = asyncHandler(async (req, res) => {
  const result = await deleteBatch(req.params.id);
  return res
    .status(200)
    .json(new ApiResponse(200, result, "Batch deleted successfully"));
});

export const getStudents = asyncHandler(async (req, res) => {
  const students = await getBatchStudents(req.params.id);
  return res
    .status(200)
    .json(new ApiResponse(200, students, "Students fetched successfully"));
});
