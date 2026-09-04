// ==========================================
// DIMENSUTI MOBILE 4.0
// CONFIGURAÇÃO DO SUPABASE
// ==========================================

const SUPABASE_URL = "https://aktkyagpukmhzwagehwc.supabase.co";

// Cole aqui a sua PUBLISHABLE KEY do Supabase
const SUPABASE_PUBLISHABLE_KEY = "COLE_AQUI_SUA_PUBLISHABLE_KEY";

// Cria a conexão com o Supabase
const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
