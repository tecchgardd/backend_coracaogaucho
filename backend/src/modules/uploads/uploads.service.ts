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
          if (!result?.secure_url) return reject(new AppError("Cloudinary não retornou a URL segura da imagem", 502));
          return resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format
          });
        }
      );

      Readable.from(file.buffer).pipe(upload);
    });
  }
};
