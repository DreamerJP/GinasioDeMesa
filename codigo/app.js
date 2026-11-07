import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  initializeFirestore, memoryLocalCache, terminate, clearIndexedDbPersistence, collection, doc, query, where, onSnapshot, setDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { MESES, alternarSom, mostrarSom, tocar, indiceDoMes, vistosNestaSessao, mesDeHoje, criar, avatarPadrao } from './base.js?v=101';
import { limparApelido, fotoDoGoogle, enviar } from './acoes.js?v=101';
import { mostrarInicio, mostrarRanking, mostrarRegras, ligarRegras, esquecerRanking } from './ranking.js?v=101';
import { mostrarTitulos, mostrarTitulo } from './titulos.js?v=101';
import { PRAZO_DO_CONVITE, mostrarDuelos, ligarDuelos, esquecerDuelos } from './duelos.js?v=101';
import { mostrarServidores, ligarServidores, mostrarEscolha, esquecerMesaEscolhida } from './salao.js?v=101';
import { verificarAvisos, esquecerAvisos } from './avisos.js?v=101';
import { mostrarPartida, ligarPartida, mostrarNovaPartida, ligarNovaPartida, esquecerPartidas } from './partidas.js?v=101';
import { mostrarPerfil, encaixarTopoDoPerfil, ligarPerfil, esquecerPerfil } from './perfil.js?v=101';
import { mostrarInsignias, mostrarInsignia, mostrarCampeoes, esquecerCampeoes } from './campeoes.js?v=101';
import { mostrarAdministracao, ligarAdministracao, esquecerAdministracao } from './administracao.js?v=101';

const SERVIDORES = [
  {
    id: 'principal',
    nome: 'Principal',
    cor: '#3d5a9e',
    firebase: {
      apiKey: 'AIzaSyA13vwn78UVFuTeSR1fnOmvUa8Nk-E697Q',
      authDomain: 'ginasio-de-mesa.firebaseapp.com',
      projectId: 'ginasio-de-mesa',
      appId: '1:777149850301:web:ef7fd180c2654bb338cdd4',
    },
  },
  {
    id: 'victor',
    nome: 'Victor',
    cor: '#8f2d2d',
    firebase: {
      apiKey: 'AIzaSyA-CCkpEgM7yJ09x5yclj3d_1PQ9EEvKuc',
      authDomain: 'ginasio-victor.firebaseapp.com',
      projectId: 'ginasio-victor',
      appId: '1:534534773650:web:eb492b8c0251a8e6bc3f4b',
    },
  },
];
const CHAVE_SERVIDOR = 'ginasio.servidor';
const DEMORA_DA_ENTRADA = 8000;
const INTERVALO_DO_ACESSO = 30 * 60e3;

for (const [i, servidor] of SERVIDORES.entries()) {
  const app = i ? initializeApp(servidor.firebase, servidor.id) : initializeApp(servidor.firebase);
  servidor.auth = getAuth(app);
  // Sem cópia do banco no aparelho: uma cópia guardada por versões antigas deixava o site parado em "Abrindo o ginásio…".
  servidor.banco = initializeFirestore(app, { localCache: memoryLocalCache() });
  servidor.escutas = [];
  servidor.escutasExtras = [];
}
const [PRINCIPAL] = SERVIDORES;

let email = '';
let servidor = null;
let banco = null;
let conta = null;
let lidos = {};
let fotoCompletada = false;
let acessoRegistradoEm = 0;
let escutasDosDados = [];
let estado = null;
let estadoEmEspera = null;
let relogioDaEntrada = null;
let telaVisivel = '';

function pararDados() {
  escutasDosDados.forEach(parar => parar());
  escutasDosDados = [];
  lidos = {};
  conta = null;
  estado = null;
  estadoEmEspera = null;
  vistosNestaSessao.clear();
}

function pararServidores() {
  for (const cada of SERVIDORES) {
    [...cada.escutas, ...cada.escutasExtras].forEach(parar => parar());
    Object.assign(cada, { escutas: [], escutasExtras: [], extras: '', acesso: undefined, pedido: undefined, falhou: false, convites: [], pedidosDeEntrada: 0, doDono: null });
  }
}

function sairDoServidor() {
  pararDados();
  servidor = null;
  banco = null;
  document.getElementById('nome-do-servidor').textContent = '';
}

function pararEscutas() {
  pararServidores();
  sairDoServidor();
}

function esquecerTelas() {
  esquecerPartidas();
  esquecerRanking();
  esquecerAvisos();
  esquecerPerfil();
  esquecerCampeoes();
  esquecerDuelos();
  esquecerAdministracao();
  fotoCompletada = false;
  acessoRegistradoEm = 0;
  ['celebracao', 'conquista', 'resultado'].forEach(id => { document.getElementById(id).hidden = true; });
}

async function iniciarSessao() {
  await Promise.all(SERVIDORES.map(cada => cada.auth.authStateReady()));
  const endereco = PRINCIPAL.auth.currentUser?.email?.toLowerCase() || '';
  if (!endereco || SERVIDORES.some(cada => cada.auth.currentUser?.email?.toLowerCase() !== endereco)) {
    mostrarEntrada('', 'google');
    return;
  }
  acompanharConta(endereco);
}

function acompanharConta(endereco) {
  pararEscutas();
  email = endereco;
  mostrarEntrada('Abrindo o ginásio…');
  for (const cada of SERVIDORES) {
    const falhou = () => {
      Object.assign(cada, { falhou: true, acesso: null, pedido: false });
      decidirServidor();
    };
    cada.escutas = [
      onSnapshot(doc(cada.banco, 'acessos', email), retrato => {
        if (retrato.metadata.hasPendingWrites || (!retrato.exists() && retrato.metadata.fromCache)) return;
        cada.acesso = retrato.exists() ? retrato.data() : null;
        decidirServidor();
      }, falhou),
      onSnapshot(doc(cada.banco, 'pedidos', email), retrato => {
        if (!retrato.exists() && retrato.metadata.fromCache) return;
        cada.pedido = retrato.exists();
        decidirServidor();
      }, falhou),
    ];
  }
}

function papelEm(cada) {
  const { jogador: id = '', admin = false, dono = false } = cada.acesso || {};
  return { id, admin: admin || dono, dono };
}

function decidirServidor() {
  if (SERVIDORES.some(cada => cada.acesso === undefined || cada.pedido === undefined)) return;
  const comAcesso = SERVIDORES.filter(cada => cada.acesso);
  if (servidor?.acesso) {
    const papel = papelEm(servidor);
    if (conta && (conta.id !== papel.id || conta.admin !== papel.admin || conta.dono !== papel.dono)) entrarNoServidor(servidor);
    else atualizarServidores();
    return;
  }
  if (servidor) {
    sairDoServidor();
    history.replaceState(null, '', location.pathname);
  }
  atualizarServidores();
  let lembrado = '';
  try {
    lembrado = localStorage.getItem(CHAVE_SERVIDOR) || '';
  } catch {}
  const escolhido = comAcesso.length === 1 ? comAcesso[0] : comAcesso.find(cada => cada.id === lembrado);
  if (escolhido) entrarNoServidor(escolhido);
  else if (comAcesso.length) mostrarEscolha();
  else if (SERVIDORES.some(cada => cada.falhou)) mostrarEntrada('Não consegui abrir os dados do ginásio.', 'tentar');
  else if (SERVIDORES.some(cada => cada.pedido)) {
    const { nome } = SERVIDORES.find(cada => cada.pedido);
    mostrarEntrada(`Seu pedido de entrada foi enviado para o servidor ${nome}. Assim que o administrador aprovar, o ginásio abre sozinho.`, 'google', true);
  } else mostrarEscolha();
}

function entrarNoServidor(escolhido) {
  pararDados();
  esquecerTelas();
  servidor = escolhido;
  banco = escolhido.banco;
  try {
    localStorage.setItem(CHAVE_SERVIDOR, escolhido.id);
  } catch {}
  conta = papelEm(escolhido);
  document.getElementById('nome-do-servidor').textContent = escolhido.nome;
  atualizarServidores();
  mostrarEntrada('Abrindo o ginásio…');
  escutarDados();
}

function trocarDeServidor(escolhido) {
  tocar('escolher');
  if (escolhido === servidor) {
    irPara('inicio');
    return;
  }
  if (servidor) history.replaceState(null, '', location.pathname);
  entrarNoServidor(escolhido);
}

function atualizarServidores() {
  SERVIDORES.forEach(acompanharExtras);
  mostrarTrocaDeServidor();
}

function acompanharExtras(cada) {
  const papel = papelEm(cada);
  const pendencias = Boolean(cada.acesso) && cada !== servidor && SERVIDORES.filter(s => s.acesso).length > 1;
  const chave = cada.acesso ? [papel.id, papel.admin, papel.dono, pendencias].join() : '';
  if (cada.extras === chave) return;
  cada.escutasExtras.forEach(parar => parar());
  Object.assign(cada, { escutasExtras: [], extras: chave, convites: [], pedidosDeEntrada: 0, doDono: null });
  if (pendencias && papel.id) {
    const convites = query(collection(cada.banco, 'duelos'), where('desafiado', '==', papel.id), where('situacao', '==', 'convite'));
    cada.escutasExtras.push(onSnapshot(convites, retrato => {
      cada.convites = retrato.docs.map(d => d.data({ serverTimestamps: 'estimate' }).criadoEm?.toDate?.() || new Date(0));
      mostrarTrocaDeServidor();
    }, () => {}));
  }
  if (pendencias && papel.admin) {
    cada.escutasExtras.push(onSnapshot(collection(cada.banco, 'pedidos'), retrato => {
      cada.pedidosDeEntrada = retrato.size;
      mostrarTrocaDeServidor();
    }, () => {}));
  }
  if (papel.dono) {
    cada.doDono = { acessos: [], jogadores: [], ultimosAcessos: [], pedidos: [] };
    for (const nome of Object.keys(cada.doDono)) {
      cada.escutasExtras.push(onSnapshot(collection(cada.banco, nome), retrato => {
        cada.doDono[nome] = retrato.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
        if (estado && telaVisivel === 'administracao' && !digitando()) mostrarAdministracao();
      }, () => {}));
    }
  }
}

function pendenciasDe(cada) {
  const valendo = cada.convites.filter(criadoEm => Date.now() - criadoEm.getTime() < PRAZO_DO_CONVITE).length;
  return valendo + cada.pedidosDeEntrada;
}

function mostrarTrocaDeServidor() {
  const outros = SERVIDORES.filter(cada => cada.acesso && cada !== servidor);
  const total = outros.reduce((soma, cada) => soma + pendenciasDe(cada), 0);
  document.querySelector('[data-item="servidores"]').hidden = !servidor || !outros.length;
  const selo = document.getElementById('selo-servidores');
  selo.hidden = !total;
  selo.textContent = total;
  if (!document.getElementById('salao').hidden) mostrarServidores();
}

function escutarDados() {
  const nomes = ['jogadores', 'jogos', 'partidas', 'premios', 'frases', 'fechamentos', 'duelos', ...(conta.admin ? ['pedidos'] : [])];
  // Nas partidas, escutar a confirmação do servidor: título só é anunciado depois que o placar gravou.
  escutasDosDados = nomes.map(nome => onSnapshot(collection(banco, nome), { includeMetadataChanges: nome === 'partidas' }, retrato => {
    lidos[nome] = retrato.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
    if (nome === 'partidas') lidos.partidasGravando = retrato.metadata.hasPendingWrites;
    if (!nomes.every(n => lidos[n])) return;
    receberEstado(montarEstado());
    completarFoto();
  }, falhaDeLeitura));
  registrarAcesso();
}

function registrarAcesso() {
  if (!conta?.id || document.visibilityState !== 'visible' || Date.now() - acessoRegistradoEm < INTERVALO_DO_ACESSO) return;
  acessoRegistradoEm = Date.now();
  setDoc(doc(banco, 'ultimosAcessos', conta.id), { em: serverTimestamp() }).catch(() => {});
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
    lancadoEm: new Map(Object.entries(p.lancadoEm || {}).map(([id, momento]) => [id, momento?.toDate?.()]).filter(([, momento]) => momento)),
  };
}

function montarEstado() {
  const meu = lidos.jogadores.find(j => j.id === conta.id);
  const jogadores = lidos.jogadores.filter(j => j.apelido).map(({ id, apelido, foto, titulo, moldura }) => ({ id, apelido, foto, titulo: titulo || '', moldura: moldura !== false }));
  return {
    mesAtual: mesDeHoje(),
    gravando: Boolean(lidos.partidasGravando),
    eu: {
      id: conta.id, apelido: meu?.apelido || '', foto: meu?.foto || '', titulo: meu?.titulo || '', moldura: meu?.moldura !== false,
      admin: conta.admin, dono: conta.dono, observador: !conta.id, vistos: Array.isArray(meu?.vistos) ? meu.vistos : [],
    },
    jogadores,
    jogos: lidos.jogos.map(({ id, nome, menorVence, semPlacar, capa }) => ({ id, nome, menorVence, semPlacar, capa: capa || '' })),
    partidas: lidos.partidas.map(comoPartida).sort((a, b) => a.abertaEm - b.abertaEm),
    premios: Object.fromEntries(lidos.premios.map(p => [p.id, p.texto])),
    frases: lidos.frases.map(({ mes, jogador: id, texto }) => ({ mes, jogador: id, texto })),
    duelos: lidos.duelos.map(d => ({
      id: d.id, desafiante: d.desafiante, desafiado: d.desafiado, jogo: d.jogo, provocacao: d.provocacao || '', situacao: d.situacao,
      criadoEm: d.criadoEm?.toDate?.() || new Date(0), respondidoEm: d.respondidoEm?.toDate?.() || null,
    })).sort((a, b) => b.criadoEm - a.criadoEm),
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
  let usuario;
  try {
    const resultado = await signInWithPopup(PRINCIPAL.auth, provedor);
    const { idToken, accessToken } = GoogleAuthProvider.credentialFromResult(resultado);
    usuario = resultado.user;
    mostrarEntrada('Abrindo o ginásio…');
    await Promise.all(SERVIDORES.slice(1).map(cada => signInWithCredential(cada.auth, GoogleAuthProvider.credential(idToken, accessToken))));
  } catch (erro) {
    if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(erro.code)) return;
    mostrarEntrada(erro.code === 'auth/popup-blocked'
      ? 'O navegador bloqueou a janela do Google. Toque no botão de novo.'
      : 'Não consegui entrar com o Google. Tente de novo.', 'google');
    return;
  }
  acompanharConta(usuario.email.toLowerCase());
}

function mostrarTela(nome) {
  document.querySelectorAll('[data-tela]').forEach(tela => { tela.hidden = tela.dataset.tela !== nome; });
  document.getElementById('abrir-menu').hidden = !TELAS[nome];
  document.getElementById('titulo-da-tela').textContent = TITULOS_DAS_TELAS[nome] || '';
  document.getElementById('abertura').hidden = !TITULOS_DAS_TELAS[nome];
  document.querySelector('.topo').classList.toggle('no-inicio', nome === 'inicio');
  if (nome !== 'entrada') document.getElementById('apresentacao').pause();
  if (nome !== 'nova-partida') document.getElementById('catalogo-jogos').close();
  if (nome !== telaVisivel) {
    window.scrollTo(0, 0);
    esquecerMesaEscolhida();
  }
  telaVisivel = nome;
}

function mostrarEntrada(mensagem, saida = null, aguardando = false) {
  const carregando = !saida && mensagem.endsWith('…');
  const aviso = document.getElementById('aviso-entrada');
  aviso.textContent = carregando ? mensagem.slice(0, -1) : mensagem;
  aviso.hidden = !mensagem;
  if (carregando) {
    const pontos = criar('span', 'pontos');
    pontos.append(criar('span', '', '.'), criar('span', '', '.'), criar('span', '', '.'));
    aviso.append(pontos);
  }
  const demora = document.getElementById('demora-entrada');
  const tentar = document.getElementById('tentar-de-novo');
  demora.hidden = true;
  clearTimeout(relogioDaEntrada);
  if (carregando) {
    relogioDaEntrada = setTimeout(() => {
      if (document.querySelector('[data-tela="entrada"]').hidden) return;
      demora.hidden = false;
      tentar.hidden = false;
    }, DEMORA_DA_ENTRADA);
  }
  document.getElementById('botao-google').hidden = saida !== 'google';
  document.getElementById('salao').hidden = true;
  tentar.hidden = saida !== 'tentar';
  document.getElementById('rodape-entrada').hidden = saida !== 'google' || aguardando;
  document.getElementById('video-entrada').hidden = saida !== 'google';
  const apresentacao = document.getElementById('apresentacao');
  if (saida === 'google') apresentacao.poster ||= apresentacao.dataset.poster;
  mostrarTela('entrada');
}

function aplicarEstado(novo) {
  estado = novo;
  const { eu } = estado;
  if (!eu.apelido && !eu.observador) {
    const foto = document.getElementById('previa-apelido-foto');
    foto.src = eu.foto || fotoDoGoogle() || avatarPadrao(eu);
    mostrarTela('apelido');
    return;
  }
  document.querySelectorAll('[data-mes]').forEach(el => { el.textContent = MESES[indiceDoMes(estado.mesAtual)]; });
  const perfil = document.querySelector('[data-item="perfil"]');
  perfil.textContent = eu.apelido;
  perfil.hidden = eu.observador;
  document.querySelector('[data-item="nova-partida"]').hidden = eu.observador;
  document.querySelector('[data-item="administracao"]').hidden = !eu.admin;
  renderizar();
}

const TITULOS_DAS_TELAS = {
  inicio: 'Início',
  ranking: 'Ranking',
  partida: 'Partida',
  'nova-partida': 'Nova partida',
  duelos: 'Duelos',
  perfil: 'Perfil',
  insignias: 'Insígnias',
  insignia: 'Insígnia',
  titulos: 'Títulos',
  titulo: 'Título',
  campeoes: 'Campeões',
  regras: 'Regras',
  administracao: 'Administração',
  servidores: 'Trocar servidor',
};

const TELAS = {
  inicio: mostrarInicio,
  duelos: mostrarDuelos,
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
  servidores: mostrarServidores,
};

function rotaAtual() {
  const [tela, parametro = ''] = location.hash.slice(1).split('/');
  const { eu } = estado;
  const fechada = (tela === 'administracao' && !eu.admin)
    || (tela === 'servidores' && SERVIDORES.filter(cada => cada.acesso).length < 2)
    || (eu.observador && (tela === 'nova-partida' || (tela === 'perfil' && !parametro)));
  if (!TELAS[tela] || fechada) return { tela: 'inicio', parametro: '' };
  return { tela, parametro: decodeURIComponent(parametro) };
}

function renderizar() {
  if (!estado || (!estado.eu.apelido && !estado.eu.observador)) return;
  const { tela, parametro } = rotaAtual();
  mostrarTela(tela);
  TELAS[tela](parametro);
  verificarAvisos();
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

  const previa = document.getElementById('previa-apelido-nome');
  campo.addEventListener('input', () => {
    campo.value = limparApelido(campo.value);
    botao.disabled = !campo.value;
    aviso.textContent = '';
    previa.textContent = campo.value || '???';
    previa.classList.toggle('vazio', !campo.value);
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
  await Promise.all(SERVIDORES.map(async cada => {
    await signOut(cada.auth).catch(() => {});
    await terminate(cada.banco).catch(() => {});
    await clearIndexedDbPersistence(cada.banco).catch(() => {});
  }));
  location.reload();
}

function ligarMenu() {
  const botoes = [...document.querySelectorAll('[aria-controls="menu"]')];
  const menu = document.getElementById('menu');
  const itensAtivos = () => [...menu.querySelectorAll('button:not([hidden])')];
  const acoes = { som: alternarSom, sair: sairDaConta };
  let botao = botoes[0];

  const alternar = aberto => {
    if (aberto) tocar('mover');
    const secao = { insignia: 'insignias', titulo: 'titulos' }[telaVisivel] || telaVisivel;
    const atual = menu.querySelector(`[data-item="${secao}"]`);
    menu.hidden = !aberto;
    botao.setAttribute('aria-expanded', aberto);
    (aberto ? atual || itensAtivos()[0] : botao).focus();
  };

  for (const cada of botoes) {
    cada.addEventListener('click', () => {
      botao = cada;
      alternar(menu.hidden);
    });
  }
  menu.addEventListener('click', e => {
    const item = e.target.closest('button');
    if (!item) return;
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
    if (!menu.hidden && !menu.contains(e.target) && !botoes.some(cada => cada.contains(e.target))) alternar(false);
  });
  document.addEventListener('click', e => {
    const atalho = e.target.closest('[data-ir]');
    if (atalho) irPara(atalho.dataset.ir);
  });
}

function ligarApresentacao() {
  const video = document.getElementById('apresentacao');
  const tocar = document.getElementById('tocar-apresentacao');
  tocar.addEventListener('click', () => {
    tocar.hidden = true;
    video.controls = true;
    video.play();
  });
}

function iniciar() {
  mostrarSom();
  ligarApresentacao();
  ligarMenu();
  ligarApelido();
  ligarPartida();
  ligarNovaPartida();
  ligarPerfil();
  ligarAdministracao();
  ligarDuelos();
  ligarRegras();
  ligarServidores();
  document.getElementById('botao-google').addEventListener('click', entrarComGoogle);
  window.addEventListener('hashchange', renderizar);
  window.addEventListener('resize', encaixarTopoDoPerfil);
  document.addEventListener('visibilitychange', registrarAcesso);
  document.addEventListener('focusout', () => setTimeout(() => {
    if (!digitando()) aplicarEstadoEmEspera();
  }));
  try { localStorage.removeItem('ginasio.token'); } catch {}
  try { indexedDB.deleteDatabase(`firestore/[DEFAULT]/${PRINCIPAL.firebase.projectId}/main`); } catch {}
  iniciarSessao();
}

export {
  SERVIDORES, PRINCIPAL, email, servidor, banco, lidos, estado, telaVisivel, trocarDeServidor, pendenciasDe, aplicarEstadoEmEspera, entrarComGoogle,
  mostrarEntrada, rotaAtual, renderizar, irPara,
};

iniciar();
