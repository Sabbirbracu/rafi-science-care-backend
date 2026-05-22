import ApiResponse from "../../utils/ApiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";
import {
  createLiveClass,
  deleteLiveClass,
  endLiveClass,
  getLiveClassById,
  getLiveClassesByBatch,
  goLive,
  updateLiveClass,
} from "./liveClass.service.js";

export const create = asyncHandler(async (req, res) => {
  const liveClass = await createLiveClass(req.body);
  return res
    .status(201)
    .json(new ApiResponse(201, liveClass, "Live class scheduled successfully"));
});

export const getByBatch = asyncHandler(async (req, res) => {
  const liveClasses = await getLiveClassesByBatch(
    req.params.batchId,
    req.user.id,
    req.user.role,
  );
  return res
    .status(200)
    .json(
      new ApiResponse(200, liveClasses, "Live classes fetched successfully"),
    );
});

export const getOne = asyncHandler(async (req, res) => {
  const liveClass = await getLiveClassById(
    req.params.id,
    req.user.id,
    req.user.role,
  );
  return res
    .status(200)
    .json(new ApiResponse(200, liveClass, "Live class fetched successfully"));
});

export const update = asyncHandler(async (req, res) => {
  const liveClass = await updateLiveClass(req.params.id, req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, liveClass, "Live class updated successfully"));
});

export const startLive = asyncHandler(async (req, res) => {
  const { streamUrl } = req.body;
  const liveClass = await goLive(req.params.id, streamUrl);
  return res
    .status(200)
    .json(new ApiResponse(200, liveClass, "Class is now live"));
});

export const endLive = asyncHandler(async (req, res) => {
  const liveClass = await endLiveClass(req.params.id);
  return res
    .status(200)
    .json(new ApiResponse(200, liveClass, "Live class ended successfully"));
});

export const remove = asyncHandler(async (req, res) => {
  const result = await deleteLiveClass(req.params.id);
  return res
    .status(200)
    .json(new ApiResponse(200, result, "Live class deleted successfully"));
});
