import { Router } from "express";
import { asyncHandler } from "../../utils/http.js";
import { dashboardController } from "./dashboard.controller.js";

export const dashboardRoutes = Router();

dashboardRoutes.get("/", asyncHandler(dashboardController.resumo));
