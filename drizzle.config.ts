import { config } from "dotenv";
import { resolve } from "path";
import { defineConfig } from "drizzle-kit";

// Load .env.local for Next.js convention
config({ path: resolve(__dirname, ".env.local") });

export default defineConfig({
  schema: "./database/schema.ts",
  // Output migrations to Supabase migrations folder for seamless integration
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Uses DATABASE_URL from .env.local
    // Local Supabase: postgresql://postgres:postgres@localhost:54322/postgres
    // Production: Your Supabase project's connection string
    url: process.env.DATABASE_URL!
  }
});
