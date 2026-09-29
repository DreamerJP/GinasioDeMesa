import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, terminate, clearIndexedDbPersistence,
  collection, doc, onSnapshot, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp,
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

const CASAS_DA_NOTA = 3;
const FRACAO_DA_FALTA = 0.5;
const formatoNota = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: CASAS_DA_NOTA, maximumFractionDigits: CASAS_DA_NOTA });
const formatoPlacar = new Intl.NumberFormat('pt-BR');

const app = initializeApp(FIREBASE);
const auth = getAuth(app);
const banco = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

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
  } else {
    desenho.append(MESES[indice].slice(0, 3));
  }
  if (vezes > 1) desenho.append(criar('span', 'insignia-vezes', `×${vezes}`));
  return desenho;
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
    return setDoc(doc(banco, 'jogadores', eu.id), { apelido: nome, foto: novaFoto });
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
  escutasDosDados = nomes.map(nome => onSnapshot(collection(banco, nome), retrato => {
    lidos[nome] = retrato.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
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
  const jogadores = lidos.jogadores.filter(j => j.apelido).map(({ id, apelido, foto }) => ({ id, apelido, foto }));
  const apelidoDe = id => jogadores.find(j => j.id === id)?.apelido || '';
  const comEmail = new Set((lidos.acessos || []).map(a => a.jogador));
  return {
    mesAtual: mesDeHoje(),
    eu: { id: conta.id, apelido: meu?.apelido || '', foto: meu?.foto || '', admin: conta.admin },
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
  setDoc(doc(banco, 'jogadores', eu.id), { apelido: eu.apelido, foto: fotoDoGoogle() }).catch(() => {});
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

  const chave = `ginasio.celebracao.${ultimo}`;
  let jaViu = false;
  try { jaViu = localStorage.getItem(chave) === '1'; } catch {}
  if (jaViu) {
    const euVenci = campeoes.some(l => l.id === estado.eu.id);
    const escreveu = estado.frases.some(f => f.mes === ultimo && f.jogador === estado.eu.id);
    if (euVenci && !escreveu) { tocar('campeao'); irPara('campeoes'); return true; }
    return false;
  }
  try { localStorage.setItem(chave, '1'); } catch {}
  tocar('campeao');
  mostrarCelebracao(ultimo, campeoes);
  return true;
}

function mostrarCelebracao(mes, campeoes) {
  const indice = indiceDoMes(mes);
  const insignia = INSIGNIAS[indice];
  const euVenci = campeoes.some(l => l.id === estado.eu.id);
  const nomesVencedores = campeoes.map(l => jogador(l.id)?.apelido || '?').join(' e ');

  const overlay = document.getElementById('celebracao');
  const imgEl = document.getElementById('celebracao-insignia');
  const titulo = document.getElementById('celebracao-titulo');
  const subtitulo = document.getElementById('celebracao-subtitulo');
  const lore = document.getElementById('celebracao-lore');
  const botao = document.getElementById('celebracao-fechar');

  renderizar();
  imgEl.replaceChildren(desenhoDaInsignia(indice, 1, true));
  lore.textContent = insignia.lore || '';
  if (euVenci) {
    overlay.dataset.campeao = '';
    titulo.textContent = `Parabéns, ${estado.eu.apelido}!`;
    subtitulo.textContent = `Você venceu ${nomeDoMes(mes)} e ganhou a ${insignia.nome}.`;
  } else {
    delete overlay.dataset.campeao;
    titulo.textContent = `${nomesVencedores} venceu${campeoes.length > 1 ? 'ram' : ''} ${nomeDoMes(mes)}!`;
    subtitulo.textContent = `A ${insignia.nome} ficou com ${nomesVencedores}.`;
  }

  const fechar = () => {
    overlay.hidden = true;
    const escreveu = estado.frases.some(f => f.mes === mes && f.jogador === estado.eu.id);
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
  document.querySelectorAll('.podio-lugar').forEach(lugar => {
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

  const geral = rankingGeral();
  const donos = conquistas();
  const proximo = MESES[(indice + 1) % 12];
  document.getElementById('ranking-geral').replaceChildren(...(geral.length
    ? geral.map(l => linhaDoRanking(
      l.id,
      l.posicao,
      insigniasEmMiniatura(donos.get(l.id), l.insignias),
      `${l.podios} ${l.podios === 1 ? 'vez' : 'vezes'} entre os 3 primeiros`,
    ))
    : [criar('li', 'detalhe', `Nenhum mês fechou ainda. O primeiro entra aqui em 1º de ${proximo}.`)]));
}

function insigniasEmMiniatura(meses, total) {
  const miniaturas = criar('span', 'insignias-miniatura');
  miniaturas.setAttribute('aria-label', `${total} ${total === 1 ? 'insígnia' : 'insígnias'}`);
  vezesPorInsignia(meses).forEach((vezes, i) => {
    if (vezes) miniaturas.append(desenhoDaInsignia(i, vezes));
  });
  if (!total) miniaturas.append(criar('span', 'detalhe', 'sem insígnia'));
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
  document.getElementById('perfil-edicao').hidden = !proprio;
  if (proprio) document.getElementById('campo-novo-apelido').placeholder = alguem.apelido;
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
    if (await enviar(salvar, aviso, 'definirPerfil', { apelido: campo.value })) campo.value = '';
    salvar.disabled = !campo.value;
  });

  const google = document.getElementById('foto-google');
  google.addEventListener('click', () => enviar(google, aviso, 'definirPerfil', { foto: 'google' }));

  const formLink = document.getElementById('form-foto-link');
  const campoLink = document.getElementById('campo-foto-link');
  const usarLink = formLink.querySelector('button');
  const linkValido = () => /^https:\/\/[^\s"'<>]{4,500}$/.test(campoLink.value.trim());
  campoLink.addEventListener('input', () => { usarLink.disabled = !linkValido(); });
  formLink.addEventListener('submit', async evento => {
    evento.preventDefault();
    if (!linkValido()) return;
    if (await enviar(usarLink, aviso, 'definirPerfil', { foto: campoLink.value.trim() })) campoLink.value = '';
    usarLink.disabled = !linkValido();
  });

  const arquivo = document.getElementById('foto-arquivo');
  const rotulo = document.querySelector('label[for="foto-arquivo"]');
  arquivo.addEventListener('change', async () => {
    const [escolhido] = arquivo.files;
    arquivo.value = '';
    if (!escolhido) return;
    rotulo.textContent = 'Enviando…';
    try {
      await enviar(google, aviso, 'definirPerfil', { foto: await fotoReduzida(escolhido) });
    } catch (erro) {
      aviso.textContent = erro.message;
    } finally {
      rotulo.textContent = 'Enviar do celular';
    }
  });
}

function mostrarInsignias() {
  const emDisputa = indiceDoMes(estado.mesAtual);
  const ultimoDono = Array(12).fill(null);
  const ultimoMes = Array(12).fill('');
  for (const [id, meses] of conquistas()) {
    for (const mes of meses) {
      const i = indiceDoMes(mes);
      if (mes > ultimoMes[i]) {
        ultimoMes[i] = mes;
        ultimoDono[i] = id;
      }
    }
  }

  document.getElementById('grade-insignias').replaceChildren(...INSIGNIAS.map((insignia, i) => {
    const botao = criar('button', `botao-insignia${i === emDisputa ? ' em-disputa' : ''}`);
    botao.type = 'button';
    botao.setAttribute('aria-label', `${insignia.nome}, ${MESES[i]}`);
    const desenho = desenhoDaInsignia(i, 1);
    if (ultimoDono[i]) desenho.append(imagemDe(jogador(ultimoDono[i]), 'foto dono-insignia'));
    botao.append(desenho, criar('span', '', insignia.nome.replace(/^Insígnia d[oa]s? /, '')), criar('span', 'detalhe', MESES[i]));
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
    const atual = menu.querySelector(`[data-item="${telaVisivel === 'insignia' ? 'insignias' : telaVisivel}"]`);
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
  onAuthStateChanged(auth, acompanharConta);
}

iniciar();
