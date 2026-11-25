// Regras da rotina. Tudo que é fixo da semana mora aqui.
import { get } from './store.js';

export const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const DIAS_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const deYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const minutos = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const agoraMin = (d = new Date()) => d.getHours() * 60 + d.getMinutes();
export const dataLonga = d => `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
const util = d => d.getDay() >= 1 && d.getDay() <= 5;

// Tarefas da casa: dia da semana (1=seg … 5=sex)
export const CASA = [
  { id: 'louca', titulo: 'Lavar a louça', hora: '19:30', dias: [1, 3, 5], icone: '🍽' },
  { id: 'roupa', titulo: 'Lavar roupa', hora: '19:30', dias: [2, 4], icone: '🧺' },
  { id: 'chao', titulo: 'Limpar o chão', hora: '20:00', dias: [3, 5], icone: '🧹' },
  { id: 'checkcasa', titulo: 'Checar cozinha e escritório', hora: '18:30', dias: [1, 2, 3, 4, 5], icone: '✓', sub: 'Cozinha limpa · escritório em ordem · 15 min' },
];

export const DEVO_MANHA = '08:00', DEVO_LIMITE = '12:00', DEVO_NOITE = '21:00';

export const checks = data => get('checks:' + data, {});
export const feito = (data, id) => !!checks(data)[id];

// Monta os itens de um dia, já aplicando as regras (devocional que vai pra noite, pendências de ontem, modo bebê).
export function itensDoDia(d = new Date(), agora = new Date()) {
  const data = ymd(d);
  const hoje = data === ymd(agora);
  const bebe = !!get('config', {}).bebe;
  const ch = checks(data);
  const itens = [];

  // Devocional — todo dia. Se não foi feito até 12h, vai sozinho para as 21h.
  const devoFeito = !!ch.devocional;
  const passouLimite = hoje ? agoraMin(agora) >= minutos(DEVO_LIMITE) : d < deYmd(ymd(agora));
  const movido = !devoFeito && passouLimite;
  itens.push({
    id: 'devocional', area: 'fe', titulo: bebe ? 'Devocional (versão curta)' : 'Devocional',
    hora: movido ? DEVO_NOITE : DEVO_MANHA,
    sub: movido ? 'Foi para a noite — sem problema 🤍' : (bebe ? 'Salmo + uma frase + oração' : '20–30 min · antes do trabalho'),
    tag: movido ? 'movido pra noite' : null, link: '#devocional',
  });

  if (!bebe && util(d)) {
    for (const t of CASA) if (t.dias.includes(d.getDay())) itens.push({ id: t.id, area: 'casa', titulo: `${t.icone} ${t.titulo}`, hora: t.hora, sub: t.sub || null });
    // Pendências do último dia útil anterior (opcional, sem culpa)
    const inicio = get('inicio', null);
    if (hoje) {
      let ant = addDias(d, -1); while (!util(ant)) ant = addDias(ant, -1);
      const chAnt = checks(ymd(ant));
      for (const t of CASA) {
        if (t.id === 'checkcasa') continue;
        if ((!inicio || ymd(ant) >= inicio) && t.dias.includes(ant.getDay()) && !chAnt[t.id] && !t.dias.includes(d.getDay()) && !chAnt['pulou:' + t.id]) {
          itens.push({ id: t.id, data: ymd(ant), area: 'casa', titulo: `${t.icone} ${t.titulo}`, hora: '19:00', sub: `Ficou de ${DIAS[ant.getDay()].toLowerCase()} · opcional`, tag: 'de ontem', opcional: true });
        }
      }
    }
  }

  itens.push({ id: 'vitamina', area: 'saude', titulo: '💊 Vitamina pré-natal', hora: '20:30', sub: 'Depois do jantar' });

  if (bebe) {
    itens.push({ id: 'agua1', area: 'saude', titulo: '💧 Água — 1º litro', hora: '10:00' });
    itens.push({ id: 'agua2', area: 'saude', titulo: '💧 Água — 2º litro', hora: '15:00' });
    itens.push({ id: 'descanso', area: 'saude', titulo: '🌙 Descansar 20 min', hora: '14:00', sub: 'Deitar, sem tela. Isso também é tarefa.' });
  }

  for (const it of itens) { it.data = it.data || data; it.feito = feito(it.data, it.id); }
  return itens.sort((a, b) => minutos(a.hora) - minutos(b.hora));
}

export function progresso(itens, top3 = []) {
  const contaveis = itens.filter(i => !i.opcional);
  const t3 = top3.filter(p => p.t && p.t.trim());
  const total = contaveis.length + t3.length;
  const ok = contaveis.filter(i => i.feito).length + t3.filter(p => p.feito).length;
  return { ok, total, pct: total ? ok / total : 0 };
}

export function saudacao(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}
