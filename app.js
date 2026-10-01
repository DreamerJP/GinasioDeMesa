import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  initializeFirestore, memoryLocalCache, terminate, clearIndexedDbPersistence,
  collection, doc, onSnapshot, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, arrayUnion,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const FIREBASE = {
  apiKey: 'AIzaSyA13vwn78UVFuTeSR1fnOmvUa8Nk-E697Q',
  authDomain: 'ginasio-de-mesa.firebaseapp.com',
  projectId: 'ginasio-de-mesa',
  appId: '1:777149850301:web:ef7fd180c2654bb338cdd4',
};
const CHAVE_SOM = 'ginasio.som';
const FUSO = 'America/Sao_Paulo';
const AGUARDANDO = 'Seu pedido de entrada foi enviado. Assim que o administrador aprovar, o ginásio abre sozinho.';
const KATEX = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/';
const LIMITE_FOTO = 45000;
const LADO_FOTO = 320;
const MAXIMO_DE_ROSTOS = 8;
const MAXIMO_DE_INSIGNIAS = 6;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SONS = {
  mover: 'midia/som-mover.wav',
  escolher: 'midia/som-escolher.wav',
  confirmar: 'midia/som-confirmar.wav',
  partidaFechada: 'midia/som-partida-fechada.wav',
  campeao: 'midia/som-campeao.wav',
  erro: 'midia/som-erro.wav',
};

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const INSIGNIAS = [
  { nome: 'Insígnia do Canto', trecho: 'Mar de verão', lore: 'O Ginásio começa sua travessia à beira do mar, no calor do verão, ao som do canto das baleias.' },
  { nome: 'Insígnia do Trovão', trecho: 'Tempestade de verão', lore: 'Uma tempestade varre o mar de verão. Os raios iluminam a água por um instante.' },
  { nome: 'Insígnia da Maré', trecho: 'Praia no fim do verão', lore: 'O verão chega ao fim. A maré leva o que ficou para trás e prepara a virada.' },
  { nome: 'Insígnia do Vento', trecho: 'Planície dos ventos', lore: 'O outono começa nas planícies abertas. O vento não deixa nada parado por muito tempo.' },
  { nome: 'Insígnia da Teia', trecho: 'Bosque das teias', lore: 'No bosque, as teias brilham com o orvalho da manhã. Cada fio marca um caminho.' },
  { nome: 'Insígnia da Lã', trecho: 'Pasto de nuvens', lore: 'O outono termina entre nuvens baixas e pasto macio. A jornada descansa antes do frio.' },
  { nome: 'Insígnia da Geada', trecho: 'Campos de gelo', lore: 'O inverno chega com força. Os campos de gelo cobrem o caminho até onde a vista alcança.' },
  { nome: 'Insígnia do Cume', trecho: 'Pico da montanha', lore: 'O ponto mais alto da travessia. Daqui se vê toda a jornada e o caminho que ainda falta.' },
  { nome: 'Insígnia do Leque', trecho: 'Vale do canto', lore: 'O inverno fica ameno no vale. Entre ecos e ventos suaves, a primavera já se anuncia.' },
  { nome: 'Insígnia da Flor', trecho: 'Jardim de espinhos', lore: 'A primavera floresce entre espinhos. As flores do jardim só abrem para quem passa com cuidado.' },
  { nome: 'Insígnia da Estrela', trecho: 'Árvore das estrelas', lore: 'A árvore mais alta da terra do Ginásio. Suas folhas brilham como estrelas na noite da primavera.' },
  { nome: 'Insígnia dos Confins', trecho: 'Confins do mapa', lore: 'O fim da travessia. Além daqui, o mapa está em branco. Até o Ginásio recomeçar no próximo ano.' },
].map((insignia, i) => ({ ...insignia, imagem: `midia/insignia-${String(i + 1).padStart(2, '0')}.webp` }));

const FOLGA_DO_ATROPELO = 1.5;
const METAS_DE_MESTRE = [5, 10, 15, 20, 25];
const NIVEIS = ['bronze', 'prata', 'ouro', 'platina', 'lendario'];
const NOME_DO_NIVEL = { bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro', platina: 'Platina', lendario: 'Lendário' };

// Metas só podem baixar: subir uma tiraria de alguém um nível já ganho.
const TITULOS = [
  { id: 'campeao', nome: 'Campeão', desenho: 'coroa', metas: [1, 2, 3, 6, 12], medida: 'Meses fechados em 1º.', unidade: ['mês em 1º', 'meses em 1º'] },
  { id: 'podio', nome: 'Figurinha do Pódio', desenho: 'podio', metas: [1, 3, 6, 9, 12], medida: 'Meses fechados entre os 3 primeiros.', unidade: ['mês no pódio', 'meses no pódio'] },
  { id: 'embalado', nome: 'Embalado', desenho: 'embalado', metas: [3, 4, 5, 6, 8], medida: 'Maior sequência de vitórias seguidas.', unidade: ['vitória seguida', 'vitórias seguidas'] },
  {
    id: 'atropelo', nome: 'Atropelo', desenho: 'atropelo', metas: [1, 3, 6, 10, 20],
    medida: `Vitórias com ${Math.round((FOLGA_DO_ATROPELO - 1) * 100)}% a mais que a média da mesa.`, unidade: ['vitória com folga', 'vitórias com folga'],
  },
  { id: 'trave', nome: 'Na Trave', desenho: 'trave', metas: [1, 3, 6, 10, 20], medida: 'Vezes em 2º a 1 ponto do vencedor.', unidade: ['vez', 'vezes'] },
  { id: 'cadeira', nome: 'Cadeira Cativa', desenho: 'cadeira', metas: [10, 30, 60, 100, 200], medida: 'Partidas jogadas.', unidade: ['partida', 'partidas'] },
  { id: 'mesa', nome: 'Dono da Mesa', desenho: 'mesa', metas: [5, 15, 30, 50, 100], medida: 'Partidas que abriu.', unidade: ['partida aberta', 'partidas abertas'] },
  { id: 'ecletico', nome: 'Eclético', desenho: 'ecletico', metas: [3, 5, 8, 12, 20], medida: 'Jogos diferentes jogados.', unidade: ['jogo', 'jogos'] },
  { id: 'lanterna', nome: 'Lanterninha', desenho: 'lanterna', metas: [5, 10, 20, 35, 50], medida: 'Vezes em último.', unidade: ['vez', 'vezes'], soPorEscolha: true },
  { id: 'estreante', nome: 'Estreante', desenho: 'estreante', metas: [1], medida: 'Jogou a primeira partida.', unidade: ['partida', 'partidas'] },
];

const CORES_DOS_ICONES = {
  k: '#1c1e3b',
  1: '#fff6c8', 2: '#ffe38a', 3: '#f2c14e', 4: '#c98f1f', 5: '#8a5a10',
  q: '#ff9a8a', r: '#ec5b5b', R: '#b53a3a', e: '#7a2233',
  a: '#d4e4ff', b: '#9cc2ff', B: '#5a86e8', D: '#3553a8', E: '#25306e',
  h: '#c8f5a8', g: '#8fdc72', G: '#4aa85a', H: '#2f6e3b',
  w: '#ffffff', s: '#e4e6f2', S: '#b3b7cf', d: '#7b80a0', x: '#50557a',
  m: '#f0c088', n: '#d99a5b', N: '#a8672f', M: '#6e3f1a',
  y: '#ffd84a', f: '#ffa23a', F: '#f2602b', Z: '#b83224',
};

const DESENHOS_DOS_TITULOS = {
  estreante: {
    base: [
      '.......abB........', '......aabbBB......', '......abbbBB......', '......bbbbBD......', '.......bbBD.......',
      '..abbbbbbbbbbBBD..', '.abbbbbbbbbbbbBBD.', 'abbbbbbbbbbbbbbBDD', '.bbbbbbbbbbbbbBBD.', '.....bbbbbBD......',
      '.....bbbbbBD......', '....bbbbbbbBBD....', '...bbbbbbbbbBBD...', '..bbbbbbbbbbbBBD..', '..bbbbbb..bbbBBD..',
      '.bbbbbb....bbbBBD.', '.BBBBBD....BBBBDD.',
    ],
    sobre: ['..................', '...............2..', '..............212.', '...............2..'],
  },
  cadeira: {
    base: [
      '......rrrrrrrrrr......', '....qrrrrrrrrrrrrR....', '...qrrrrrrrrrrrrrRR...', '...qrrrr122223rrrRR...', '...qrrrr343435rrrRR...',
      '...qrrrr455555rrrRR...', '...qrrRrrrRrrrRrrRR...', '...qrrerrrerrrerrRR...', 'mnNqrrRrrrRrrrRrrRRnNM', 'nnNqrrrrrrrrrrrrrRRnNM',
      'nnNqqqqqqqqqqqqqqqRnNM', 'nnNrrrrrrrrrrrrrrrRnNM', 'NNNRRRRRRRRRRRRRRRRNNM', 'NNMeeeeeeeeeeeeeeeeNMM', '.nN................nN.',
      '.nN................nN.', '.MM................MM.',
    ],
  },
  ecletico: {
    base: [
      '............swwws.....', '............wkwwS.....', '............wwkwS.....', '............wwwkS.....', '............SSSSd.....',
      '...qqqqqqqqqqqqqqqR...', '...rrrrrrrrrrrrrrRR...', '...rr2222rrrrrrrrRR...', '...rrrrrrrrrrrrrrRR...', '...RRRRRRRRRRRRRRee...',
      '.aaaaaaaaaaaaaaaaaaaB.', '.bbbbbbbbbbbbbbbbbbBB.', '.bbwwwwwwbbbbbbbbbbBB.', '.bbbbbbbbbbbbbbbbbbBB.', '.DDDDDDDDDDDDDDDDDDEE.',
      'hhhhhhhhhhhhhhhhhhhhhG', 'ggggggggggggggggggggGG', 'gggggggggggg2222ggggGG', 'ggggggggggggggggggggGG', 'HHHHHHHHHHHHHHHHHHHHHH',
    ],
  },
  embalado: {
    base: [
      '........F.........', '........FF........', '.......FfF........', '.......FffF....F..', '......FfffF...FF..',
      '......FffyfF..FfF.', '.....FffyyfF.FffF.', '.....FfyyyffFfffF.', '....FfyyyyyffffF..', '..F.Ffyy11yyyffF..',
      '.FfFfyy111yyyfffF.', '.FffFyy1111yyyffF.', 'Fffffyy1111yyyyffF', 'Fffffyy11111yyyffF', 'FFfffffyyyyyyfffFF',
      '.FFfffffffffffffF.', '..ZFFffffffffFFZ..', '....ZZFFFFFFZZ....', '......ZZZZZZ......',
    ],
  },
  atropelo: {
    base: [
      '.........12223..', '........12233...', '.......12233....', '......12233.....', '.....12233......',
      '....12233.......', '...122333333344.', '...4444443334...', '........12234...', '.......1234.....',
      '......1234......', '.....1234.......', '....123.........', '...124..........', '..13............',
      '..3.............',
    ],
    sobre: [
      '................', '................', '.2..............', '...............2', '..............2.',
      '................', '................', '................', '................', '................',
      '..............2.', '...............2',
    ],
  },
  trave: {
    base: [
      '......................', '......................', 'wwwwwwwwwwwwws........', 'ssssssssssssSS........', '............wS........',
      '............wS........', '............wS........', '............wS........', '............wS........', '............wSwwws....',
      '............wwkkwws...', '...........wwwkkwwsS..', '...........wwwwwwkkS..', '...........kwwwwwkkS..', '...........kkwwwwwsS..',
      '............swwsSSS...', '............wSSSSS....', '............wS........', 'GgGGgGGGgGGgGGGgGGgGGG', 'HHHHHHHHHHHHHHHHHHHHHH',
    ],
    sobre: [
      '......................', '..................2...', '......................', '......................', 'S.S.S.S.S.S...........',
      '.S.S.S.S.S.S......2...', 'S.S.S.S.S.S.........2.', '.S.S.S.S.S.S....2.....', 'S.S.S.S.S.S......1....', '.S.S.S.S.S.S......2...',
      'S.S.S.S.S.S...........', '.S.S.S.S.S............', 'S.S.S.S.S.S...........', '.S.S.S.S.S............', 'S.S.S.S.S.S...........',
      '.S.S.S.S.S.S..........', 'S.S.S.S.S.S...........', '.S.S.S.S.S.S..........',
    ],
  },
  lanterna: {
    base: [
      '....dSSSSSSd....', '...d........d...', '...d..ssss..d...', '....swwssssS....', '..swwsssssssSd..',
      '..SSSSSSSSSSdx..', '...d22111122x...', '...d21yffy12x...', '...d21yFFy12x...', '...d221ff122x...',
      '...d22211222x...', '...d33333333x...', '..swwsssssssSd..', '..SSSSSSSSSSdx..', '...xxxxxxxxxx...',
    ],
    sobre: [
      '................', '................', '................', '................', '................',
      '................', '.2............2.', '................', '12............21', '................',
      '.2............2.',
    ],
  },
  mesa: {
    base: [
      '.............qR.......', '.............rR.......', '...swwS.....qrrrrR....', '...wkwS......qrrR.....', '...wwkS......rrrR.....',
      '...SSSd.....qr..rR....', '...nnngGgGgGgGgGnnn...', '..nnnnGgGgGgGgGgnnnN..', '.nnnnngGgGgGgGgGnnnnN.', 'mmmmmmmmmmmmmmmmmmmmmn',
      'NNNNNNNNNNNNNNNNNNNNNM', 'MMMMMMMMMMMMMMMMMMMMMM', '.nN..M..........M..nN.', '.nN..M..........M..nN.', '.nN................nN.',
      '.nN................nN.', '.MM................MM.',
    ],
  },
  podio: {
    base: [
      '...........2..........', '..........212.........', '........2211122.......', '.........21112........', '........212.212.......',
      '......................', '.......12222223.......', '.......33333334.......', '.......33334334.......', '.......33344334.......',
      'wwwwwww33334334.......', 'sssssSd33334334.......', 'ssddsSd33344434.......', 'ssssdSd33333334mmmmmmm', 'sssdsSd33333334nnnnnnN',
      'ssdssSd33333334nnMMnnN', 'ssdddSd33333334nnnnMnN', 'sssssSd33333334nnnMMnN', 'sssssSd33333334nnnnMnN', 'sssssSd33333334nnMMnnN',
      'SSSSSdd44444445NNNNNNM',
    ],
  },
  coroa: {
    base: [
      '.12.......12.......12.', '.23.......23.......23.', '.223.....2223.....223.', '.2233...222233...2233.', '.22333.22223333.22233.',
      '.22223322222333222233.', '.22222222222222222333.', '2111111111111111111134', '2333qr3333ab3333qr3344', '2333rR3333bB3333rR3344',
      '2333333333333333333344', '4444444444444444444445',
    ],
  },
};

const LADO_DO_ICONE = 26;

const CORES_DA_FAIXA = {
  ouro: { claro: '#fff0a8', meio: '#f2c14e', escuro: '#c48a1c', pontaClara: '#e8b447', ponta: '#d69a2a', pontaEscura: '#9a6a12', dobra: '#6b4608' },
  prata: { claro: '#ffffff', meio: '#c9cde2', escuro: '#8d93b5', pontaClara: '#b9bed6', ponta: '#a3a9c8', pontaEscura: '#6f7596', dobra: '#4a4f6e' },
  bronze: { claro: '#f3b67a', meio: '#d0823f', escuro: '#9a5423', pontaClara: '#c47a40', ponta: '#b0662f', pontaEscura: '#7a3f18', dobra: '#532808' },
  unico: { claro: '#c9cff5', meio: '#7b86d6', escuro: '#4a539e', pontaClara: '#6a75c4', ponta: '#5e68b5', pontaEscura: '#3d4588', dobra: '#2a2f63' },
  platina: { claro: '#f2fdff', meio: '#a6e3ea', escuro: '#5aa7b5', pontaClara: '#93d3dc', ponta: '#7cc0cb', pontaEscura: '#4a8a96', dobra: '#2e5e68' },
  lendario: { claro: '#e8ccff', meio: '#a45ee0', escuro: '#6a2fa6', pontaClara: '#9450d0', ponta: '#8243bd', pontaEscura: '#57248c', dobra: '#3a145e' },
};

const CASAS_DA_NOTA = 3;
const FRACAO_DA_FALTA = 0.5;
const formatoNota = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: CASAS_DA_NOTA, maximumFractionDigits: CASAS_DA_NOTA });
const formatoPlacar = new Intl.NumberFormat('pt-BR');

const app = initializeApp(FIREBASE);
const auth = getAuth(app);
// Sem cópia do banco no aparelho: uma cópia guardada por versões antigas deixava o site parado em "Abrindo o ginásio…".
const banco = initializeFirestore(app, { localCache: memoryLocalCache() });

let conta = null;
let lidos = {};
let fotoCompletada = false;
let escutaDoAcesso = null;
let escutasDosDados = [];
let estado = null;
let estadoEmEspera = null;
let telaVisivel = '';
let partidaAberta = '';
let jogoEscolhido = '';
let selecao = null;
let conviteDeFraseFeito = false;
let mesDoCampeaoAberto = '';
let carregamentoKatex = null;
let titulosCalculados = { estado: null, valor: null };
const imagensDosIcones = new Map();
const pontasDaFaixa = new Map();
const tocadores = {};
let somLigado = lerPreferenciaDeSom();

function lerPreferenciaDeSom() {
  try {
    return localStorage.getItem(CHAVE_SOM) !== 'desligado';
  } catch {
    return true;
  }
}

function alternarSom() {
  somLigado = !somLigado;
  try {
    localStorage.setItem(CHAVE_SOM, somLigado ? 'ligado' : 'desligado');
  } catch {}
  mostrarItemDeSom();
  tocar('escolher');
}

function mostrarItemDeSom() {
  document.querySelector('[data-item="som"]').textContent = `Som: ${somLigado ? 'ligado' : 'desligado'}`;
}

function tocar(nome) {
  if (!somLigado) return;
  try {
    tocadores[nome] ??= new Audio(SONS[nome]);
    tocadores[nome].currentTime = 0;
    tocadores[nome].play().catch(() => {});
  } catch {}
}

function colocacoes(valores, menorVence) {
  return valores.map(v => 1 + valores.filter(outro => (menorVence ? outro < v : outro > v)).length);
}

function notasDaPartida({ resultados, menorVence, semPlacar }) {
  const nomes = Object.keys(resultados);
  const valores = Object.values(resultados);
  const n = nomes.length;
  const lugares = semPlacar ? valores : colocacoes(valores, menorVence);
  const soColocacao = semPlacar || valores.every(v => v === valores[0]);
  const media = valores.reduce((a, b) => a + b, 0) / n;

  return nomes.map((nome, i) => {
    const colocacao = (n - lugares[i] + 1) / n;
    if (soColocacao) return [nome, colocacao];
    const placar = menorVence ? media / (2 * valores[i]) : valores[i] / (2 * media);
    return [nome, (colocacao + Math.min(1, placar)) / 2];
  });
}

function rankingDoMes(jogadores, partidas) {
  const acumulado = new Map(jogadores.map(id => [id, { soma: 0, faltas: 0, partidas: 0 }]));
  for (const partida of partidas) {
    const notas = new Map(notasDaPartida(partida));
    const notaDaFalta = Math.min(...notas.values()) * FRACAO_DA_FALTA;
    for (const [id, jogador] of acumulado) {
      if (notas.has(id)) {
        jogador.soma += notas.get(id);
        jogador.partidas++;
      } else {
        jogador.faltas += notaDaFalta;
      }
    }
  }

  const total = partidas.length;
  const linhas = jogadores
    .map(id => {
      const { soma, faltas, partidas: jogadas } = acumulado.get(id);
      return { id, nota: jogadas ? (soma + faltas) / total : 0, partidas: jogadas };
    })
    .sort((a, b) => b.nota - a.nota);

  const exibida = nota => nota.toFixed(CASAS_DA_NOTA);
  linhas.forEach((linha, i) => {
    const empatado = i > 0 && exibida(linhas[i - 1].nota) === exibida(linha.nota);
    linha.posicao = empatado ? linhas[i - 1].posicao : i + 1;
  });
  return { linhas, total };
}

function jogoDe(partida) {
  return estado.jogos.find(j => j.id === partida.jogo) || { nome: 'Jogo removido', menorVence: false, semPlacar: false };
}

function jogador(id) {
  return estado.jogadores.find(j => j.id === id);
}

function partidaParaFormula(partida) {
  const { menorVence, semPlacar } = jogoDe(partida);
  return { menorVence, semPlacar, resultados: Object.fromEntries(partida.placares.map(s => [s.jogador, s.valor])) };
}

function lugaresDaPartida(partida) {
  const { menorVence, semPlacar } = jogoDe(partida);
  const valores = partida.placares.map(s => s.valor);
  const lugares = semPlacar ? valores : colocacoes(valores, menorVence);
  return new Map(partida.placares.map((s, i) => [s.jogador, lugares[i]]));
}

function rankingDe(mes) {
  const fechadas = estado.partidas.filter(p => p.mes === mes && p.estado === 'fechada');
  return rankingDoMes(estado.jogadores.map(j => j.id), fechadas.map(partidaParaFormula));
}

function mesesFechados() {
  const meses = estado.partidas.filter(p => p.estado === 'fechada' && p.mes < estado.mesAtual).map(p => p.mes);
  return [...new Set(meses)].sort().reverse();
}

function campeoesDe(mes) {
  return rankingDe(mes).linhas.filter(l => l.posicao === 1 && l.nota > 0);
}

function conquistas() {
  const porJogador = new Map();
  for (const mes of mesesFechados()) {
    for (const { id } of campeoesDe(mes)) {
      if (!porJogador.has(id)) porJogador.set(id, []);
      porJogador.get(id).push(mes);
    }
  }
  return porJogador;
}

function vezesPorInsignia(meses = []) {
  const vezes = Array(12).fill(0);
  for (const mes of meses) vezes[indiceDoMes(mes)]++;
  return vezes;
}

function indiceDoMes(mes) {
  return Number(mes.slice(5, 7)) - 1;
}

function nomeDoMes(mes) {
  return `${MESES[indiceDoMes(mes)]} de ${mes.slice(0, 4)}`;
}

function tituloDeMestre(jogo) {
  return {
    id: `mestre:${jogo.id}`, nome: `Mestre de ${jogo.nome}`, jogo, metas: METAS_DE_MESTRE,
    medida: `Vitórias em ${jogo.nome}.`, unidade: ['vitória', 'vitórias'],
  };
}

function calcularTitulos() {
  const catalogo = [...TITULOS, ...estado.jogos.map(tituloDeMestre)];
  const metas = new Map(catalogo.map(t => [t.id, t.metas]));
  const porJogador = new Map();
  const marcar = (id, titulo, valor, mes) => {
    if (!metas.has(titulo)) return;
    if (!porJogador.has(id)) porJogador.set(id, new Map());
    const registros = porJogador.get(id);
    const registro = registros.get(titulo) || { atual: 0, niveis: [] };
    registro.atual = Math.max(registro.atual, valor);
    const degraus = metas.get(titulo);
    while (registro.niveis.length < degraus.length && registro.atual >= degraus[registro.niveis.length]) registro.niveis.push(mes);
    registros.set(titulo, registro);
  };

  const contagens = new Map();
  const contagemDe = id => {
    if (!contagens.has(id)) {
      contagens.set(id, {
        partidas: 0, jogos: new Set(), seguidas: 0, vitorias: new Map(), atropelos: 0, ultimo: 0, trave: 0, abertas: 0, campeao: 0, podio: 0,
      });
    }
    return contagens.get(id);
  };

  const fechadas = estado.partidas
    .filter(p => p.estado === 'fechada')
    .sort((a, b) => a.mes.localeCompare(b.mes) || a.abertaEm - b.abertaEm || a.id.localeCompare(b.id));
  for (const partida of fechadas) {
    const { mes } = partida;
    const jogo = jogoDe(partida);
    const lugares = lugaresDaPartida(partida);
    const pior = Math.max(...lugares.values());
    const media = partida.placares.reduce((soma, s) => soma + s.valor, 0) / partida.placares.length;
    const doPrimeiro = partida.placares.find(s => lugares.get(s.jogador) === 1).valor;
    if (jogador(partida.abertaPor)) marcar(partida.abertaPor, 'mesa', ++contagemDe(partida.abertaPor).abertas, mes);

    for (const { jogador: id, valor } of partida.placares) {
      const conta = contagemDe(id);
      const lugar = lugares.get(id);
      const venceu = lugar === 1 && pior > 1;
      marcar(id, 'estreante', ++conta.partidas, mes);
      marcar(id, 'cadeira', conta.partidas, mes);
      conta.jogos.add(partida.jogo);
      marcar(id, 'ecletico', conta.jogos.size, mes);
      conta.seguidas = venceu ? conta.seguidas + 1 : 0;
      marcar(id, 'embalado', conta.seguidas, mes);
      if (venceu) {
        const vitorias = (conta.vitorias.get(partida.jogo) || 0) + 1;
        conta.vitorias.set(partida.jogo, vitorias);
        marcar(id, `mestre:${partida.jogo}`, vitorias, mes);
      }
      if (venceu && !jogo.semPlacar) {
        const folga = jogo.menorVence ? (valor > 0 ? media / valor : Infinity) : valor / media;
        if (folga >= FOLGA_DO_ATROPELO) marcar(id, 'atropelo', ++conta.atropelos, mes);
      }
      if (lugar === pior && pior > 1) marcar(id, 'lanterna', ++conta.ultimo, mes);
      if (!jogo.semPlacar && lugar === 2 && Math.abs(valor - doPrimeiro) <= 1) marcar(id, 'trave', ++conta.trave, mes);
    }
  }

  for (const mes of [...mesesFechados()].reverse()) {
    for (const linha of rankingDe(mes).linhas) {
      if (linha.nota <= 0) continue;
      const conta = contagemDe(linha.id);
      if (linha.posicao === 1) marcar(linha.id, 'campeao', ++conta.campeao, mes);
      if (linha.posicao <= 3) marcar(linha.id, 'podio', ++conta.podio, mes);
    }
  }

  return { catalogo, porId: new Map(catalogo.map(t => [t.id, t])), porJogador };
}

function titulosDoGinasio() {
  if (titulosCalculados.estado !== estado) titulosCalculados = { estado, valor: calcularTitulos() };
  return titulosCalculados.valor;
}

function nivelInicial(titulo) {
  return titulo.metas.length > 1 ? NIVEIS[0] : 'unico';
}

function situacaoNoTitulo(titulo, registro = { atual: 0, niveis: [] }) {
  const alcancados = registro.niveis.length;
  return {
    titulo,
    atual: registro.atual,
    alcancados,
    nivel: alcancados > 1 ? NIVEIS[alcancados - 1] : nivelInicial(titulo),
    proxima: titulo.metas[alcancados] ?? null,
    proximoNivel: NIVEIS[alcancados],
    desde: registro.niveis[0] || '',
    subiuEm: registro.niveis[alcancados - 1] || '',
    chave: `${titulo.id}:${alcancados}`,
  };
}

function situacaoDe(id, tituloId) {
  const { porId, porJogador } = titulosDoGinasio();
  return situacaoNoTitulo(porId.get(tituloId), porJogador.get(id)?.get(tituloId));
}

function maisAlto(a, b) {
  return b.alcancados - a.alcancados || b.subiuEm.localeCompare(a.subiuEm);
}

function titulosGanhos(id) {
  return titulosDoGinasio().catalogo
    .map(t => situacaoDe(id, t.id))
    .filter(s => s.alcancados)
    .sort(maisAlto);
}

function quantosTem({ titulo, alcancados }) {
  return estado.jogadores.filter(j => situacaoDe(j.id, titulo.id).alcancados >= alcancados).length;
}

function tituloAutomatico(id) {
  return titulosGanhos(id)
    .filter(s => !s.titulo.soPorEscolha)
    .sort((a, b) => quantosTem(a) - quantosTem(b) || maisAlto(a, b))[0] || null;
}

function tituloExibido(alguem) {
  if (!alguem || alguem.titulo === 'nenhum') return null;
  return titulosGanhos(alguem.id).find(s => s.titulo.id === alguem.titulo) || tituloAutomatico(alguem.id);
}

function quantidade(numero, [um, varios]) {
  return `${numero} ${numero === 1 ? um : varios}`;
}

function textoDoProgresso(situacao) {
  const { titulo, atual, proxima, proximoNivel, desde } = situacao;
  if (titulo.textoDoProgresso) return titulo.textoDoProgresso(situacao);
  if (proxima === null) return titulo.metas.length > 1 ? `Nível máximo: ${quantidade(atual, titulo.unidade)}` : `Desde ${nomeDoMes(desde)}`;
  return `${Math.min(atual, proxima)} de ${quantidade(proxima, titulo.unidade)} para ${NOME_DO_NIVEL[proximoNivel]}`;
}

// A gravação no servidor demora a voltar; sem esta lista o mesmo aviso abriria de novo nesse meio-tempo.
const vistosNestaSessao = new Set();

function avisosVistos() {
  return [...new Set([...estado.eu.vistos, ...vistosNestaSessao])];
}

function marcarComoVisto(chaves) {
  const novas = chaves.filter(c => !estado.eu.vistos.includes(c));
  novas.forEach(c => vistosNestaSessao.add(c));
  if (novas.length) updateDoc(doc(banco, 'jogadores', estado.eu.id), { vistos: arrayUnion(...novas) }).catch(() => {});
}

function titulosNovos() {
  const vistos = avisosVistos();
  return titulosGanhos(estado.eu.id)
    .filter(s => !vistos.includes(s.chave))
    .map(s => {
      const prefixo = `${s.titulo.id}:`;
      const antes = Math.max(0, ...vistos.filter(c => c.startsWith(prefixo)).map(c => Number(c.slice(prefixo.length)) || 0));
      return { ...s, antes: Math.min(antes, s.alcancados - 1) };
    });
}

const formatoData = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function dataCurta(momento) {
  return formatoData.format(momento).replace(',', '');
}

function mesDeHoje() {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${partes.find(p => p.type === 'year').value}-${partes.find(p => p.type === 'month').value}`;
}

function textoFechamento(mesAtual, hoje = new Date()) {
  const [ano, mes] = mesAtual.split('-').map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const faltam = ultimoDia - hoje.getDate();
  if (faltam <= 0) return 'Fecha hoje à meia-noite';
  if (faltam === 1) return `Fecha amanhã, dia ${ultimoDia}`;
  return `Fecha em ${faltam} dias, dia ${ultimoDia}`;
}

function criar(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function avatarPadrao(apelido) {
  let semente = 0;
  for (const letra of apelido) semente = (semente * 31 + letra.charCodeAt(0)) >>> 0;
  const cores = ['#d9604a', '#4a86d9', '#3aa865', '#a95fd0', '#d99a33', '#3a9fa0'];
  const cor = cores[(semente >>> 16) % cores.length];

  let pixels = '';
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      if (!((semente >>> (y * 3 + x)) & 1)) continue;
      pixels += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
      if (x < 2) pixels += `<rect x="${4 - x}" y="${y}" width="1" height="1"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 7 7" shape-rendering="crispEdges" fill="${cor}">${pixels}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const MEEPLE = ['..###..', '..###..', '#######', '.#####.', '..###..', '.##.##.', '.##.##.'];

function capaPadrao(nome) {
  let semente = 0;
  for (const letra of nome) semente = (semente * 31 + letra.charCodeAt(0)) >>> 0;
  const cores = ['#d9604a', '#4a86d9', '#3aa865', '#a95fd0', '#d99a33', '#3a9fa0'];
  let pixels = '';
  MEEPLE.forEach((linha, y) => [...linha].forEach((ponto, x) => {
    if (ponto === '#') pixels += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 11 11" shape-rendering="crispEdges"><rect x="-2" y="-2" width="11" height="11" fill="#e2dac0"/><g fill="${cores[semente % cores.length]}">${pixels}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function imagemDaCapa(jogo, classe = 'capa') {
  const imagem = criar('img', classe);
  imagem.alt = '';
  imagem.referrerPolicy = 'no-referrer';
  mostrarCapa(imagem, jogo);
  return imagem;
}

function mostrarCapa(imagem, jogo) {
  imagem.onerror = () => {
    imagem.onerror = null;
    imagem.src = capaPadrao(jogo.nome);
  };
  imagem.src = jogo.capa || capaPadrao(jogo.nome);
}

function fotoDe(alguem) {
  return alguem?.foto || avatarPadrao(alguem?.apelido || '?');
}

function mostrarFoto(imagem, alguem) {
  imagem.onerror = () => {
    imagem.onerror = null;
    imagem.src = avatarPadrao(alguem?.apelido || '?');
  };
  imagem.src = fotoDe(alguem);
}

function imagemDe(alguem, classe) {
  const imagem = criar('img', classe);
  imagem.alt = '';
  imagem.referrerPolicy = 'no-referrer';
  mostrarFoto(imagem, alguem);
  return imagem;
}

function desenhoDaInsignia(indice, vezes, grande = false) {
  const { imagem } = INSIGNIAS[indice];
  const desenho = criar('span', `insignia${vezes ? ' ganha' : ''}${grande ? ' grande' : ''}${imagem ? ' com-imagem' : ''}`);
  if (imagem) {
    const figura = criar('img');
    figura.alt = '';
    figura.src = imagem;
    desenho.append(figura);
    desenho.style.setProperty('--imagem', `url(${imagem})`);
    if (grande) desenho.classList.add('brilha');
  } else {
    desenho.append(MESES[indice].slice(0, 3));
  }
  if (vezes > 1) desenho.append(criar('span', 'insignia-vezes', `×${vezes}`));
  return desenho;
}

function svgEmImagem(largura, altura, pontos) {
  let retangulos = '';
  pontos.forEach((linha, y) => {
    for (let x = 0; x < linha.length;) {
      const cor = linha[x];
      let fim = x;
      while (fim < linha.length && linha[fim] === cor) fim++;
      if (cor) retangulos += `<rect x="${x}" y="${y}" width="${fim - x}" height="1" fill="${cor}"/>`;
      x = fim;
    }
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}" shape-rendering="crispEdges">${retangulos}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function imagemDoIcone(nome) {
  if (imagensDosIcones.has(nome)) return imagensDosIcones.get(nome);
  const { base, sobre = [] } = DESENHOS_DOS_TITULOS[nome];
  const lado = LADO_DO_ICONE;
  const ox = Math.floor((lado - base[0].length) / 2);
  const oy = Math.floor((lado - base.length) / 2);
  const grade = Array.from({ length: lado }, () => Array(lado).fill(''));
  const cheio = (x, y) => Boolean(grade[y]?.[x]) && grade[y][x] !== '_';
  base.forEach((linha, y) => [...linha].forEach((ponto, x) => { if (ponto !== '.') grade[y + oy][x + ox] = ponto; }));
  const contorno = [];
  const sombra = [];
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      if (!grade[y][x] && (cheio(x - 1, y) || cheio(x + 1, y) || cheio(x, y - 1) || cheio(x, y + 1))) contorno.push([x, y]);
    }
  }
  contorno.forEach(([x, y]) => { grade[y][x] = 'k'; });
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) if (!grade[y][x] && cheio(x - 1, y - 1)) sombra.push([x, y]);
  }
  sombra.forEach(([x, y]) => { grade[y][x] = '_'; });
  sobre.forEach((linha, y) => [...linha].forEach((ponto, x) => { if (ponto !== '.') grade[y + oy][x + ox] = ponto; }));
  const cores = grade.map(linha => linha.map(p => (p === '_' ? '#0a0a1e59' : CORES_DOS_ICONES[p] || '')));
  imagensDosIcones.set(nome, svgEmImagem(lado, lado, cores));
  return imagensDosIcones.get(nome);
}

function imagemDaPonta(nivel, lado) {
  const chave = `${nivel}-${lado}`;
  if (pontasDaFaixa.has(chave)) return pontasDaFaixa.get(chave);
  const c = CORES_DA_FAIXA[nivel];
  const tinta = CORES_DOS_ICONES.k;
  const LARGURA = 12, ALTURA = 16, INICIO = 7, FAIXA = 13;
  const pontos = Array.from({ length: ALTURA }, (_, y) => Array.from({ length: LARGURA }, (__, x) => {
    if (y < FAIXA && x >= INICIO) {
      if (x === INICIO || y === 0 || y === FAIXA - 1) return tinta;
      if (y === 1) return c.claro;
      if (y === FAIXA - 2) return c.escuro;
      if ((y === 2 || y === FAIXA - 3) && x % 2 === 1) return c.escuro;
      return c.meio;
    }
    if (y >= 3 && x < INICIO) {
      const recorte = Math.max(0, 4 - Math.abs(y - 9));
      if (x < recorte) return '';
      if (x === recorte || y === 3 || y === ALTURA - 1) return tinta;
      if (y === 4) return c.pontaClara;
      if (y === ALTURA - 2) return c.pontaEscura;
      return c.ponta;
    }
    if (y >= FAIXA && x >= INICIO) {
      const limite = ALTURA - 1 - y;
      if (x - INICIO < limite) return c.dobra;
      if (x - INICIO === limite) return tinta;
    }
    return '';
  }));
  if (lado === 'direita') pontos.forEach(linha => linha.reverse());
  pontasDaFaixa.set(chave, svgEmImagem(LARGURA, ALTURA, pontos));
  return pontasDaFaixa.get(chave);
}

function figuraDoTitulo(titulo, classe = '') {
  if (titulo.jogo) return imagemDaCapa(titulo.jogo, `capa-titulo ${classe}`);
  const figura = criar('img', `icone-titulo ${classe}`);
  figura.alt = '';
  figura.src = imagemDoIcone(titulo.desenho);
  return figura;
}

function quadroDoTitulo(situacao, grande = false) {
  const { titulo, nivel, alcancados } = situacao;
  const quadro = criar('span', `quadro-titulo nivel-${nivel}${alcancados ? '' : ' apagado'}${grande ? ' grande' : ''}`);
  quadro.append(figuraDoTitulo(titulo));
  if (titulo.jogo) {
    const coroa = criar('img', 'coroa-mestre');
    coroa.alt = '';
    coroa.src = imagemDoIcone('coroa');
    quadro.append(coroa);
  }
  return quadro;
}

function faixaDoTitulo({ titulo, nivel }, comFigura = true) {
  const faixa = criar('span', `faixa nivel-${nivel}`);
  if (comFigura) faixa.append(figuraDoTitulo(titulo, 'faixa-figura'));
  for (const [classe, lado] of [['faixa-ponta', 'esquerda'], ['faixa-meio', ''], ['faixa-ponta', 'direita']]) {
    if (lado) {
      const ponta = criar('img', classe);
      ponta.alt = '';
      ponta.src = imagemDaPonta(nivel, lado);
      faixa.append(ponta);
    } else {
      faixa.append(criar('span', classe, titulo.nome));
    }
  }
  return faixa;
}

function linhaDoTitulo({ titulo, nivel }) {
  const linha = criar('span', `titulo-linha nivel-${nivel}`);
  linha.append(figuraDoTitulo(titulo), criar('span', 'titulo-linha-nome', titulo.nome));
  return linha;
}

function etiquetaDoNivel(nivel, apagada = false) {
  return criar('span', `etiqueta-nivel nivel-${nivel}${apagada ? ' apagada' : ''}`, NOME_DO_NIVEL[nivel]);
}

function degrausDoTitulo({ titulo, alcancados }) {
  const degraus = criar('span', 'degraus');
  degraus.setAttribute('aria-label', `${alcancados} de ${titulo.metas.length} níveis`);
  degraus.append(...titulo.metas.map((_, i) => criar('span', `degrau nivel-${NIVEIS[i]}${i < alcancados ? ' alcancado' : ''}`)));
  return degraus;
}

function barraDoProgresso(situacao) {
  const { atual, proxima } = situacao;
  const progresso = criar('span', 'progresso');
  if (proxima !== null) {
    const barra = criar('span', 'barra');
    const cheio = criar('span');
    cheio.style.width = `${Math.min(1, atual / proxima) * 100}%`;
    barra.append(cheio);
    progresso.append(barra);
  }
  progresso.append(criar('span', 'detalhe', textoDoProgresso(situacao)));
  return progresso;
}

function cartaoDoTitulo(situacao, { emUso = false, destino = situacao.titulo.id } = {}) {
  const { titulo, nivel, alcancados } = situacao;
  const cartao = criar('button', `cartao-titulo nivel-${nivel}${alcancados ? '' : ' falta'}`);
  cartao.type = 'button';
  const etiquetas = criar('span', 'etiquetas');
  if (titulo.metas.length > 1) etiquetas.append(etiquetaDoNivel(nivel, !alcancados), degrausDoTitulo(situacao));
  if (emUso) etiquetas.append(criar('span', 'etiqueta-escura', 'Em uso'));
  const texto = criar('span', 'cartao-texto');
  texto.append(etiquetas, criar('span', 'cartao-nome', titulo.nome), criar('span', 'cartao-regra', titulo.medida), barraDoProgresso(situacao));
  cartao.append(quadroDoTitulo(situacao), texto);
  cartao.addEventListener('click', () => (destino ? irPara('titulo', destino) : irPara('titulos')));
  return cartao;
}

function limparApelido(texto) {
  return texto.toUpperCase().replace(/[^\p{L}\p{N}]/gu, '').slice(0, 8);
}

function recusa(mensagem) {
  return Object.assign(new Error(mensagem), { codigo: 'recusa' });
}

function novoId(colecao) {
  return doc(collection(banco, colecao)).id;
}

function novoIdDeJogador() {
  return `J${[...crypto.getRandomValues(new Uint8Array(4))].map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

function textoLivre(valor, minimo, maximo, rotulo) {
  const texto = String(valor || '').trim().replace(/\s+/g, ' ');
  if (texto.length < minimo || texto.length > maximo) throw recusa(`${rotulo} tem de ${minimo} a ${maximo} caracteres.`);
  return texto;
}

function linkDeFoto(texto) {
  return /^https:\/\/[^\s"'<>]{4,500}$/.test(texto);
}

function fotoDoGoogle() {
  const foto = auth.currentUser?.photoURL || '';
  return linkDeFoto(foto) ? foto : '';
}

function fotoValida(foto) {
  if (foto === 'google') return fotoDoGoogle();
  if (foto.length <= LIMITE_FOTO && /^data:image\/(jpeg|png|webp);base64,[\w+/=]+$/.test(foto)) return foto;
  if (linkDeFoto(foto)) return foto;
  throw recusa('Foto inválida ou grande demais.');
}

function capaValida(capa) {
  const texto = String(capa).trim();
  if (texto.length <= LIMITE_FOTO && /^data:image\/(jpeg|png|webp);base64,[\w+/=]+$/.test(texto)) return texto;
  if (linkDeFoto(texto)) return texto;
  throw recusa('Foto do jogo inválida. Use uma foto ou um link que abra direto a imagem.');
}

function exigirEmailLivre(endereco) {
  if (lidos.acessos.some(a => a.id === endereco)) throw recusa('Esse e-mail já está liberado.');
  if (lidos.pedidos.some(p => p.id === endereco)) throw recusa('Esse e-mail já pediu entrada. Aprove na lista de pedidos.');
}

function exigirJogadorSemEmail(id) {
  if (!jogador(id) || lidos.acessos.some(a => a.jogador === id)) throw recusa('Esse jogador já tem e-mail.');
}

function partidaAbertaNoMes(id) {
  const partida = estado.partidas.find(p => p.id === id);
  if (!partida || partida.estado !== 'aberta') throw recusa('Essa partida não está mais aberta.');
  return partida;
}

const ACOES = {
  definirPerfil({ apelido, foto }) {
    const { eu } = estado;
    let nome = eu.apelido;
    if (apelido !== undefined) {
      nome = String(apelido).trim().toUpperCase();
      if (!/^[\p{L}\p{N}]{1,8}$/u.test(nome)) throw recusa('O apelido tem de 1 a 8 letras ou números, sem espaço.');
      if (estado.jogadores.some(j => j.id !== eu.id && j.apelido === nome)) throw recusa('Esse apelido já é de outro jogador.');
    }
    const novaFoto = foto === undefined ? eu.foto || fotoDoGoogle() : fotoValida(foto);
    return setDoc(doc(banco, 'jogadores', eu.id), { apelido: nome, foto: novaFoto }, { merge: true });
  },

  definirTitulo({ titulo }) {
    if (titulo && titulo !== 'nenhum' && !titulosGanhos(estado.eu.id).some(s => s.titulo.id === titulo)) throw recusa('Você ainda não ganhou esse título.');
    return updateDoc(doc(banco, 'jogadores', estado.eu.id), { titulo });
  },

  cadastrarJogo({ id, nome, menorVence, semPlacar, capa }) {
    const titulo = textoLivre(nome, 2, 40, 'O nome do jogo');
    if (estado.jogos.some(j => j.nome.toLowerCase() === titulo.toLowerCase())) throw recusa('Esse jogo já está cadastrado.');
    return setDoc(doc(banco, 'jogos', id), {
      nome: titulo, menorVence: Boolean(menorVence && !semPlacar), semPlacar: Boolean(semPlacar), criadoPor: estado.eu.id, criadoEm: serverTimestamp(),
      capa: capa ? capaValida(capa) : '',
    });
  },

  definirCapa({ jogo, capa }) {
    if (!estado.jogos.some(j => j.id === jogo)) throw recusa('Jogo não encontrado.');
    return updateDoc(doc(banco, 'jogos', jogo), { capa: capaValida(capa) });
  },

  abrirPartida({ id, jogo, participantes }) {
    const registro = estado.jogos.find(j => j.id === jogo);
    if (!registro) throw recusa('Jogo não encontrado.');
    const lista = [...new Set(participantes)];
    if (lista.length < 3 || lista.length > 10) throw recusa('Uma partida tem de 3 a 10 jogadores.');
    if (lista.some(j => !jogador(j))) throw recusa('Tem jogador na lista que não está no ranking.');
    const placares = Object.fromEntries(lista.map((j, i) => [j, registro.semPlacar ? i + 1 : null]));
    return setDoc(doc(banco, 'partidas', id), { mes: mesDeHoje(), jogo, abertaPor: estado.eu.id, abertaEm: serverTimestamp(), participantes: lista, placares });
  },

  lancarPlacar({ partida, valor }) {
    const registro = partidaAbertaNoMes(partida);
    if (registro.mes !== mesDeHoje()) throw recusa('Essa partida é de um mês que já fechou e não conta mais.');
    if (!Number.isFinite(valor) || valor < 0 || valor > 1e9) throw recusa('Placar inválido.');
    if (!registro.placares.some(s => s.jogador === estado.eu.id)) throw recusa('Você não está nessa partida.');
    return updateDoc(doc(banco, 'partidas', partida), { [`placares.${estado.eu.id}`]: valor });
  },

  cancelarPartida({ partida }) {
    const registro = partidaAbertaNoMes(partida);
    if (registro.abertaPor !== estado.eu.id && !estado.eu.admin) throw recusa('Só quem abriu a partida pode cancelar.');
    return deleteDoc(doc(banco, 'partidas', partida));
  },

  definirPremio({ mes, texto }) {
    return setDoc(doc(banco, 'premios', mes), { texto: textoLivre(texto, 2, 80, 'O prêmio') });
  },

  liberarEmail({ email, jogador: id }) {
    const endereco = String(email || '').trim().toLowerCase();
    if (!EMAIL_VALIDO.test(endereco)) throw recusa('E-mail inválido.');
    exigirEmailLivre(endereco);
    if (id) exigirJogadorSemEmail(id);
    return setDoc(doc(banco, 'acessos', endereco), { jogador: id || novoIdDeJogador(), admin: false });
  },

  aprovarPedido({ pedido, jogador: id }) {
    if (!lidos.pedidos.some(p => p.id === pedido)) throw recusa('Esse pedido não existe mais.');
    if (id) exigirJogadorSemEmail(id);
    const lote = writeBatch(banco);
    lote.set(doc(banco, 'acessos', pedido), { jogador: id || novoIdDeJogador(), admin: false });
    lote.delete(doc(banco, 'pedidos', pedido));
    return lote.commit();
  },

  recusarPedido({ pedido }) {
    return deleteDoc(doc(banco, 'pedidos', pedido));
  },

  salvarFrase({ mes, texto }) {
    if (!/^\d{4}-\d{2}$/.test(mes) || mes >= mesDeHoje()) throw recusa('Só dá para escrever a frase de um mês que já fechou.');
    return setDoc(doc(banco, 'frases', `${mes}_${estado.eu.id}`), { mes, jogador: estado.eu.id, texto: textoLivre(texto, 2, 120, 'A frase') });
  },
};

function mensagemDeErro(erro) {
  if (erro.codigo === 'recusa') return erro.message;
  if (erro.code === 'permission-denied') return 'O banco recusou essa alteração.';
  return 'Não consegui salvar. Tente de novo.';
}

async function enviar(botao, aviso, acao, valores, somDoSucesso = 'confirmar') {
  const texto = botao.textContent;
  botao.disabled = true;
  botao.textContent = 'Salvando…';
  aviso.textContent = '';
  try {
    await ACOES[acao](valores);
    aplicarEstadoEmEspera();
    tocar(typeof somDoSucesso === 'function' ? somDoSucesso() : somDoSucesso);
    return true;
  } catch (erro) {
    tocar('erro');
    aviso.textContent = mensagemDeErro(erro);
    return false;
  } finally {
    if (botao.textContent === 'Salvando…') {
      botao.textContent = texto;
      botao.disabled = false;
    }
  }
}

function pararDados() {
  escutasDosDados.forEach(parar => parar());
  escutasDosDados = [];
  lidos = {};
}

function pararEscutas() {
  escutaDoAcesso?.();
  escutaDoAcesso = null;
  pararDados();
  conta = null;
  estado = null;
  estadoEmEspera = null;
  vistosNestaSessao.clear();
}

function acompanharConta(usuario) {
  pararEscutas();
  conviteDeFraseFeito = false;
  fotoCompletada = false;
  if (!usuario) {
    mostrarEntrada('Entre com a conta Google que o administrador liberou.', 'google');
    return;
  }
  mostrarEntrada('Abrindo o ginásio…');
  const email = usuario.email.toLowerCase();
  escutaDoAcesso = onSnapshot(doc(banco, 'acessos', email), retrato => {
    if (retrato.metadata.hasPendingWrites) return;
    if (!retrato.exists()) {
      if (retrato.metadata.fromCache) return;
      pararDados();
      conta = null;
      estado = null;
      pedirEntrada(usuario, email);
      return;
    }
    const { jogador: id, admin } = retrato.data();
    if (conta?.id === id && conta?.admin === admin) return;
    conta = { id, admin };
    escutarDados();
  }, falhaDeLeitura);
}

async function pedirEntrada(usuario, email) {
  mostrarEntrada('Abrindo o ginásio…');
  try {
    const pedido = doc(banco, 'pedidos', email);
    if (!(await getDoc(pedido)).exists()) await setDoc(pedido, { nome: (usuario.displayName || '').slice(0, 60), criadoEm: serverTimestamp() });
    if (!conta) mostrarEntrada(AGUARDANDO, 'google');
  } catch {
    if (!conta) mostrarEntrada('Não consegui registrar seu pedido de entrada.', 'tentar');
  }
}

function escutarDados() {
  pararDados();
  const nomes = ['jogadores', 'jogos', 'partidas', 'premios', 'frases', ...(conta.admin ? ['acessos', 'pedidos'] : [])];
  // Nas partidas, escutar a confirmação do servidor: título só é anunciado depois que o placar gravou.
  escutasDosDados = nomes.map(nome => onSnapshot(collection(banco, nome), { includeMetadataChanges: nome === 'partidas' }, retrato => {
    lidos[nome] = retrato.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
    if (nome === 'partidas') lidos.partidasGravando = retrato.metadata.hasPendingWrites;
    if (!nomes.every(n => lidos[n])) return;
    receberEstado(montarEstado());
    completarFoto();
  }, falhaDeLeitura));
}

function falhaDeLeitura() {
  pararEscutas();
  mostrarEntrada('Não consegui abrir os dados do ginásio.', 'tentar');
}

function comoPartida(p) {
  const placares = p.participantes.map(id => ({ jogador: id, valor: p.placares[id] ?? null }));
  return {
    id: p.id, mes: p.mes, jogo: p.jogo, abertaPor: p.abertaPor, abertaEm: p.abertaEm?.toDate?.() || new Date(0),
    estado: placares.some(s => s.valor === null) ? 'aberta' : 'fechada', placares,
  };
}

function montarEstado() {
  const meu = lidos.jogadores.find(j => j.id === conta.id);
  const jogadores = lidos.jogadores.filter(j => j.apelido).map(({ id, apelido, foto, titulo }) => ({ id, apelido, foto, titulo: titulo || '' }));
  const apelidoDe = id => jogadores.find(j => j.id === id)?.apelido || '';
  const comEmail = new Set((lidos.acessos || []).map(a => a.jogador));
  return {
    mesAtual: mesDeHoje(),
    gravando: Boolean(lidos.partidasGravando),
    eu: {
      id: conta.id, apelido: meu?.apelido || '', foto: meu?.foto || '', titulo: meu?.titulo || '', admin: conta.admin,
      vistos: Array.isArray(meu?.vistos) ? meu.vistos : [],
    },
    jogadores,
    jogos: lidos.jogos.map(({ id, nome, menorVence, semPlacar, capa }) => ({ id, nome, menorVence, semPlacar, capa: capa || '' })),
    partidas: lidos.partidas.map(comoPartida).sort((a, b) => a.abertaEm - b.abertaEm),
    premios: Object.fromEntries(lidos.premios.map(p => [p.id, p.texto])),
    frases: lidos.frases.map(({ mes, jogador: id, texto }) => ({ mes, jogador: id, texto })),
    liberados: conta.admin
      ? [
        ...lidos.acessos.map(a => ({ id: a.jogador, email: a.id, apelido: apelidoDe(a.jogador) })),
        ...jogadores.filter(j => !comEmail.has(j.id)).map(j => ({ id: j.id, email: '', apelido: j.apelido })),
      ]
      : [],
    pedidos: conta.admin ? lidos.pedidos.map(p => ({ id: p.id, email: p.id, nome: p.nome })) : [],
  };
}

function completarFoto() {
  const { eu } = estado || {};
  if (fotoCompletada || !eu?.apelido || eu.foto || !fotoDoGoogle()) return;
  fotoCompletada = true;
  setDoc(doc(banco, 'jogadores', eu.id), { apelido: eu.apelido, foto: fotoDoGoogle() }, { merge: true }).catch(() => {});
}

function digitando() {
  return Boolean(document.activeElement?.matches('main input:not([type=checkbox]):not([type=file]), main select'));
}

function receberEstado(novo) {
  if (estado && digitando()) {
    estadoEmEspera = novo;
    return;
  }
  estadoEmEspera = null;
  aplicarEstado(novo);
}

function aplicarEstadoEmEspera() {
  if (!estadoEmEspera) return;
  const novo = estadoEmEspera;
  estadoEmEspera = null;
  aplicarEstado(novo);
}

async function entrarComGoogle() {
  const provedor = new GoogleAuthProvider();
  provedor.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provedor);
  } catch (erro) {
    if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(erro.code)) return;
    document.getElementById('aviso-entrada').textContent = erro.code === 'auth/popup-blocked'
      ? 'O navegador bloqueou a janela do Google. Toque no botão de novo.'
      : 'Não consegui entrar com o Google. Tente de novo.';
  }
}

function mostrarTela(nome) {
  document.querySelectorAll('[data-tela]').forEach(tela => { tela.hidden = tela.dataset.tela !== nome; });
  document.getElementById('abrir-menu').hidden = !TELAS[nome];
  if (nome !== telaVisivel) window.scrollTo(0, 0);
  telaVisivel = nome;
}

function mostrarEntrada(mensagem, saida = null) {
  document.getElementById('aviso-entrada').textContent = mensagem;
  document.getElementById('botao-google').hidden = saida !== 'google';
  document.getElementById('tentar-de-novo').hidden = saida !== 'tentar';
  mostrarTela('entrada');
}

function aplicarEstado(novo) {
  estado = novo;
  if (!estado.eu.apelido) {
    mostrarTela('apelido');
    return;
  }
  document.querySelectorAll('[data-mes]').forEach(el => { el.textContent = MESES[indiceDoMes(estado.mesAtual)]; });
  document.querySelector('[data-item="perfil"]').textContent = estado.eu.apelido;
  document.querySelector('[data-item="administracao"]').hidden = !estado.eu.admin;
  if (convidarParaFrase()) return;
  renderizar();
}

function convidarParaFrase() {
  if (conviteDeFraseFeito) return false;
  conviteDeFraseFeito = true;
  const [ultimo] = mesesFechados();
  if (!ultimo) return false;
  const campeoes = campeoesDe(ultimo);
  if (!campeoes.length) return false;

  const chave = `celebracao:${ultimo}`;
  if (avisosVistos().includes(chave)) {
    const euVenci = campeoes.some(l => l.id === estado.eu.id);
    const escreveu = estado.frases.some(f => f.mes === ultimo && f.jogador === estado.eu.id);
    if (euVenci && !escreveu) { tocar('campeao'); irPara('campeoes'); return true; }
    return false;
  }
  marcarComoVisto([chave]);
  tocar('campeao');
  mostrarCelebracao(ultimo, campeoes);
  return true;
}

function desenharPodio(podio, linhas) {
  podio.querySelectorAll('.podio-lugar').forEach(lugar => {
    const noDegrau = linhas.filter(l => l.nota > 0 && l.posicao === Number(lugar.dataset.degrau));
    lugar.replaceChildren(...noDegrau.map(linha => {
      const alguem = jogador(linha.id);
      const pessoa = criar('button', 'podio-pessoa');
      pessoa.type = 'button';
      pessoa.append(criar('span', '', alguem.apelido), criar('span', 'detalhe', formatoNota.format(linha.nota)), imagemDe(alguem, 'foto'));
      pessoa.addEventListener('click', () => irPara('perfil', linha.id));
      return pessoa;
    }));
  });
}

function mostrarCelebracao(mes, campeoes) {
  const indice = indiceDoMes(mes);
  const insignia = INSIGNIAS[indice];
  const euVenci = campeoes.some(l => l.id === estado.eu.id);
  const escreveu = estado.frases.some(f => f.mes === mes && f.jogador === estado.eu.id);
  const varios = campeoes.length > 1;
  const nomes = euVenci && !varios ? 'Você' : campeoes.map(l => jogador(l.id)?.apelido || '?').join(' e ');
  const premio = estado.premios[mes];

  const overlay = document.getElementById('celebracao');
  const botao = document.getElementById('celebracao-fechar');

  overlay.hidden = false;
  renderizar();
  document.getElementById('celebracao-titulo').textContent = `${varios ? 'Campeões' : 'Campeão'} de ${MESES[indice]}`;
  desenharPodio(document.getElementById('celebracao-podio'), rankingDe(mes).linhas);
  document.getElementById('celebracao-frases').replaceChildren(...campeoes.flatMap(linha => {
    const frase = estado.frases.find(f => f.mes === mes && f.jogador === linha.id);
    if (!frase) return [];
    const balao = criar('div', 'balao balao-centro');
    if (varios) balao.append(criar('span', 'detalhe', jogador(linha.id)?.apelido || '?'));
    balao.append(criar('p', 'frase', frase.texto));
    return [balao];
  }));
  const insigniaDaEntrega = desenhoDaInsignia(indice, 1);
  insigniaDaEntrega.classList.add('brilha');
  insigniaDaEntrega.style.setProperty('--atraso', '0.8s');
  document.getElementById('celebracao-insignia').replaceChildren(insigniaDaEntrega);
  let entrega = `${nomes} ${varios ? 'levam' : 'leva'} a ${insignia.nome}.`;
  if (premio) entrega = varios ? `${nomes} dividem: ${premio}. Cada um leva a ${insignia.nome}.` : `${nomes} leva: ${premio} e ${insignia.nome}.`;
  document.getElementById('celebracao-subtitulo').textContent = entrega;
  botao.textContent = euVenci && !escreveu ? 'Escrever minha frase' : 'Continuar';

  const fechar = () => {
    overlay.hidden = true;
    if (euVenci && !escreveu) irPara('campeoes');
    else renderizar();
  };
  botao.onclick = fechar;
  overlay.onclick = e => { if (e.target === overlay) fechar(); };
  overlay.hidden = false;
}

function linhaDoRanking(id, posicao, principal, secundario, nota = null) {
  const alguem = jogador(id);
  const item = document.getElementById('modelo-linha').content.firstElementChild.cloneNode(true);
  const botao = item.querySelector('.linha');
  const barra = item.querySelector('.barra');
  botao.dataset.posicao = posicao;
  if (id === estado.eu.id) botao.dataset.eu = '';
  botao.addEventListener('click', () => irPara('perfil', id));
  item.querySelector('.posicao').textContent = `${posicao}º`;
  mostrarFoto(item.querySelector('.foto'), alguem);
  item.querySelector('.apelido').textContent = alguem.apelido;
  const titulo = tituloExibido(alguem);
  item.querySelector('.nota').after(titulo ? linhaDoTitulo(titulo) : criar('span', 'titulo-linha'));
  item.querySelector('.nota').replaceChildren(principal);
  item.querySelector('.partidas').textContent = secundario;
  if (nota === null) {
    barra.remove();
  } else {
    barra.setAttribute('aria-valuenow', nota.toFixed(CASAS_DA_NOTA));
    barra.firstElementChild.style.width = `${nota * 100}%`;
  }
  return item;
}

function linhaDoMes(linha, total) {
  return linhaDoRanking(linha.id, linha.posicao, formatoNota.format(linha.nota), `${linha.partidas} de ${total} partidas`, linha.nota);
}

function rankingGeral() {
  const contagem = new Map(estado.jogadores.map(j => [j.id, { insignias: 0, podios: 0 }]));
  for (const mes of mesesFechados()) {
    for (const linha of rankingDe(mes).linhas) {
      if (linha.nota <= 0) continue;
      const jogadorDoMes = contagem.get(linha.id);
      if (linha.posicao === 1) jogadorDoMes.insignias++;
      if (linha.posicao <= 3) jogadorDoMes.podios++;
    }
  }
  const linhas = [...contagem]
    .map(([id, total]) => ({ id, ...total }))
    .filter(l => l.podios > 0)
    .sort((a, b) => b.insignias - a.insignias || b.podios - a.podios);
  linhas.forEach((linha, i) => {
    const anterior = linhas[i - 1];
    const empatado = anterior && anterior.insignias === linha.insignias && anterior.podios === linha.podios;
    linha.posicao = empatado ? anterior.posicao : i + 1;
  });
  return linhas;
}

function mostrarInicio() {
  const { mesAtual, eu, premios, partidas } = estado;
  const indice = indiceDoMes(mesAtual);
  document.getElementById('premio-texto').textContent = premios[mesAtual] || 'O administrador ainda não definiu.';
  document.getElementById('premio-insignia').textContent = INSIGNIAS[indice].nome;
  document.getElementById('premio-fecha').textContent = textoFechamento(mesAtual);
  document.getElementById('premio-insignia-imagem').replaceChildren(desenhoDaInsignia(indice, 1, true));
  document.getElementById('premio-insignia-imagem').onclick = () => irPara('insignia', indice + 1);
  document.getElementById('premio-insignia').onclick = () => irPara('insignia', indice + 1);

  const doMes = partidas.filter(p => p.mes === mesAtual);
  const pedidos = estado.pedidos || [];
  document.getElementById('aviso-pedidos').hidden = !pedidos.length;
  document.getElementById('aviso-pedidos-texto').textContent = pedidos.length === 1
    ? '1 pedido de entrada esperando a sua aprovação.'
    : `${pedidos.length} pedidos de entrada esperando a sua aprovação.`;

  const pendentes = doMes.filter(p => p.estado === 'aberta' && p.placares.some(s => s.jogador === eu.id && s.valor === null));
  document.getElementById('pendente').hidden = !pendentes.length;
  if (pendentes.length) {
    const [primeira] = pendentes;
    const lancados = primeira.placares.filter(s => s.valor !== null).length;
    const outras = pendentes.length > 1 ? `. Mais ${pendentes.length - 1} esperando o seu placar` : '';
    document.getElementById('pendente-autor').textContent = jogador(primeira.abertaPor)?.apelido || 'Alguém';
    document.getElementById('pendente-jogo').textContent = jogoDe(primeira).nome;
    document.getElementById('pendente-progresso').textContent = `${lancados} de ${primeira.placares.length} já lançaram${outras}`;
    document.getElementById('pendente-botao').onclick = () => irPara('partida', primeira.id);
  }

  const { linhas, total } = rankingDe(mesAtual);
  document.getElementById('podio-vazio').hidden = total > 0;
  desenharPodio(document.getElementById('podio-do-mes'), linhas);

  const geral = rankingGeral();
  const donos = conquistas();
  const proximo = MESES[(indice + 1) % 12];
  document.getElementById('ranking-geral').replaceChildren(...(geral.length
    ? geral.map(l => linhaDoRanking(l.id, l.posicao, insigniasEmMiniatura(donos.get(l.id), l.insignias), ''))
    : [criar('li', 'detalhe', `Nenhum mês fechou ainda. O primeiro entra aqui em 1º de ${proximo}.`)]));
}

const POUCO_MOVIMENTO = matchMedia('(prefers-reduced-motion: reduce)');
// Um toque que já vinha a caminho antes do aviso surgir não pode fechá-lo sem a pessoa ter visto.
const ESPERA_DOS_BOTOES = 1300;
let relogioDaConquista = null;

function verificarTitulosNovos() {
  if (!estado?.eu.apelido || estado.gravando) return;
  if (!document.getElementById('celebracao').hidden || !document.getElementById('conquista').hidden) return;
  const novos = titulosNovos();
  if (!novos.length) return;
  mostrarConquista(novos[0]);
}

function imagemDoBrilho() {
  const linhas = ['...w...', '...w...', '..wyw..', 'wwy3yww', '..wyw..', '...w...', '...w...'];
  const cor = { w: '#ffffff', y: CORES_DOS_ICONES[2], 3: CORES_DOS_ICONES[3] };
  if (!imagensDosIcones.has('brilho')) imagensDosIcones.set('brilho', svgEmImagem(7, 7, linhas.map(l => [...l].map(p => cor[p] || ''))));
  return imagensDosIcones.get('brilho');
}

function brilhos() {
  const lugares = [[-74, -44], [70, -52], [-86, 22], [84, 16], [-40, 62], [46, 66]];
  return lugares.map(([x, y], i) => {
    const brilho = criar('img', 'brilho-pixel');
    brilho.alt = '';
    brilho.src = imagemDoBrilho();
    brilho.style.cssText = `--x: ${x}px; --y: ${y}px; --atraso: ${180 + i * 140}ms`;
    return brilho;
  });
}

function abrirConquista({ topo, palco, faixa, degraus, texto, detalhe, botaoVer, aoConcluir }) {
  const tela = document.getElementById('conquista');
  document.getElementById('conquista-topo').textContent = topo;
  document.getElementById('conquista-palco').replaceChildren(...palco);
  document.getElementById('conquista-faixa').replaceChildren(...(faixa ? [faixa] : []));
  document.getElementById('conquista-degraus').replaceChildren(...(degraus ? [degraus] : []));
  document.getElementById('conquista-texto').textContent = texto;
  document.getElementById('conquista-detalhe').textContent = detalhe;
  const continuar = document.getElementById('conquista-continuar');
  const ver = document.getElementById('conquista-ver');
  ver.textContent = botaoVer;
  const abertaEm = Date.now();
  const espera = POUCO_MOVIMENTO.matches ? 400 : ESPERA_DOS_BOTOES;
  const concluir = indoVer => {
    if (Date.now() - abertaEm < espera) return;
    tela.hidden = true;
    aoConcluir(indoVer);
    verificarTitulosNovos();
  };
  continuar.onclick = () => concluir(false);
  ver.onclick = () => concluir(true);
  // Forçar o recálculo do layout reinicia as animações quando um aviso vem logo depois do outro.
  const caixa = tela.firstElementChild;
  caixa.classList.remove('animando', 'pronta');
  void caixa.offsetWidth;
  caixa.classList.add('animando');
  clearTimeout(relogioDaConquista);
  relogioDaConquista = setTimeout(() => caixa.classList.add('pronta'), espera);
  tela.hidden = false;
  setTimeout(() => tocar('campeao'), POUCO_MOVIMENTO.matches ? 0 : 380);
}

function mostrarConquista(situacao) {
  const { titulo, nivel, alcancados, antes } = situacao;
  const sobe = antes > 0;
  const quadro = quadroDoTitulo(sobe ? { ...situacao, nivel: NIVEIS[antes - 1] } : situacao, true);
  if (sobe && !POUCO_MOVIMENTO.matches) {
    setTimeout(() => {
      quadro.classList.replace(`nivel-${NIVEIS[antes - 1]}`, `nivel-${nivel}`);
      quadro.classList.add('clarao');
    }, 520);
  } else if (sobe) {
    quadro.classList.replace(`nivel-${NIVEIS[antes - 1]}`, `nivel-${nivel}`);
  }

  let degraus = null;
  if (titulo.metas.length > 1) {
    degraus = degrausDoTitulo(situacao);
    [...degraus.children].forEach((degrau, i) => {
      if (i < antes || i >= alcancados) return;
      degrau.classList.add('acendendo');
      degrau.style.setProperty('--atraso', `${1050 + (i - antes) * 120}ms`);
    });
  }

  const marca = quantidade(titulo.metas[alcancados - 1], titulo.unidade);
  let detalhe = '';
  if (sobe) detalhe = `Agora é ${NOME_DO_NIVEL[nivel]}: ${marca}.`;
  else if (titulo.metas.length > 1) detalhe = `Nível ${NOME_DO_NIVEL[nivel]}: ${marca}.`;

  abrirConquista({
    topo: sobe ? 'Subiu de nível!' : 'Título novo!',
    palco: [quadro, ...brilhos()],
    faixa: faixaDoTitulo(situacao, false),
    degraus,
    texto: titulo.medida,
    detalhe,
    botaoVer: 'Ver título',
    aoConcluir: indoVer => {
      marcarComoVisto([situacao.chave]);
      if (indoVer) irPara('titulo', titulo.id);
    },
  });
}


function insigniasEmMiniatura(meses, total) {
  const miniaturas = criar('span', 'insignias-miniatura');
  miniaturas.setAttribute('aria-label', `${total} ${total === 1 ? 'insígnia' : 'insígnias'}`);
  const ganhas = vezesPorInsignia(meses).map((vezes, i) => [i, vezes]).filter(([, vezes]) => vezes);
  miniaturas.append(...ganhas.slice(0, MAXIMO_DE_INSIGNIAS).map(([i, vezes]) => desenhoDaInsignia(i, vezes)));
  if (ganhas.length > MAXIMO_DE_INSIGNIAS) miniaturas.append(criar('span', 'insignias-mais', `+${ganhas.length - MAXIMO_DE_INSIGNIAS}`));
  return miniaturas;
}

function mostrarRanking() {
  const { mesAtual, partidas } = estado;
  const doMes = partidas.filter(p => p.mes === mesAtual);
  const { linhas, total } = rankingDe(mesAtual);
  document.getElementById('total-partidas').textContent = `${total} ${total === 1 ? 'partida' : 'partidas'} no mês`;
  document.getElementById('ranking').replaceChildren(...linhas.map(l => linhaDoMes(l, total)));

  const itens = [...doMes].reverse().map(partida => {
    const jogo = jogoDe(partida);
    const aberta = partida.estado === 'aberta';
    const botao = criar('button', `item-partida${aberta ? ' aberta' : ''}`);
    botao.type = 'button';
    const topo = criar('span', 'item-topo');
    topo.append(criar('span', '', jogo.nome), criar('span', 'detalhe', partida.abertaPor ? dataCurta(partida.abertaEm) : ''));
    const lugares = aberta ? null : lugaresDaPartida(partida);
    const ordem = aberta ? partida.placares : [...partida.placares].sort((a, b) => lugares.get(a.jogador) - lugares.get(b.jogador));
    const rostos = criar('span', 'item-jogadores');
    rostos.append(...ordem.slice(0, MAXIMO_DE_ROSTOS).map(s => {
      const foto = imagemDe(jogador(s.jogador), 'foto');
      if (!aberta && lugares.get(s.jogador) === 1) foto.classList.add('vencedor');
      return foto;
    }));
    if (ordem.length > MAXIMO_DE_ROSTOS) rostos.append(criar('span', 'mais', '…'));
    const corpo = criar('span', 'item-corpo');
    corpo.append(topo, criar('span', 'detalhe', resumoDaPartida(partida)), rostos);
    botao.append(imagemDaCapa(jogo), corpo);
    botao.addEventListener('click', () => irPara('partida', partida.id));
    const item = criar('li');
    item.append(botao);
    return item;
  });
  document.getElementById('lista-partidas').replaceChildren(...(itens.length ? itens : [criar('li', 'detalhe', 'Nenhuma partida neste mês ainda.')]));
}

function resumoDaPartida(partida) {
  if (partida.estado === 'aberta') {
    const faltam = partida.placares.filter(s => s.valor === null).length;
    return `Aberta, ${faltam === 1 ? 'falta 1 placar' : `faltam ${faltam} placares`}`;
  }
  const lugares = lugaresDaPartida(partida);
  const vencedores = partida.placares.filter(s => lugares.get(s.jogador) === 1).map(s => jogador(s.jogador)?.apelido || '?');
  return `Venceu ${vencedores.join(' e ')}`;
}

function mostrarPartida(id) {
  const partida = estado.partidas.find(p => p.id === id);
  if (!partida) {
    irPara('inicio');
    return;
  }
  const mesmaPartida = partidaAberta === id;
  partidaAberta = id;
  const { eu, mesAtual } = estado;
  const jogo = jogoDe(partida);
  const aberta = partida.estado === 'aberta';
  const valeNoMes = partida.mes === mesAtual;
  const meu = partida.placares.find(s => s.jogador === eu.id);
  const lancados = partida.placares.filter(s => s.valor !== null).length;
  const autor = jogador(partida.abertaPor)?.apelido;

  document.getElementById('partida-jogo').textContent = jogo.nome;
  let situacao = `Fechada, conta em ${nomeDoMes(partida.mes)}`;
  if (aberta && valeNoMes) situacao = `Aberta${autor ? ` por ${autor}` : ''}. ${lancados} de ${partida.placares.length} lançaram.`;
  if (aberta && !valeNoMes) situacao = 'Não conta: o mês fechou antes de todos lançarem.';
  document.getElementById('partida-situacao').textContent = situacao;

  const notas = aberta ? new Map() : new Map(notasDaPartida(partidaParaFormula(partida)));
  const lugares = aberta ? new Map() : lugaresDaPartida(partida);
  const placares = aberta ? partida.placares : [...partida.placares].sort((a, b) => lugares.get(a.jogador) - lugares.get(b.jogador));
  document.getElementById('partida-jogadores').classList.toggle('aberta', aberta);
  document.getElementById('partida-jogadores').replaceChildren(...placares.map(s => {
    const alguem = jogador(s.jogador);
    const linha = criar('li', 'jogador-linha');
    const valor = criar('span', 'valor');
    if (aberta) {
      const proprio = s.jogador === eu.id && s.valor !== null;
      valor.append(criar('span', 'detalhe', s.valor === null ? 'falta' : proprio ? formatoPlacar.format(s.valor) : 'lançou'));
    } else {
      if (!jogo.semPlacar) valor.append(criar('span', '', formatoPlacar.format(s.valor)));
      valor.append(criar('span', 'detalhe', `nota ${formatoNota.format(notas.get(s.jogador))}`));
    }
    linha.append(criar('span', 'posicao', aberta ? '' : `${lugares.get(s.jogador)}º`), imagemDe(alguem, 'foto'), criar('span', '', alguem?.apelido || '?'), valor);
    return linha;
  }));

  const regras = [];
  if (jogo.semPlacar) regras.push('Jogo sem placar: vale a ordem de chegada.');
  if (jogo.menorVence) regras.push('Neste jogo, menor placar vence.');
  if (!aberta) regras.push('Nota da partida vai de 0 a 1.');
  document.getElementById('partida-rodape').textContent = regras.join(' ');

  const formulario = document.getElementById('form-placar');
  formulario.hidden = !(aberta && valeNoMes && meu);
  if (!formulario.hidden) {
    const campo = document.getElementById('campo-placar');
    if (!mesmaPartida || !campo.value) campo.value = meu.valor === null ? '' : String(meu.valor).replace('.', ',');
    formulario.querySelector('button').textContent = meu.valor === null ? 'Confirmar' : 'Corrigir';
    validarPlacar();
  }

  const podeCancelar = aberta && (partida.abertaPor === eu.id || eu.admin);
  document.getElementById('caixa-cancelar').hidden = !podeCancelar;
  document.getElementById('cancelar-partida').textContent = 'Cancelar partida';
}

function valorDoPlacar() {
  const texto = document.getElementById('campo-placar').value.trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const numero = Number(texto);
  return texto !== '' && Number.isFinite(numero) && numero >= 0 ? numero : null;
}

function validarPlacar() {
  document.querySelector('#form-placar button').disabled = valorDoPlacar() === null;
}

function ligarPartida() {
  const formulario = document.getElementById('form-placar');
  document.getElementById('campo-placar').addEventListener('input', validarPlacar);
  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    const valor = valorDoPlacar();
    if (valor === null) return;
    const somDoSucesso = () => (estado.partidas.find(p => p.id === partidaAberta)?.estado === 'fechada' ? 'partidaFechada' : 'confirmar');
    await enviar(formulario.querySelector('button'), document.getElementById('aviso-placar'), 'lancarPlacar', { partida: partidaAberta, valor }, somDoSucesso);
    if (!formulario.hidden) validarPlacar();
  });

  const cancelar = document.getElementById('cancelar-partida');
  let confirmando = null;
  cancelar.addEventListener('click', async () => {
    if (!confirmando) {
      cancelar.textContent = 'Toque de novo para cancelar';
      confirmando = setTimeout(() => {
        confirmando = null;
        cancelar.textContent = 'Cancelar partida';
      }, 4000);
      return;
    }
    clearTimeout(confirmando);
    confirmando = null;
    if (await enviar(cancelar, document.getElementById('aviso-cancelar'), 'cancelarPartida', { partida: partidaAberta })) irPara('inicio');
  });
}

function jogoSelecionado() {
  return estado.jogos.find(j => j.id === jogoEscolhido);
}

function mostrarNovaPartida() {
  const lista = document.getElementById('campo-jogo');
  const jogos = [...estado.jogos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  lista.replaceChildren(new Option('Escolha o jogo', ''), ...jogos.map(j => new Option(j.nome, j.id)));
  if (!jogoSelecionado()) jogoEscolhido = '';
  lista.value = jogoEscolhido;
  if (!selecao) selecao = [estado.eu.id];
  selecao = selecao.filter(id => jogador(id));
  desenharFichas();
}

function desenharFichas() {
  const escolhido = jogoSelecionado();
  const semPlacar = escolhido?.semPlacar;
  document.getElementById('capa-do-jogo').hidden = !escolhido;
  if (escolhido) mostrarCapa(document.getElementById('capa-atual'), escolhido);
  document.getElementById('instrucao-jogadores').textContent = semPlacar
    ? 'Toque na ordem de chegada, começando pelo vencedor.'
    : 'Toque em quem jogou.';
  document.getElementById('contagem-jogadores').textContent = `${selecao.length} marcados, de 3 a 10`;
  document.getElementById('rodape-partida').textContent = semPlacar
    ? 'Jogo sem placar: a ordem de chegada já fecha a partida.'
    : 'Cada jogador lança o próprio placar depois. A partida só conta quando todos lançarem.';

  const jogadores = [...estado.jogadores].sort((a, b) => a.apelido.localeCompare(b.apelido, 'pt-BR'));
  document.getElementById('escolha-jogadores').replaceChildren(...jogadores.map(alguem => {
    const posicao = selecao.indexOf(alguem.id);
    const ficha = criar('button', 'ficha');
    ficha.type = 'button';
    ficha.setAttribute('aria-pressed', posicao >= 0);
    ficha.append(imagemDe(alguem, 'foto'), criar('span', '', alguem.apelido));
    if (semPlacar && posicao >= 0) ficha.append(criar('span', 'ficha-ordem', `${posicao + 1}º`));
    ficha.addEventListener('click', () => {
      if (posicao >= 0) selecao.splice(posicao, 1);
      else if (selecao.length < 10) selecao.push(alguem.id);
      desenharFichas();
    });
    return ficha;
  }));

  document.querySelector('#form-partida > .botao').disabled = !jogoEscolhido || selecao.length < 3;
}

function ligarNovaPartida() {
  const lista = document.getElementById('campo-jogo');
  const formJogo = document.getElementById('form-jogo');
  const nome = document.getElementById('campo-nome-jogo');
  const menorVence = document.getElementById('jogo-menor-vence');
  const semPlacar = document.getElementById('jogo-sem-placar');
  const salvarJogo = formJogo.querySelector('button');

  lista.addEventListener('change', () => {
    jogoEscolhido = lista.value;
    desenharFichas();
  });

  document.getElementById('alternar-jogo-novo').addEventListener('click', () => {
    formJogo.hidden = !formJogo.hidden;
    if (!formJogo.hidden) nome.focus();
  });

  const avisoJogo = document.getElementById('aviso-jogo');
  const previa = document.getElementById('capa-nova');
  const arquivoNovo = document.getElementById('capa-nova-arquivo');
  const linkNovo = document.getElementById('capa-nova-link');
  let capaNova = '';
  const mostrarPrevia = () => mostrarCapa(previa, { nome: nome.value.trim() || '?', capa: capaNova });
  mostrarPrevia();

  nome.addEventListener('input', () => {
    salvarJogo.disabled = nome.value.trim().length < 2;
    mostrarPrevia();
  });
  semPlacar.addEventListener('change', () => {
    menorVence.disabled = semPlacar.checked;
    if (semPlacar.checked) menorVence.checked = false;
  });

  arquivoNovo.addEventListener('change', async () => {
    const [escolhido] = arquivoNovo.files;
    arquivoNovo.value = '';
    if (!escolhido) return;
    avisoJogo.textContent = '';
    try {
      capaNova = await fotoReduzida(escolhido, { inteira: true });
      linkNovo.value = '';
      mostrarPrevia();
    } catch (erro) {
      avisoJogo.textContent = erro.message;
    }
  });
  linkNovo.addEventListener('input', () => {
    capaNova = linkDeFoto(linkNovo.value.trim()) ? linkNovo.value.trim() : '';
    mostrarPrevia();
  });

  formJogo.addEventListener('submit', async evento => {
    evento.preventDefault();
    const id = novoId('jogos');
    const dados = { id, nome: nome.value.trim(), menorVence: menorVence.checked, semPlacar: semPlacar.checked, capa: capaNova };
    if (await enviar(salvarJogo, avisoJogo, 'cadastrarJogo', dados)) {
      jogoEscolhido = id;
      formJogo.reset();
      capaNova = '';
      mostrarPrevia();
      menorVence.disabled = false;
      formJogo.hidden = true;
      mostrarNovaPartida();
    }
    salvarJogo.disabled = nome.value.trim().length < 2;
  });

  const arquivoTroca = document.getElementById('capa-troca-arquivo');
  const rotuloTroca = document.querySelector('label[for="capa-troca-arquivo"]');
  arquivoTroca.addEventListener('change', async () => {
    const [escolhido] = arquivoTroca.files;
    arquivoTroca.value = '';
    const aviso = document.getElementById('aviso-capa');
    if (!escolhido || !jogoEscolhido) return;
    aviso.textContent = '';
    try {
      await enviar(rotuloTroca, aviso, 'definirCapa', { jogo: jogoEscolhido, capa: await fotoReduzida(escolhido, { inteira: true }) });
    } catch (erro) {
      aviso.textContent = erro.message;
    }
  });

  const formPartida = document.getElementById('form-partida');
  formPartida.addEventListener('submit', async evento => {
    evento.preventDefault();
    const jogo = jogoSelecionado();
    if (!jogo || selecao.length < 3) return;
    const id = novoId('partidas');
    const abriu = await enviar(formPartida.querySelector('.botao'), document.getElementById('aviso-partida'), 'abrirPartida', { id, jogo: jogo.id, participantes: selecao }, jogo.semPlacar ? 'partidaFechada' : 'confirmar');
    if (!abriu) {
      desenharFichas();
      return;
    }
    selecao = null;
    jogoEscolhido = '';
    irPara('partida', id);
  });
}

function mostrarPerfil(id) {
  const alguem = jogador(id || estado.eu.id);
  if (!alguem) {
    irPara('inicio');
    return;
  }
  const { mesAtual, eu } = estado;
  const indice = indiceDoMes(mesAtual);
  mostrarFoto(document.getElementById('perfil-foto'), alguem);
  document.getElementById('perfil-apelido').textContent = alguem.apelido;

  const { linhas, total } = rankingDe(mesAtual);
  const linha = linhas.find(l => l.id === alguem.id);
  const nomeMes = MESES[indice][0].toUpperCase() + MESES[indice].slice(1);
  document.getElementById('perfil-mes').textContent = total
    ? `${nomeMes}: ${linha.posicao}º lugar, ${linha.partidas} de ${total} partidas`
    : `Nenhuma partida em ${MESES[indice]} ainda.`;

  const vezes = vezesPorInsignia(conquistas().get(alguem.id));
  document.getElementById('perfil-insignias').replaceChildren(...vezes.map((quantas, i) => {
    const botao = criar('button', 'botao-insignia');
    botao.type = 'button';
    botao.setAttribute('aria-label', `${INSIGNIAS[i].nome}${quantas ? `, ${quantas}×` : ', ainda não tem'}`);
    botao.append(desenhoDaInsignia(i, quantas));
    botao.addEventListener('click', () => irPara('insignia', i + 1));
    return botao;
  }));

  const proprio = alguem.id === eu.id;
  const exibido = tituloExibido(alguem);
  document.getElementById('perfil-titulo').replaceChildren(...(exibido ? [faixaDoTitulo(exibido)] : []));
  mostrarTitulosDoPerfil(alguem, exibido);
  document.getElementById('trocar-foto').hidden = !proprio;
  if (!proprio) document.getElementById('menu-foto').hidden = true;
  if (proprio) {
    document.getElementById('campo-novo-apelido').placeholder = alguem.apelido;
    mostrarEscolhaDeTitulo();
  }
}

function mostrarTitulosDoPerfil(alguem, exibido) {
  const { catalogo } = titulosDoGinasio();
  const ganhos = titulosGanhos(alguem.id);
  const faltam = TITULOS.map(t => situacaoDe(alguem.id, t.id)).filter(s => !s.alcancados);
  const cartoes = [
    ...ganhos.map(s => cartaoDoTitulo(s, { emUso: exibido?.titulo.id === s.titulo.id })),
    ...faltam.map(s => cartaoDoTitulo(s)),
  ];

  const mestresQueFaltam = catalogo.filter(t => t.jogo).map(t => situacaoDe(alguem.id, t.id)).filter(s => !s.alcancados);
  if (mestresQueFaltam.length) {
    const maisPerto = mestresQueFaltam.reduce((melhor, s) => (s.atual > melhor.atual ? s : melhor));
    const [meta] = METAS_DE_MESTRE;
    const qualquerMestre = situacaoNoTitulo({
      nome: 'Mestre de um jogo', jogo: maisPerto.titulo.jogo, metas: METAS_DE_MESTRE, medida: 'Vitórias num mesmo jogo.', unidade: ['vitória', 'vitórias'],
      textoDoProgresso: () => (maisPerto.atual
        ? `Mais perto: ${maisPerto.titulo.jogo.nome}, ${maisPerto.atual} de ${meta} vitórias para Bronze`
        : `0 de ${meta} vitórias num mesmo jogo para Bronze`),
    }, { atual: maisPerto.atual, niveis: [] });
    cartoes.splice(ganhos.length, 0, cartaoDoTitulo(qualquerMestre, { destino: maisPerto.atual ? maisPerto.titulo.id : '' }));
  }

  document.getElementById('perfil-titulos-conta').textContent = quantidade(ganhos.length, ['título', 'títulos']);
  document.getElementById('perfil-titulos').replaceChildren(...cartoes);
}

function mostrarEscolhaDeTitulo() {
  const ganhos = titulosGanhos(estado.eu.id);
  const lista = document.getElementById('escolha-titulo');
  document.getElementById('sem-titulo').hidden = ganhos.length > 0;
  document.getElementById('rodape-titulo').hidden = !ganhos.length;
  lista.hidden = !ganhos.length;
  const automatico = criar('span', 'opcao-automatica');
  automatico.append(criar('span', 'detalhe', 'Automático'));
  const sugerido = tituloAutomatico(estado.eu.id);
  if (sugerido) automatico.append(linhaDoTitulo(sugerido));
  const opcoes = [['', automatico], ...ganhos.map(s => [s.titulo.id, linhaDoTitulo(s)]), ['nenhum', criar('span', 'detalhe', 'Nenhum')]];
  const marcado = escolhaAtual();
  lista.replaceChildren(...opcoes.map(([valor, conteudo]) => {
    const opcao = criar('button', 'opcao-titulo');
    opcao.type = 'button';
    opcao.setAttribute('role', 'radio');
    opcao.setAttribute('aria-checked', valor === marcado);
    opcao.append(criar('span', 'marcador'), conteudo);
    opcao.addEventListener('click', () => escolherTitulo(valor));
    return opcao;
  }));
}

function escolhaAtual() {
  const { titulo, id } = estado.eu;
  return titulo === 'nenhum' || titulosGanhos(id).some(s => s.titulo.id === titulo) ? titulo : '';
}

async function escolherTitulo(valor) {
  if (escolhaAtual() === valor) return;
  const aviso = document.getElementById('aviso-titulo');
  document.querySelectorAll('#escolha-titulo button').forEach(b => { b.disabled = true; });
  aviso.textContent = '';
  try {
    await ACOES.definirTitulo({ titulo: valor });
    aplicarEstadoEmEspera();
    tocar('confirmar');
  } catch (erro) {
    tocar('erro');
    aviso.textContent = mensagemDeErro(erro);
  } finally {
    if (telaVisivel === 'perfil') mostrarEscolhaDeTitulo();
  }
}

function donosDoTitulo(id) {
  return estado.jogadores
    .map(alguem => [alguem, situacaoDe(alguem.id, id)])
    .filter(([, s]) => s.alcancados)
    .sort(([, a], [, b]) => b.alcancados - a.alcancados || a.desde.localeCompare(b.desde));
}

function mostrarTitulos() {
  const { catalogo } = titulosDoGinasio();
  const linha = titulo => {
    const donos = donosDoTitulo(titulo.id);
    const botao = criar('button', 'linha-titulo');
    botao.type = 'button';
    const texto = criar('span', 'cartao-texto');
    texto.append(criar('span', 'cartao-nome', titulo.nome));
    if (!titulo.jogo) texto.append(criar('span', 'cartao-regra', titulo.medida));
    const rostos = criar('span', 'item-jogadores');
    rostos.append(...donos.slice(0, MAXIMO_DE_ROSTOS).map(([alguem, s]) => {
      const rosto = criar('span', `rosto-nivel nivel-${s.nivel}`);
      rosto.title = NOME_DO_NIVEL[s.nivel];
      rosto.append(imagemDe(alguem, 'foto'));
      return rosto;
    }));
    if (donos.length > MAXIMO_DE_ROSTOS) rostos.append(criar('span', 'mais', '…'));
    if (!donos.length) rostos.append(criar('span', 'detalhe', 'Ninguém ainda'));
    texto.append(rostos);
    const vitrine = donos[0]?.[1] || { titulo, nivel: nivelInicial(titulo), alcancados: 1 };
    botao.append(quadroDoTitulo(vitrine), texto);
    botao.addEventListener('click', () => irPara('titulo', titulo.id));
    const item = criar('li');
    item.append(botao);
    return item;
  };

  document.getElementById('lista-titulos').replaceChildren(...TITULOS.map(linha));
  document.getElementById('rodape-mestres').textContent = `Todo jogo cadastrado ganha o seu Mestre, que sobe de nível a cada ${METAS_DE_MESTRE[0]} vitórias nele.`;
  const mestres = catalogo.filter(t => t.jogo).sort((a, b) => a.jogo.nome.localeCompare(b.jogo.nome, 'pt-BR'));
  document.getElementById('lista-mestres').replaceChildren(...(mestres.length
    ? mestres.map(linha)
    : [criar('li', 'detalhe', 'Nenhum jogo cadastrado ainda.')]));
}

function mostrarTitulo(id) {
  const { porId, porJogador } = titulosDoGinasio();
  const titulo = porId.get(id);
  if (!titulo) {
    irPara('titulos');
    return;
  }
  const { eu } = estado;
  const meu = situacaoDe(eu.id, id);
  const variosNiveis = titulo.metas.length > 1;
  const vitrine = meu.alcancados ? meu : { titulo, nivel: nivelInicial(titulo), alcancados: 1 };
  document.getElementById('titulo-quadro').replaceChildren(quadroDoTitulo(vitrine, true));
  document.getElementById('titulo-faixa').replaceChildren(faixaDoTitulo(vitrine, false));
  document.getElementById('titulo-medida').textContent = titulo.medida;

  const situacao = document.getElementById('titulo-meu');
  if (variosNiveis) {
    const datas = porJogador.get(eu.id)?.get(id)?.niveis || [];
    const escada = criar('ol', 'escada-niveis');
    escada.append(...titulo.metas.map((meta, i) => {
      const degrau = criar('li', i < meu.alcancados ? 'alcancado' : '');
      let nota = '';
      if (i < meu.alcancados) nota = `desde ${nomeDoMes(datas[i])}`;
      else if (i === meu.alcancados) nota = `faltam ${meta - meu.atual}`;
      degrau.append(etiquetaDoNivel(NIVEIS[i], i >= meu.alcancados), criar('span', '', quantidade(meta, titulo.unidade)), criar('span', 'detalhe', nota));
      return degrau;
    }));
    situacao.replaceChildren(criar('p', 'rotulo', meu.alcancados ? `Você está no nível ${NOME_DO_NIVEL[meu.nivel]}` : 'Você ainda não tem'), escada);
  } else if (meu.alcancados) {
    situacao.replaceChildren(criar('p', '', `Você tem desde ${nomeDoMes(meu.desde)}.`));
  } else {
    situacao.replaceChildren(criar('p', 'rotulo', 'Seu progresso'), barraDoProgresso(meu));
  }
  if (meu.alcancados && tituloExibido(eu)?.titulo.id === id) situacao.append(criar('p', 'detalhe', 'Está embaixo do seu nome.'));

  const donos = donosDoTitulo(id);
  document.getElementById('titulo-donos').replaceChildren(...(donos.length
    ? donos.map(([alguem, s]) => {
      const item = criar('li');
      const botao = criar('button', 'botao-limpo dono-titulo');
      botao.type = 'button';
      botao.append(imagemDe(alguem, 'foto'), criar('span', '', alguem.apelido));
      if (variosNiveis) botao.append(etiquetaDoNivel(s.nivel));
      botao.append(criar('span', 'detalhe', `desde ${nomeDoMes(s.desde)}`));
      botao.addEventListener('click', () => irPara('perfil', alguem.id));
      item.append(botao);
      return item;
    })
    : [criar('li', 'detalhe', 'Ninguém ganhou ainda.')]));
}

async function fotoReduzida(arquivo, { inteira = false } = {}) {
  let imagem;
  try {
    imagem = await createImageBitmap(arquivo);
  } catch {
    throw new Error('Não consegui abrir essa imagem. Tente uma foto JPG ou PNG.');
  }
  const quadro = document.createElement('canvas');
  if (inteira) {
    const escala = Math.min(1, LADO_FOTO / Math.max(imagem.width, imagem.height));
    quadro.width = Math.round(imagem.width * escala);
    quadro.height = Math.round(imagem.height * escala);
    quadro.getContext('2d').drawImage(imagem, 0, 0, quadro.width, quadro.height);
  } else {
    const lado = Math.min(imagem.width, imagem.height);
    quadro.width = LADO_FOTO;
    quadro.height = LADO_FOTO;
    quadro.getContext('2d').drawImage(imagem, (imagem.width - lado) / 2, (imagem.height - lado) / 2, lado, lado, 0, 0, LADO_FOTO, LADO_FOTO);
  }
  for (const qualidade of [0.85, 0.75, 0.65, 0.55, 0.45]) {
    for (const formato of ['image/webp', 'image/jpeg']) {
      const dados = quadro.toDataURL(formato, qualidade);
      if (dados.startsWith(`data:${formato}`) && dados.length <= LIMITE_FOTO) return dados;
    }
  }
  throw new Error('Essa foto ficou grande demais. Tente outra.');
}

function ligarPerfil() {
  const formulario = document.getElementById('form-novo-apelido');
  const campo = document.getElementById('campo-novo-apelido');
  const salvar = formulario.querySelector('button');
  const aviso = document.getElementById('aviso-perfil');

  campo.addEventListener('input', () => {
    campo.value = limparApelido(campo.value);
    salvar.disabled = !campo.value || campo.value === estado.eu.apelido;
    aviso.textContent = '';
  });

  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    if (await enviar(salvar, aviso, 'definirPerfil', { apelido: campo.value })) {
      campo.value = '';
      abrirMenuFoto(false);
    }
    salvar.disabled = !campo.value;
  });

  const trocar = document.getElementById('trocar-foto');
  const menuFoto = document.getElementById('menu-foto');
  const avisoFoto = document.getElementById('aviso-foto');
  const formLink = document.getElementById('form-foto-link');
  const dicaLink = document.getElementById('dica-foto-link');
  const campoLink = document.getElementById('campo-foto-link');
  const usarLink = formLink.querySelector('button');

  const abrirMenuFoto = aberto => {
    menuFoto.hidden = !aberto;
    trocar.setAttribute('aria-expanded', aberto);
    formLink.hidden = true;
    dicaLink.hidden = true;
    avisoFoto.textContent = '';
    aviso.textContent = '';
  };
  const trocou = sucesso => { if (sucesso) abrirMenuFoto(false); };
  trocar.addEventListener('click', () => abrirMenuFoto(menuFoto.hidden));

  const google = document.getElementById('foto-google');
  google.addEventListener('click', async () => trocou(await enviar(google, avisoFoto, 'definirPerfil', { foto: 'google' })));

  document.getElementById('abrir-foto-link').addEventListener('click', () => {
    formLink.hidden = false;
    dicaLink.hidden = false;
    campoLink.focus();
  });
  const linkValido = () => /^https:\/\/[^\s"'<>]{4,500}$/.test(campoLink.value.trim());
  campoLink.addEventListener('input', () => { usarLink.disabled = !linkValido(); });
  formLink.addEventListener('submit', async evento => {
    evento.preventDefault();
    if (!linkValido()) return;
    const sucesso = await enviar(usarLink, avisoFoto, 'definirPerfil', { foto: campoLink.value.trim() });
    if (sucesso) campoLink.value = '';
    usarLink.disabled = !linkValido();
    trocou(sucesso);
  });

  const arquivo = document.getElementById('foto-arquivo');
  const rotulo = document.querySelector('label[for="foto-arquivo"]');
  arquivo.addEventListener('change', async () => {
    const [escolhido] = arquivo.files;
    arquivo.value = '';
    if (!escolhido) return;
    rotulo.textContent = 'Enviando…';
    try {
      trocou(await enviar(google, avisoFoto, 'definirPerfil', { foto: await fotoReduzida(escolhido) }));
    } catch (erro) {
      avisoFoto.textContent = erro.message;
    } finally {
      rotulo.textContent = 'Escolher do celular';
    }
  });
}

function mostrarInsignias() {
  const emDisputa = indiceDoMes(estado.mesAtual);
  document.getElementById('grade-insignias').replaceChildren(...INSIGNIAS.map((insignia, i) => {
    const botao = criar('button', `botao-insignia${i === emDisputa ? ' em-disputa' : ''}`);
    botao.type = 'button';
    botao.setAttribute('aria-label', `${insignia.nome}, ${MESES[i]}`);
    botao.append(desenhoDaInsignia(i, 1),criar('span', '', insignia.nome.replace(/^Insígnia d[oa]s? /, '')), criar('span', 'detalhe', MESES[i]));
    botao.addEventListener('click', () => irPara('insignia', i + 1));
    return botao;
  }));
}

function mostrarInsignia(numero) {
  const indice = Number(numero) - 1;
  if (!(indice >= 0 && indice < 12)) {
    irPara('insignias');
    return;
  }
  const { trecho, nome, lore } = INSIGNIAS[indice];
  const todas = conquistas();
  const minhas = vezesPorInsignia(todas.get(estado.eu.id))[indice];
  const donos = [...todas]
    .map(([id, meses]) => [jogador(id), meses.filter(m => indiceDoMes(m) === indice).map(m => m.slice(0, 4))])
    .filter(([alguem, anos]) => alguem && anos.length);

  document.getElementById('insignia-imagem').replaceChildren(desenhoDaInsignia(indice, Math.max(1, minhas), true));
  document.getElementById('insignia-minha').hidden = !minhas;
  document.getElementById('insignia-minha').textContent = minhas > 1 ? `Você tem esta insígnia ×${minhas}` : 'Você tem esta insígnia';
  document.getElementById('insignia-nome').textContent = nome;
  document.getElementById('insignia-trecho').textContent = `${MESES[indice]} · ${trecho}`;
  document.getElementById('insignia-texto').textContent = lore;
  document.getElementById('insignia-donos').replaceChildren(...(donos.length
    ? donos.map(([alguem, anos]) => {
      const item = criar('li');
      item.append(imagemDe(alguem, 'foto'), criar('span', '', alguem.apelido), criar('span', 'detalhe', anos.join(', ')));
      return item;
    })
    : [criar('li', 'detalhe', `Ninguém ganhou ainda. Fica com ela quem fechar ${MESES[indice]} no topo.`)]));
}

function mostrarCampeoes() {
  const lista = document.getElementById('lista-campeoes');
  const meses = mesesFechados();
  if (!meses.length) {
    const proximo = MESES[(indiceDoMes(estado.mesAtual) + 1) % 12];
    const vazio = criar('section', 'caixa');
    vazio.append(criar('p', '', `Nenhum mês fechou ainda. O primeiro campeão aparece em 1º de ${proximo}.`));
    lista.replaceChildren(vazio);
    return;
  }
  const [recente, ...anteriores] = meses;
  const partes = [cartaoDeCampeao(recente)];
  if (anteriores.length) {
    const caixa = criar('section', 'caixa');
    const linhas = criar('ul', 'lista-campeoes-antigos');
    for (const mes of anteriores) {
      const item = criar('li');
      if (mes === mesDoCampeaoAberto) {
        const cartao = cartaoDeCampeao(mes);
        cartao.classList.remove('caixa');
        cartao.classList.add('campeao-aberto');
        cartao.querySelector('.rotulo').addEventListener('click', () => abrirCampeao(''));
        item.append(cartao);
      } else {
        item.append(linhaDeCampeao(mes));
      }
      linhas.append(item);
    }
    caixa.append(criar('h2', 'rotulo', 'Meses anteriores'), linhas);
    partes.push(caixa);
  }
  lista.replaceChildren(...partes);
}

function abrirCampeao(mes) {
  mesDoCampeaoAberto = mes;
  mostrarCampeoes();
}

function linhaDeCampeao(mes) {
  const campeoes = campeoesDe(mes);
  const botao = criar('button', 'linha-campeao');
  botao.type = 'button';
  const rostos = criar('span', 'linha-campeao-rostos');
  rostos.append(...campeoes.map(l => imagemDe(jogador(l.id), 'foto')));
  const nome = criar('span', 'linha-campeao-nome');
  nome.append(criar('span', '', campeoes.map(l => jogador(l.id)?.apelido || '?').join(' e ')), criar('span', 'detalhe', nomeDoMes(mes)));
  botao.append(desenhoDaInsignia(indiceDoMes(mes), 1), rostos, nome);
  botao.addEventListener('click', () => abrirCampeao(mes));
  return botao;
}

function cartaoDeCampeao(mes) {
  const { linhas } = rankingDe(mes);
  const campeoes = linhas.filter(l => l.posicao === 1 && l.nota > 0);
  const indice = indiceDoMes(mes);
  const cartao = criar('section', 'caixa campeao');
  cartao.append(criar('h2', 'rotulo', nomeDoMes(mes)));

  const trofeu = criar('button', 'botao-limpo');
  trofeu.type = 'button';
  trofeu.setAttribute('aria-label', `Ver a ${INSIGNIAS[indice].nome}`);
  trofeu.append(desenhoDaInsignia(indice, 1, true));
  trofeu.addEventListener('click', () => irPara('insignia', indice + 1));
  const pessoas = criar('div', 'campeao-pessoas');
  pessoas.append(...campeoes.map(linha => {
    const alguem = jogador(linha.id);
    const pessoa = criar('div', 'campeao-pessoa');
    const dados = criar('div');
    dados.append(criar('p', 'perfil-apelido', alguem.apelido), criar('p', 'detalhe', `Nota do mês ${formatoNota.format(linha.nota)}`));
    pessoa.append(imagemDe(alguem, 'foto-grande'), dados);
    return pessoa;
  }));
  const topo = criar('div', 'campeao-topo');
  topo.append(trofeu, pessoas);
  cartao.append(topo);

  for (const linha of campeoes) {
    const frase = estado.frases.find(f => f.mes === mes && f.jogador === linha.id);
    if (!frase) continue;
    const balao = criar('div', 'balao');
    if (campeoes.length > 1) balao.append(criar('span', 'detalhe', jogador(linha.id).apelido));
    balao.append(criar('p', 'frase', frase.texto));
    cartao.append(balao);
  }

  cartao.append(criar('p', 'detalhe', `${INSIGNIAS[indice].nome} e ${estado.premios[mes] || 'prêmio não registrado'}`));

  const seguintes = linhas.filter(l => l.nota > 0 && l.posicao > 1 && l.posicao <= 3);
  if (seguintes.length) {
    const podio = criar('div', 'campeao-seguintes');
    podio.append(...seguintes.map(linha => {
      const alguem = jogador(linha.id);
      const item = criar('span', 'campeao-seguinte');
      item.append(criar('span', '', `${linha.posicao}º`), imagemDe(alguem, 'foto'), criar('span', '', alguem.apelido), criar('span', 'detalhe', formatoNota.format(linha.nota)));
      return item;
    }));
    cartao.append(podio);
  }

  if (campeoes.some(l => l.id === estado.eu.id)) {
    const atual = estado.frases.find(f => f.mes === mes && f.jogador === estado.eu.id);
    const formulario = criar('form', 'formulario');
    const rotulo = criar('label', 'rotulo', atual ? 'Trocar sua frase' : 'Escreva sua frase de campeão');
    const linhaCampo = criar('div', 'linha-campo');
    const campo = criar('input', 'campo campo-texto');
    const salvar = criar('button', 'botao', 'Salvar');
    const aviso = criar('p', 'aviso');
    campo.id = `frase-${mes}`;
    campo.maxLength = 120;
    campo.autocomplete = 'off';
    campo.value = atual?.texto || '';
    rotulo.htmlFor = campo.id;
    const validar = () => { salvar.disabled = campo.value.trim().length < 2 || campo.value.trim() === (atual?.texto || ''); };
    validar();
    campo.addEventListener('input', validar);
    formulario.addEventListener('submit', async evento => {
      evento.preventDefault();
      await enviar(salvar, aviso, 'salvarFrase', { mes, texto: campo.value }, 'campeao');
    });
    linhaCampo.append(campo, salvar);
    formulario.append(rotulo, linhaCampo, aviso);
    cartao.append(formulario);
  }
  return cartao;
}

function carregarKatex() {
  carregamentoKatex ??= new Promise((pronto, falha) => {
    const estilo = document.createElement('link');
    estilo.rel = 'stylesheet';
    estilo.href = `${KATEX}katex.min.css`;
    const script = document.createElement('script');
    script.src = `${KATEX}katex.min.js`;
    script.onload = pronto;
    script.onerror = falha;
    document.head.append(estilo, script);
  });
  return carregamentoKatex;
}

async function mostrarRegras() {
  try {
    await carregarKatex();
  } catch {
    return;
  }
  document.querySelectorAll('[data-formula]:not([data-pronta])').forEach(el => {
    window.katex.render(el.dataset.formula, el, { displayMode: true, throwOnError: false });
    el.dataset.pronta = '';
  });
  document.querySelectorAll('[data-formula-linha]:not([data-pronta])').forEach(el => {
    window.katex.render(el.dataset.formulaLinha, el, { throwOnError: false });
    el.dataset.pronta = '';
  });
}

function mostrarAdministracao() {
  const { mesAtual, premios, liberados } = estado;
  const premio = document.getElementById('campo-premio');
  premio.value = premios[mesAtual] || '';
  validarPremio();

  const vinculo = document.getElementById('campo-vinculo');
  const semEmail = liberados.filter(l => !l.email && l.apelido);
  const opcoesDeVinculo = () => [new Option('Jogador novo', ''), ...semEmail.map(l => new Option(l.apelido, l.id))];
  vinculo.replaceChildren(...opcoesDeVinculo());

  const pedidos = estado.pedidos || [];
  document.getElementById('caixa-pedidos').hidden = !pedidos.length;
  document.getElementById('lista-pedidos').replaceChildren(...pedidos.map(pedido => {
    const item = criar('li');
    const escolha = criar('select', 'campo campo-texto');
    const aprovar = criar('button', 'botao', 'Aprovar');
    const recusar = criar('button', 'botao-menu voltar', 'Recusar pedido');
    const aviso = criar('p', 'aviso');
    const linhaCampo = criar('div', 'linha-campo');
    escolha.setAttribute('aria-label', `De quem é a conta ${pedido.email}`);
    escolha.append(...opcoesDeVinculo());
    aprovar.addEventListener('click', () => enviar(aprovar, aviso, 'aprovarPedido', { pedido: pedido.id, jogador: escolha.value || undefined }));
    recusar.addEventListener('click', () => enviar(recusar, aviso, 'recusarPedido', { pedido: pedido.id }));
    linhaCampo.append(escolha, aprovar);
    item.append(criar('span', '', pedido.nome || pedido.email), criar('span', 'detalhe email', pedido.email), linhaCampo, recusar, aviso);
    return item;
  }));

  const ordenados = [...liberados].sort((a, b) => Boolean(b.email) - Boolean(a.email));
  document.getElementById('lista-acessos').replaceChildren(...ordenados.map(l => {
    const item = criar('li');
    item.append(criar('span', l.email ? 'email' : 'detalhe', l.email || 'sem e-mail'), criar('span', l.apelido ? '' : 'detalhe', l.apelido || 'ainda não entrou'));
    return item;
  }));
}

function validarPremio() {
  const campo = document.getElementById('campo-premio');
  const atual = estado.premios[estado.mesAtual] || '';
  document.querySelector('#form-premio button').disabled = campo.value.trim().length < 2 || campo.value.trim() === atual;
}

function validarEmail() {
  document.querySelector('#form-liberar button').disabled = !EMAIL_VALIDO.test(document.getElementById('campo-email').value.trim());
}

function ligarAdministracao() {
  const formPremio = document.getElementById('form-premio');
  document.getElementById('campo-premio').addEventListener('input', validarPremio);
  formPremio.addEventListener('submit', async evento => {
    evento.preventDefault();
    const texto = document.getElementById('campo-premio').value;
    await enviar(formPremio.querySelector('button'), document.getElementById('aviso-premio'), 'definirPremio', { mes: estado.mesAtual, texto });
    validarPremio();
  });

  const formLiberar = document.getElementById('form-liberar');
  const email = document.getElementById('campo-email');
  email.addEventListener('input', validarEmail);
  formLiberar.addEventListener('submit', async evento => {
    evento.preventDefault();
    const dados = { email: email.value.trim(), jogador: document.getElementById('campo-vinculo').value || undefined };
    if (await enviar(formLiberar.querySelector('button'), document.getElementById('aviso-liberar'), 'liberarEmail', dados)) email.value = '';
    validarEmail();
  });
}

const TELAS = {
  inicio: mostrarInicio,
  ranking: mostrarRanking,
  partida: mostrarPartida,
  'nova-partida': mostrarNovaPartida,
  perfil: mostrarPerfil,
  insignias: mostrarInsignias,
  insignia: mostrarInsignia,
  titulos: mostrarTitulos,
  titulo: mostrarTitulo,
  campeoes: mostrarCampeoes,
  regras: mostrarRegras,
  administracao: mostrarAdministracao,
};

function rotaAtual() {
  const [tela, parametro = ''] = location.hash.slice(1).split('/');
  if (!TELAS[tela] || (tela === 'administracao' && !estado.eu.admin)) return { tela: 'inicio', parametro: '' };
  return { tela, parametro: decodeURIComponent(parametro) };
}

function renderizar() {
  if (!estado?.eu.apelido) return;
  const { tela, parametro } = rotaAtual();
  mostrarTela(tela);
  TELAS[tela](parametro);
  verificarTitulosNovos();
}

function irPara(tela, parametro) {
  const destino = `#${tela}${parametro ? `/${encodeURIComponent(parametro)}` : ''}`;
  if (location.hash === destino) renderizar();
  else location.hash = destino;
}

function ligarApelido() {
  const formulario = document.getElementById('form-apelido');
  const campo = document.getElementById('campo-apelido');
  const botao = formulario.querySelector('button');
  const aviso = document.getElementById('aviso-apelido');

  campo.addEventListener('input', () => {
    campo.value = limparApelido(campo.value);
    botao.disabled = !campo.value;
    aviso.textContent = '';
  });

  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    await enviar(botao, aviso, 'definirPerfil', { apelido: campo.value });
    botao.disabled = !campo.value;
  });
}

async function sairDaConta() {
  pararEscutas();
  history.replaceState(null, '', location.pathname);
  mostrarEntrada('Saindo…');
  await signOut(auth).catch(() => {});
  await terminate(banco).catch(() => {});
  await clearIndexedDbPersistence(banco).catch(() => {});
  location.reload();
}

function ligarMenu() {
  const botao = document.getElementById('abrir-menu');
  const menu = document.getElementById('menu');
  const itensAtivos = () => [...menu.querySelectorAll('button:not([hidden])')].filter(b => !b.parentElement.hidden);
  const acoes = { som: alternarSom, sair: sairDaConta, fechar: () => {} };

  const expandirGrupo = cabecalho => {
    menu.querySelectorAll('[data-grupo]').forEach(g => {
      const aberto = g === cabecalho;
      g.setAttribute('aria-expanded', aberto);
      document.getElementById(g.getAttribute('aria-controls')).hidden = !aberto;
    });
  };

  const alternar = aberto => {
    if (aberto) tocar('mover');
    const secao = { insignia: 'insignias', titulo: 'titulos' }[telaVisivel] || telaVisivel;
    const atual = menu.querySelector(`[data-item="${secao}"]`);
    if (aberto) expandirGrupo(menu.querySelector(`[aria-controls="${atual?.parentElement.id}"]`));
    menu.hidden = !aberto;
    botao.setAttribute('aria-expanded', aberto);
    (aberto ? atual || itensAtivos()[0] : botao).focus();
  };

  botao.addEventListener('click', () => alternar(menu.hidden));
  menu.addEventListener('click', e => {
    const item = e.target.closest('button');
    if (!item) return;
    if (item.dataset.grupo) {
      tocar('mover');
      expandirGrupo(item.getAttribute('aria-expanded') === 'true' ? null : item);
      item.focus();
      return;
    }
    alternar(false);
    if (item.dataset.item !== 'som') tocar('escolher');
    if (acoes[item.dataset.item]) acoes[item.dataset.item]();
    else irPara(item.dataset.item);
  });
  menu.addEventListener('pointerover', e => e.target.closest('button')?.focus());
  menu.addEventListener('keydown', e => {
    const itens = itensAtivos();
    const atual = itens.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') itens[(atual + 1) % itens.length].focus();
    else if (e.key === 'ArrowUp') itens[(atual - 1 + itens.length) % itens.length].focus();
    else if (e.key === 'Escape') alternar(false);
    else return;
    if (e.key !== 'Escape') tocar('mover');
    e.preventDefault();
  });
  document.addEventListener('pointerdown', e => {
    if (!menu.hidden && !menu.contains(e.target) && !botao.contains(e.target)) alternar(false);
  });
  document.addEventListener('click', e => {
    const atalho = e.target.closest('[data-ir]');
    if (atalho) irPara(atalho.dataset.ir);
  });
}

function iniciar() {
  mostrarItemDeSom();
  ligarMenu();
  ligarApelido();
  ligarPartida();
  ligarNovaPartida();
  ligarPerfil();
  ligarAdministracao();
  document.getElementById('botao-google').addEventListener('click', entrarComGoogle);
  window.addEventListener('hashchange', renderizar);
  document.addEventListener('focusout', () => setTimeout(() => {
    if (!digitando()) aplicarEstadoEmEspera();
  }));
  try { localStorage.removeItem('ginasio.token'); } catch {}
  try { indexedDB.deleteDatabase(`firestore/[DEFAULT]/${FIREBASE.projectId}/main`); } catch {}
  onAuthStateChanged(auth, acompanharConta);
}

iniciar();
