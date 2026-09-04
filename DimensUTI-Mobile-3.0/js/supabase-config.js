// ==========================================
// DIMENSUTI MOBILE
// CONFIGURAÇÃO DO SUPABASE
// ==========================================

const SUPABASE_URL = "https://aktkyagpukmhzwagehwc.supabase.co/rest/v1/;

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable__16Kye0vZZPsoXBH43K4Dg_etVDZGQo";

// Verifica se a biblioteca do Supabase foi carregada
if (!window.supabase) {
  console.error("Biblioteca do Supabase não foi carregada.");
}

// Cria a conexão
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

console.log("Supabase configurado:", SUPABASE_URL);
