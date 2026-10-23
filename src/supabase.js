// Conexão com o projeto JOVI_Agenda no Supabase.
// A chave "publishable" é pública por natureza: quem protege os dados são as
// regras de acesso (RLS) criadas no banco. NUNCA coloque aqui uma chave "secret".
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://voqfflczfubuklwidiry.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_vb-g1Xpa0XkN1U-xr1dfjQ_P2SF6I6r';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Cliente separado, sem guardar sessão, para o mestre cadastrar logins
// sem ser desconectado.
export const supabaseCadastro = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'agenda-cadastro' },
});
