import { createClient } from "@supabase/supabase-js";

/**
 * Lê uma variável de ambiente do Vite (prefixo VITE_) e usa o valor
 * embutido como fallback quando ela não está definida — assim o app
 * continua funcionando localmente sem .env.
 */
function fromEnv(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

const SUPABASE_URL = fromEnv(
  import.meta.env.VITE_SUPABASE_URL,
  "https://frvubpxorbearnborjwv.supabase.co",
);

const SUPABASE_ANON_KEY = fromEnv(
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZydnVicHhvcmJlYXJuYm9yand2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTA3MjEsImV4cCI6MjA5MjI2NjcyMX0.YDR1M8jAF4XBNIVMvnQMBAUdjw5NzEY6Bf5QM8_Jsd0",
);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    storageKey: "ojuara-auth",
  },
});
