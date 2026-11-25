// Função "agenda-push" — recebe as reuniões enviadas pelo Apps Script da conta da Tutory
// (para agendas de instituição que não liberam o endereço secreto iCal).
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default;
const sb = createClient(Deno.env.get('SUPABASE_URL')!, chave);
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
const txt = (v: unknown, max = 300) => String(v ?? '').slice(0, max);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: true });
  const cod = req.headers.get('x-codigo') ?? '';
  if (!/^[a-f0-9]{32,64}$/.test(cod)) return json({ erro: 'Código inválido' }, 404);
  if (!chave) return json({ erro: 'A função não encontrou a chave de serviço do Supabase.' }, 500);
  const { data: dono, error: e1 } = await sb.from('dados').select('user_id, valor').eq('chave', 'push:' + cod).maybeSingle();
  if (e1) return json({ erro: 'Erro ao ler o banco: ' + e1.message }, 500);
  if (!dono) return json({ erro: 'Código não encontrado na sua conta. No app (logada), confira o código em Ajustes → Agendas.' }, 404);
  if (!dono.valor) return json({ erro: 'Este código foi substituído por um novo. Copie o código atual do app.' }, 404);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ erro: 'Corpo inválido' }, 400); }
  const fonte = body.fonte === 'pessoal' ? 'pessoal' : 'trabalho';
  const eventos = (Array.isArray(body.eventos) ? body.eventos : []).slice(0, 3000).map((e: any) => ({
    id: txt(e.id, 200), titulo: txt(e.titulo) || '(sem título)', ini: Number(e.ini), fim: Number(e.fim) || Number(e.ini),
    diaTodo: !!e.diaTodo, local: txt(e.local), link: /^https?:\/\//.test(e.link ?? '') ? txt(e.link, 500) : null,
  })).filter((e: any) => Number.isFinite(e.ini));

  const agora = Date.now();
  const { error } = await sb.from('dados').upsert({ user_id: dono.user_id, chave: 'agenda:' + fonte, valor: { eventos, quando: agora }, atualizado: agora }, { onConflict: 'user_id,chave' });
  if (error) return json({ erro: error.message }, 500);
  return json({ ok: true, eventos: eventos.length });
});
