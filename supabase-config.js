// Substitua pelas suas chaves retiradas do painel do Supabase
const SUPABASE_URL = 'https://SEU_PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_CHAVE_ANON';

// Inicializa o cliente Supabase globalmente
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
