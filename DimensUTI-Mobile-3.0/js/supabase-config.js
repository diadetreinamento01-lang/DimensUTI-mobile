// ==========================================
// DIMENSUTI MOBILE 4.0
// CONFIGURAÇÃO DO SUPABASE
// ==========================================

const SUPABASE_URL = "https://aktkyagpukmhzwagehwc.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable__16Kye0vZZPsoXBH43K4Dg_etVDZGQo";

// Cria a conexão com o Supabase
const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
