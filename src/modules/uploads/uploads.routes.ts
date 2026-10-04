import multer from "multer";
import { Router } from "express";
import { env } from "../../env.js";
import { asyncHandler } from "../../utils/http.js";
import { uploadsController } from "./uploads.controller.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024
  },
  fileFilter(_req, file, callback) {
    callback(null, file.mimetype.startsWith("image/"));
  }
});

export const uploadsRoutes = Router();

uploadsRoutes.post("/image", upload.single("image"), asyncHandler(uploadsController.image));
