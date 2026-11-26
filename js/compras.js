// Lista de compras por categoria, na ordem em que se anda no mercado.
export const CATS = [
  ['hortifruti', 'Frutas e verduras', /banana|ma[çc][ãa]|laranja|lim[ãa]o|mam[ãa]o|melancia|mel[ãa]o|\buvas?\b|morango|abacate|abacaxi|manga|pera|kiwi|goiaba|maracuj|tomate|alface|r[úu]cula|couve|cebola|alho|batata|cenoura|beterraba|ab[óo]bora|abobrinha|chuchu|pepino|piment[ãa]o|br[óo]colis|espinafre|repolho|mandioca|aipim|inhame|cheiro|salsinha|cebolinha|coentro|hortel|gengibre|fruta|verdura|legume|salada/i],
  ['acougue', 'Carnes e ovos', /carne|frango|peito|coxa|sobrecoxa|bife|patinho|alcatra|picanha|costela|mo[íi]da|lingui[çc]a|bacon|porco|lombo|peixe|til[áa]pia|salm[ãa]o|camar[ãa]o|atum fresco|\bovos?\b|hamb[úu]rguer/i],
  ['frios', 'Laticínios e frios', /leite(?! condensado)|iogurte|queijo|requeij|manteiga|margarina|presunto|peito de peru|mussarela|muçarela|ricota|cream cheese|\bnata\b|creme de leite|coalhada|kefir|frios|salame/i],
  ['padaria', 'Padaria', /p[ãa]o|p[ãa]es|bisnaga|torrada|bolo|biscoito de polvilho|croissant|tapioca|wrap|rap10|sonho/i],
  ['mercearia', 'Mercearia', /arroz|feij[ãa]o|macarr[ãa]o|massa|farinha|a[çc][úu]car|sal\b|[óo]leo|azeite|vinagre|caf[ée]|ch[áa]\b|achocolatado|aveia|granola|cereal|milho|ervilha|molho|extrato|catchup|ketchup|maionese|mostarda|tempero|caldo|fermento|gelatina|leite condensado|biscoito|bolacha|chocolate|pipoca|atum|sardinha|azeitona|castanha|amendoim|mel\b|geleia|pasta de amendoim|lentilha|gr[ãa]o|quinoa|chia/i],
  ['bebidas', 'Bebidas', /[áa]gua(?! sanit)|suco|refri|refrigerante|coca|guaran|cerveja|vinho|ch[áa] gelado|isot[ôo]nico|energ[ée]tico|kombucha|[áa]gua de coco/i],
  ['congelados', 'Congelados', /congelad|sorvete|pizza|lasanha|nugget|batata frita|p[ãa]o de queijo|polpa|a[çc]a[íi]/i],
  ['limpeza', 'Limpeza', /detergente|sab[ãa]o|amaciante|desinfetante|[áa]gua sanit[áa]ria|cloro|alvejante|multiuso|veja|esponja|pano|flanela|vassoura|rodo|saco de lixo|lixo|limpa|lustra|tira.?manchas|bombril|palha de a[çc]o|lava.?lou[çc]a|pedra sanit|inseticida|luva/i],
  ['higiene', 'Higiene e cuidados', /papel higi[êe]nico|sabonete|shampoo|xampu|condicionador|creme dental|pasta de dente|escova de dente|fio dental|desodorante|absorvente|algod[ãa]o|cotonete|hidratante|protetor solar|len[çc]o de papel|aparelho de barbear|gilete|enxaguante/i],
  ['bebe', 'Bebê', /fralda|len[çc]o umedecido|pomada|mamadeira|chupeta|bebê|bebe|beb[êe]|leite em p[óo]|f[óo]rmula|papinha|bico|banheira|talco/i],
  ['pets', 'Pets', /ra[çc][ãa]o|petisco|areia|tapete higi|pet\b|cachorro|gato|antipulga/i],
  ['farmacia', 'Farmácia', /rem[ée]dio|vitamina|dipirona|paracetamol|curativo|band.?aid|term[ôo]metro|soro|pr[ée].?natal|farm[áa]cia/i],
  ['outros', 'Outros', /.^/],
];
export const NOME = Object.fromEntries(CATS.map(([k, n]) => [k, n]));
export function classificar(t) {
  const s = String(t || '');
  for (const [k, , rx] of CATS) if (rx.test(s)) return k;
  return 'outros';
}
export const catDe = item => item.cat && NOME[item.cat] ? item.cat : classificar(item.t);

export function agrupar(lista) {
  const g = new Map(CATS.map(([k]) => [k, []]));
  for (const it of lista) g.get(catDe(it)).push(it);
  return [...g.entries()].filter(([, v]) => v.length);
}

export const SUGESTOES = {
  hortifruti: ['Banana', 'Maçã', 'Tomate', 'Cebola', 'Alho', 'Batata', 'Alface'],
  acougue: ['Ovos', 'Frango', 'Carne moída'],
  frios: ['Leite', 'Queijo', 'Iogurte', 'Manteiga'],
  padaria: ['Pão'],
  mercearia: ['Arroz', 'Feijão', 'Café', 'Macarrão', 'Azeite'],
  limpeza: ['Detergente', 'Sabão de roupa', 'Amaciante', 'Saco de lixo', 'Esponja'],
  higiene: ['Papel higiênico', 'Sabonete', 'Creme dental'],
  bebe: ['Fraldas', 'Lenço umedecido'],
  pets: ['Ração'],
};

// Quantidade: entende "2 leite", "leite 2", "2x leite", "1kg arroz", "arroz 5 kg", "3 dz ovos"
const UN = '(?:x|un|und|unid|kg|g|gr|l|lt|ml|pct|pcts|pacotes?|cx|caixas?|dz|d[uú]zias?|latas?|garrafas?|fardos?|rolos?|sacos?|bandejas?|potes?|ma[çc]os?)';
const RX_INI = new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${UN})?\\.?\\s+(.+)$`, 'i');
const RX_FIM = new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*(${UN})?\\.?$`, 'i');
export function separarQtd(txt) {
  const s = String(txt).trim();
  let m = s.match(RX_INI);
  if (m) return { t: m[3].trim(), qtd: fmt(m[1], m[2]) };
  m = s.match(RX_FIM);
  if (m && !/^\d/.test(m[1])) return { t: m[1].trim(), qtd: fmt(m[2], m[3]) };
  return { t: s, qtd: '' };
}
const fmt = (n, u) => { u = (u || '').toLowerCase(); return u === 'x' || !u ? n : `${n} ${u}`; };
// Soma/subtrai 1 mantendo a unidade ("2 kg" -> "3 kg")
export function passo(qtd, d) {
  const m = String(qtd || '').match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  const n = m ? Number(m[1].replace(',', '.')) : (qtd ? 1 : 0);
  const novo = Math.max(0, n + d);
  const un = m ? m[2] : '';
  return novo ? `${String(novo).replace('.', ',')}${un ? ' ' + un : ''}` : '';
}

// ---------- Valores, prioridade e orçamento ----------
export const PRIOS = { essencial: 'Essencial', importante: 'Importante', esperar: 'Pode esperar' };
const PRIO_CAT = { hortifruti: 'essencial', acougue: 'essencial', frios: 'essencial', mercearia: 'essencial', higiene: 'essencial', bebe: 'essencial', farmacia: 'essencial', pets: 'essencial', limpeza: 'importante', padaria: 'importante', bebidas: 'esperar', congelados: 'esperar', outros: 'importante' };
export const prioDe = c => PRIOS[c.prio] ? c.prio : PRIO_CAT[catDe(c)] || 'importante';
export const proxPrio = p => ({ essencial: 'importante', importante: 'esperar', esperar: 'essencial' })[p];

// quantidade numérica: "2" → 2, "1,5 kg" → 1.5, "500 g" → 0.5 (valor por kg/litro), texto → 1
export function qtdNum(q) {
  const m = String(q || '').match(/(\d+(?:[.,]\d+)?)\s*([a-zç]*)/i);
  if (!m) return 1;
  const n = Number(m[1].replace(',', '.'));
  return /^(g|gr|ml)$/i.test(m[2]) ? n / 1000 : n;
}
export const totalItem = c => c.preco != null && c.preco !== '' ? Number(c.preco) * qtdNum(c.qtd) : null;

// Plano: o que cabe no orçamento, por prioridade (essencial → importante → pode esperar), na ordem da lista
export function plano(lista, orcamento) {
  const abertos = lista.filter(c => !c.feito);
  const total = abertos.reduce((s, c) => s + (totalItem(c) || 0), 0);
  const semPreco = abertos.filter(c => totalItem(c) == null).length;
  const porPrio = { essencial: 0, importante: 0, esperar: 0 };
  for (const c of abertos) porPrio[prioDe(c)] += totalItem(c) || 0;
  const comprado = lista.filter(c => c.feito).reduce((s, c) => s + (totalItem(c) || 0), 0);
  const cabe = new Set(), fora = new Set();
  let resta = orcamento == null ? Infinity : orcamento - comprado; // o que já está no carrinho já usou parte do saldo
  let faltouMaisImportante = false; // se um essencial não coube, nada de prioridade menor entra na frente dele
  for (const p of ['essencial', 'importante', 'esperar']) {
    let faltouAqui = false;
    for (const c of abertos.filter(x => prioDe(x) === p)) {
      const v = totalItem(c); if (v == null) continue;
      if (!faltouMaisImportante && v <= resta + 0.005) { cabe.add(c.id); resta -= v; } else { fora.add(c.id); faltouAqui = true; }
    }
    if (faltouAqui) faltouMaisImportante = true;
  }
  const geral = total + comprado;
  return { total, geral, comprado, semPreco, porPrio, cabe, fora, sobra: orcamento == null ? null : orcamento - geral };
}
