import type { Express } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

/**
 * Register object storage routes for file uploads.
 *
 * This provides routes for the presigned URL upload flow:
 * 1. POST /api/uploads/request-url - Get a presigned URL for uploading (requires auth)
 * 2. The client then uploads directly to the presigned URL
 */
export function registerObjectStorageRoutes(app: Express, authMiddleware?: (req: any, res: any, next: any) => void): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Request a presigned URL for file upload.
   * Requires authentication to prevent abuse.
   *
   * Request body (JSON):
   * {
   *   "name": "filename.jpg",
   *   "size": 12345,
   *   "contentType": "image/jpeg"
   * }
   *
   * Response:
   * {
   *   "uploadURL": "https://storage.googleapis.com/...",
   *   "objectPath": "/objects/uploads/uuid"
   * }
   */
  const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "image/heif",
  ]);

  const uploadHandler = async (req: any, res: any) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      if (!contentType || !ALLOWED_MIME_TYPES.has(contentType)) {
        return res.status(400).json({
          error: "Invalid file type. Only JPEG, PNG, GIF, WebP, and HEIC images are allowed.",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Extract object path from the presigned URL for later reference
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        // Echo back the metadata for client convenience
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  };

  // Register upload route with optional auth middleware
  if (authMiddleware) {
    app.post("/api/uploads/request-url", authMiddleware, uploadHandler);
  } else {
    app.post("/api/uploads/request-url", uploadHandler);
  }

  /**
   * Serve uploaded objects.
   *
   * GET /objects/uploads/:objectId
   *
   * This serves files from object storage. For public files, no auth needed.
   * For protected files, add authentication middleware and ACL checks.
   */
  app.get("/objects/uploads/:objectId", async (req, res) => {
    try {
      const objectPath = `/objects/uploads/${req.params.objectId}`;
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

