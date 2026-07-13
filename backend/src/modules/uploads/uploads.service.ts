import { Readable } from "node:stream";
import { cloudinary } from "../../lib/cloudinary.js";
import { AppError } from "../../utils/http.js";

export const uploadsService = {
  async uploadImage(file?: Express.Multer.File) {
    if (!file) throw new AppError("Arquivo não enviado", 400);

    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder: "coracao-gaucho",
          resource_type: "image"
        },
        (error, result) => {
          if (error) return reject(error);
          return resolve(result);
        }
      );

      Readable.from(file.buffer).pipe(upload);
    });
  }
};
