import multer from "multer";
import { Router } from "express";
import { asyncHandler } from "../../utils/http.js";
import { fotosController } from "./fotos.controller.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1000
  }
});

export const fotosRoutes = Router();

fotosRoutes.post("/upload", upload.array("photos", 1000), asyncHandler(fotosController.upload));
