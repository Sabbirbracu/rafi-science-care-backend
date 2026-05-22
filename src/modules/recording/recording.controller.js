import ApiResponse from "../../utils/ApiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";
import {
  deleteRecording,
  getRecordingsByBatch,
  getRecordingStreamUrl,
  togglePublishRecording,
  updateRecording,
  uploadRecording,
} from "./recording.service.js";

export const upload = asyncHandler(async (req, res) => {
  const { batchId, liveClassId, title, description } = req.body;
  const file = req.file;

  if (!file) {
    throw new Error("No file uploaded");
  }

  const recording = await uploadRecording({
    batchId,
    liveClassId,
    title,
    description,
    file,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, recording, "Recording uploaded successfully"));
});

export const getByBatch = asyncHandler(async (req, res) => {
  const recordings = await getRecordingsByBatch(
    req.params.batchId,
    req.user.id,
    req.user.role,
  );
  return res
    .status(200)
    .json(new ApiResponse(200, recordings, "Recordings fetched successfully"));
});

export const getStreamUrl = asyncHandler(async (req, res) => {
  const data = await getRecordingStreamUrl(
    req.params.id,
    req.user.id,
    req.user.role,
  );
  return res
    .status(200)
    .json(new ApiResponse(200, data, "Stream URL generated successfully"));
});

export const togglePublish = asyncHandler(async (req, res) => {
  const recording = await togglePublishRecording(req.params.id);
  return res
    .status(200)
    .json(new ApiResponse(200, recording, "Recording publish status updated"));
});

export const update = asyncHandler(async (req, res) => {
  const recording = await updateRecording(req.params.id, req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, recording, "Recording updated successfully"));
});

export const remove = asyncHandler(async (req, res) => {
  const result = await deleteRecording(req.params.id);
  return res
    .status(200)
    .json(new ApiResponse(200, result, "Recording deleted successfully"));
});
