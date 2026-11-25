// Plano devocional 25/11 a 31/12/2026 — Advento: a espera, como a reta final da gestação.
export const ETAPAS = [
  { t: 'Aquietar', d: 'Respirar fundo, celular longe, pedir que Deus fale.', min: 2 },
  { t: 'Leitura principal', d: 'Ler devagar. Se der, ler duas vezes.', min: 8 },
  { t: 'Salmo de apoio', d: 'Ler em voz alta, como oração.', min: 3 },
  { t: 'Reflexão', d: 'O que chamou atenção? O que diz sobre Deus? E sobre mim?', min: 4 },
  { t: 'Diário', d: 'Responder à pergunta do dia por escrito.', min: 5 },
  { t: 'Oração', d: 'Agradecer, entregar, pedir. Usar a pergunta como guia.', min: 3 },
];
export const CURTA = 'Versão curta (dias difíceis): só o Salmo + uma frase no diário + oração. Conta como feito. 🤍';

export const SEMANAS = [
  { tema: 'Aproximar-se de Deus', verso: '“Chegai-vos a Deus, e ele se chegará a vós.” — Tg 4:8' },
  { tema: 'Advento · Esperança e ansiedade', verso: '“Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.” — 1Pe 5:7' },
  { tema: 'Advento · Descanso e me priorizar', verso: '“Vinde a mim, todos os que estais cansados e sobrecarregados, e eu vos aliviarei.” — Mt 11:28' },
  { tema: 'Advento · Amor e relacionamentos', verso: '“Nós amamos porque ele nos amou primeiro.” — 1Jo 4:19' },
  { tema: 'Advento e Natal · Maternidade', verso: '“Por este menino orava eu; e o Senhor me concedeu a petição.” — 1Sm 1:27' },
  { tema: 'Gratidão e confiança', verso: '“As misericórdias do Senhor se renovam cada manhã.” — Lm 3:22-23' },
];

// [data, semana, leitura, salmo, foco, pergunta]
const L = [
  ['2026-11-25', 0, 'Jo 15:1-17', 'Sl 27', 'Permanecer na videira', 'O que significa “permanecer” em Deus num dia corrido como o meu?'],
  ['2026-11-26', 0, 'Tg 4:1-10', 'Sl 42', 'Voltar o coração para Deus', 'O que tem me afastado de Deus ultimamente?'],
  ['2026-11-27', 0, 'Lc 10:38-42', 'Sl 46', 'Marta e Maria', 'Onde estou “inquieta e preocupada com muitas coisas”? Qual é a “uma coisa necessária” hoje?'],
  ['2026-11-28', 0, 'Sl 139:1-18', 'Sl 139:23-24', 'Totalmente conhecida', 'O que Deus já sabe sobre mim que eu ainda tento esconder dele?'],
  ['2026-11-29', 1, 'Is 40:1-11, 28-31', 'Sl 130', 'Os que esperam no Senhor', 'O que estou esperando agora — e como quero esperar?'],
  ['2026-11-30', 1, 'Mt 6:25-34', 'Pv 3:5-6', 'Não andeis ansiosos', 'Qual preocupação de amanhã estou carregando hoje?'],
  ['2026-12-01', 1, 'Fp 4:4-13', 'Sl 34:1-10', 'A paz que guarda o coração', 'Liste 5 motivos de gratidão. Como a ansiedade muda depois disso?'],
  ['2026-12-02', 1, '1Pe 5:6-11', 'Sl 55:22', 'Lançar a ansiedade', 'Que ansiedade específica eu entrego hoje? Escreva-a e entregue.'],
  ['2026-12-03', 1, 'Mc 4:35-41', 'Sl 107:23-31', 'Jesus na tempestade', 'Qual “tempestade” parece maior que Jesus para mim agora?'],
  ['2026-12-04', 1, 'Is 43:1-7', 'Sl 121', '“Não temas, tu és minha”', 'Do que tenho medo em relação ao parto e à maternidade?'],
  ['2026-12-05', 1, 'Rm 8:18-28', 'Sl 62:1-8', 'Dores de parto e propósito', 'Onde já vi Deus transformar dor em algo bom na minha história?'],
  ['2026-12-06', 2, 'Mt 11:25-30', 'Sl 23', 'O jugo suave', 'Que peso estou carregando que Jesus nunca me pediu para carregar?'],
  ['2026-12-07', 2, '1Rs 19:1-18', 'Sl 3', 'Elias: comida, sono e a voz suave', 'Antes de ouvir Deus, Elias comeu e dormiu. Do que meu corpo precisa hoje?'],
  ['2026-12-08', 2, 'Mc 6:30-46', 'Sl 4', '“Vinde à parte e descansai”', 'Onde posso criar um momento “à parte” esta semana?'],
  ['2026-12-09', 2, 'Ef 2:1-10', 'Sl 8', 'Sou feitura de Deus', 'Que palavra eu uso para me descrever que Deus não usaria?'],
  ['2026-12-10', 2, 'Gn 1:26–2:3', 'Sl 92', 'O descanso faz parte da criação', 'Descansar me dá culpa? Por quê?'],
  ['2026-12-11', 2, '2Co 12:7-10', 'Sl 103:1-14', 'Graça na fraqueza', 'Qual fraqueza minha (esquecimento, desorganização) Deus pode usar para mostrar sua graça?'],
  ['2026-12-12', 2, 'Rm 8:14-17, 31-39', 'Sl 16', 'Filha, não escrava', 'O que muda no meu dia se eu acreditar que sou filha amada, e não funcionária de Deus?'],
  ['2026-12-13', 3, '1Co 13', 'Sl 136:1-9', 'O que é o amor', 'Qual característica do amor de 1Co 13 mais me falta?'],
  ['2026-12-14', 3, '1Jo 4:7-21', 'Sl 63', 'Deus é amor', 'Eu me sinto amada por Deus ou só “tolerada”? Por quê?'],
  ['2026-12-15', 3, 'Rt 1', 'Sl 133', 'A lealdade de Rute', 'Quem tem sido “Rute” na minha vida? Como posso agradecer?'],
  ['2026-12-16', 3, 'Cl 3:12-17', 'Pv 15:1-4', 'Revestir-se de amor', 'Qual relacionamento precisa de mais paciência minha agora?'],
  ['2026-12-17', 3, 'Ef 4:1-3, 25-32', 'Sl 141:3', 'Palavras que edificam', 'Há alguém que preciso perdoar ou a quem preciso pedir perdão?'],
  ['2026-12-18', 3, 'Ec 4:9-12; Ct 8:6-7', 'Sl 128', 'O cordão de três dobras', 'Como Deus pode estar no centro da minha família nesta nova fase?'],
  ['2026-12-19', 3, 'Jo 13:1-17', 'Sl 145:8-9', 'Amar servindo', 'Como posso servir alguém amanhã sem me esgotar?'],
  ['2026-12-20', 4, '1Sm 1', 'Sl 113', 'Ana: o desejo de ser mãe', 'Escreva uma oração pelo seu bebê.'],
  ['2026-12-21', 4, '1Sm 2:1-10', 'Sl 127', 'O cântico de Ana', 'O que Deus já fez por mim nesta gestação?'],
  ['2026-12-22', 4, 'Lc 1:5-25', 'Sl 71:5-6', 'Isabel: Deus vê', 'Em que área sinto que Deus “tirou minha vergonha”?'],
  ['2026-12-23', 4, 'Lc 1:26-38', 'Sl 139:13-16', '“Eis aqui a serva do Senhor”', 'O que significa dizer “faça-se em mim” sobre o parto e o pós-parto?'],
  ['2026-12-24', 4, 'Lc 1:39-56', 'Sl 22:9-10', 'Duas grávidas se encontram', 'Quais mulheres quero perto de mim no puerpério?'],
  ['2026-12-25', 4, 'Lc 2:1-20', 'Is 9:2-7', 'O nascimento de Jesus 🎄', 'Maria deu à luz longe do “ideal”. O que preciso soltar das minhas expectativas?'],
  ['2026-12-26', 4, 'Lc 2:21-40', 'Is 66:12-13', 'Deus consola como mãe', 'Como Deus tem sido “mãe” para mim?'],
  ['2026-12-27', 5, 'Lc 2:41-52', 'Sl 131', 'Maria guardava tudo no coração', 'O que de 2026 quero guardar no coração?'],
  ['2026-12-28', 5, 'Is 49:13-16', 'Sl 100', '“Eu não me esquecerei de ti”', 'Mesmo quando eu esqueço, Deus não esquece. Como isso me consola?'],
  ['2026-12-29', 5, 'Dt 6:1-9', 'Sl 78:1-7', 'Ensinar aos filhos', 'Que fé quero transmitir ao meu filho ou filha?'],
  ['2026-12-30', 5, 'Lm 3:19-26', 'Sl 90', 'Misericórdias a cada manhã', 'Que recomeço preciso me permitir?'],
  ['2026-12-31', 5, 'Is 43:16-21; Ap 21:1-5', 'Sl 126', '“Eis que faço coisa nova” ✨', 'Escreva 3 pedidos e 3 agradecimentos para 2027.'],
];

export const PLANO = L.map(([data, s, leitura, salmo, foco, pergunta]) => ({ data, semana: SEMANAS[s], leitura, salmo, foco, pergunta }));
export const doDia = data => PLANO.find(p => p.data === data) || null;
