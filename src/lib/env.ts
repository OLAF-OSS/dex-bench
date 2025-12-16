import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    LLM_BASE_URL: z.url(),
    LLM_API_KEY: z.string().min(1),
  },
  runtimeEnv: {
    LLM_BASE_URL: process.env.LLM_BASE_URL,
    LLM_API_KEY: process.env.LLM_API_KEY,
  },
});
