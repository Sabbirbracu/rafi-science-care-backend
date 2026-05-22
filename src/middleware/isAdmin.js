import ApiError from "../utils/ApiError.js";

export const isAdmin = (req, res, next) => {
  if (req.user?.role !== "ADMIN") {
    throw new ApiError(403, "Forbidden — admin access only");
  }
  next();
};
