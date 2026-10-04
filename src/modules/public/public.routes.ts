import { Router } from "express";
import { asyncHandler, validate } from "../../utils/http.js";
import { publicController } from "./public.controller.js";
import { eventParamSchema, publicAlbumPhotosQuerySchema, publicAlbumQuerySchema, publicEventQuerySchema, slugParamSchema } from "./public.schemas.js";

export const publicRoutes = Router();

publicRoutes.get("/events", validate({ query: publicEventQuerySchema }), asyncHandler(publicController.events));
publicRoutes.get("/events/:id", validate({ params: eventParamSchema }), asyncHandler(publicController.event));
publicRoutes.get("/albums", validate({ query: publicAlbumQuerySchema }), asyncHandler(publicController.albums));
publicRoutes.get("/albums/:slug", validate({ params: slugParamSchema }), asyncHandler(publicController.album));
publicRoutes.get("/albums/:slug/photos", validate({ params: slugParamSchema, query: publicAlbumPhotosQuerySchema }), asyncHandler(publicController.albumPhotos));
publicRoutes.get("/sponsors", asyncHandler(publicController.sponsors));
publicRoutes.get("/empresas", asyncHandler(publicController.sponsors));
