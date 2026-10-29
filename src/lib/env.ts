import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB: z.string().default("voting"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters long"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL").default("http://localhost:3000"),
  
  // Twilio Verify Credentials
  TWILIO_ACCOUNT_SID: z.string().min(1, "TWILIO_ACCOUNT_SID is required"),
  TWILIO_API_KEY: z.string().min(1, "TWILIO_API_KEY is required"),
  TWILIO_API_SECRET: z.string().min(1, "TWILIO_API_SECRET is required"),
  TWILIO_VERIFY_SERVICE_SID: z.string().min(1, "TWILIO_VERIFY_SERVICE_SID is required"),

  // Upstash Redis (Optional for dev fallback)
  UPSTASH_REDIS_REST_URL: z.string().optional().default(""),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional().default(""),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formattedErrors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `\n❌ Invalid Environment Variables Configuration:\n${formattedErrors}\n`
    );
  }
  return result.data;
}

export const env = validateEnv();
