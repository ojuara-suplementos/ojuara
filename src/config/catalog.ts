/** Only public browser credentials belong here. Never use a service-role key. */
export function publicCatalogConfig(env: Record<string, string | undefined>) {
  return {
    url: env.VITE_SUPABASE_URL?.trim() || "https://frvubpxorbearnborjwv.supabase.co",
    key: env.VITE_SUPABASE_ANON_KEY?.trim() || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZydnVicHhvcmJlYXJuYm9yand2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTA3MjEsImV4cCI6MjA5MjI2NjcyMX0.YDR1M8jAF4XBNIVMvnQMBAUdjw5NzEY6Bf5QM8_Jsd0",
  };
}