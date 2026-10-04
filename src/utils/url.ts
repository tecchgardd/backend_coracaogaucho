const CLOUDINARY_HTTP = /^http:\/\/res\.cloudinary\.com\//i;

export function cloudinaryHttps<T extends string | null | undefined>(url: T): T {
  if (typeof url !== "string") return url;
  return url.replace(CLOUDINARY_HTTP, "https://res.cloudinary.com/") as T;
}
