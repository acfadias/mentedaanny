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
