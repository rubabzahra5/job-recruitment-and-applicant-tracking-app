/**
 * Pakistan's provinces/territories, mirroring the database CHECK on
 * locations.province (supabase/migrations/0002_catalog.sql).
 * Plain module (no "use server") so client components can import it.
 */
export const PROVINCES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Islamabad Capital Territory",
  "Gilgit-Baltistan",
  "Azad Jammu and Kashmir",
] as const;
