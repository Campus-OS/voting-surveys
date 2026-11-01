import { z } from "zod";

// Disallow HTML tags (<...>) to protect against XSS injection
const noHtmlRegex = /<[^>]*>/g;
const sanitizeString = (val: string) => val.replace(noHtmlRegex, "").trim();

export const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const mongoIdParamSchema = z
  .object({
    id: z.string().regex(objectIdRegex, "Invalid ObjectId format"),
  })
  .strict();

export const geoJsonPolygonSchema = z
  .object({
    type: z.literal("Polygon"),
    coordinates: z
      .array(
        z.array(
          z.tuple([
            z.number().min(-180).max(180), // Longitude
            z.number().min(-90).max(90),   // Latitude
          ])
        ).min(3, "Exterior ring must contain at least 3 points")
      )
      .min(1, "Polygon must have at least one exterior ring"),
  })
  .strict();

export const candidateInputSchema = z
  .object({
    name: z
      .string()
      .min(1, "Candidate name is required")
      .max(100, "Candidate name must not exceed 100 characters")
      .transform(sanitizeString),
    party: z
      .string()
      .max(100, "Party name must not exceed 100 characters")
      .transform(sanitizeString)
      .optional()
      .or(z.literal("")),
    imageUrl: z
      .string()
      .url("Invalid image URL")
      .max(500, "Image URL must not exceed 500 characters")
      .optional()
      .or(z.literal("")),
  })
  .strict();

export const updateCandidateInputSchema = z
  .object({
    name: z
      .string()
      .min(1, "Candidate name cannot be empty")
      .max(100, "Candidate name must not exceed 100 characters")
      .transform(sanitizeString)
      .optional(),
    party: z
      .string()
      .max(100, "Party name must not exceed 100 characters")
      .transform(sanitizeString)
      .optional()
      .or(z.literal("")),
    imageUrl: z
      .string()
      .url("Invalid image URL")
      .max(500, "Image URL must not exceed 500 characters")
      .optional()
      .or(z.literal("")),
  })
  .strict();

export const createSurveySchema = z
  .object({
    name: z
      .string()
      .min(3, "Survey name must be at least 3 characters")
      .max(100, "Survey name must not exceed 100 characters")
      .transform(sanitizeString),
    description: z
      .string()
      .max(500, "Description must not exceed 500 characters")
      .transform(sanitizeString)
      .optional()
      .or(z.literal("")),
    polygon: geoJsonPolygonSchema,
    isActive: z.boolean().default(true),
  })
  .strict();

export const updateSurveySchema = z
  .object({
    name: z
      .string()
      .min(3, "Survey name must be at least 3 characters")
      .max(100, "Survey name must not exceed 100 characters")
      .transform(sanitizeString)
      .optional(),
    description: z
      .string()
      .max(500, "Description must not exceed 500 characters")
      .transform(sanitizeString)
      .optional(),
    polygon: geoJsonPolygonSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const sendOtpSchema = z
  .object({
    phone: z
      .string()
      .regex(/^\+[1-9]\d{6,14}$/, "Phone number must be in E.164 format (e.g. +12345678901)"),
  })
  .strict();

export const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;
export const normalizePhone = (s: string) => s.replace(/[\s\-().]/g, "");

export const OptionalPhoneSchema = z
  .preprocess((v) => {
    if (typeof v !== "string") return undefined;
    const trimmed = v.trim();
    if (!trimmed) return undefined;          // treat "" / "   " as "not provided"
    return normalizePhone(trimmed);
  }, z.string().refine((s) => PHONE_REGEX.test(s), {
    message: "Phone number must be in valid international format (e.g. +12345678901)",
  }))
  .optional();

export const castVoteSchema = z
  .object({
    candidateId: z.string().min(1, "Candidate ID is required"),
    lat: z
      .number()
      .min(-90, "Latitude must be >= -90")
      .max(90, "Latitude must be <= 90"),
    lng: z
      .number()
      .min(-180, "Longitude must be >= -180")
      .max(180, "Longitude must be <= 180"),
    deviceId: z
      .string()
      .min(8, "Device identifier required")
      .max(128, "Device identifier too long"),
  })
  .strict();

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
