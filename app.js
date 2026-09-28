const SERVIDOR = 'https://script.google.com/macros/s/AKfycbzYLpiPppzfMLWMTQuQ7R5EkBud4oeGGqdxV4fM5p9KmPGnUqMQiesW9eN-ml-U_Biq/exec';
const CLIENTE_GOOGLE = '777149850301-ht36a0eodiaqs0398l5qgoaoeglteajg.apps.googleusercontent.com';
const CHAVE_TOKEN = 'ginasio.token';
const TELAS_COM_MENU = ['ranking'];

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const INSIGNIAS = [
  { bicho: 'Onça-pintada', nome: 'Insígnia da Garra' },
  { bicho: 'Arara-azul', nome: 'Insígnia da Pena' },
  { bicho: 'Tatu-bola', nome: 'Insígnia da Couraça' },
  { bicho: 'Capivara', nome: 'Insígnia da Calma' },
  { bicho: 'Tucano', nome: 'Insígnia do Bico' },
  { bicho: 'Coruja-buraqueira', nome: 'Insígnia da Noite' },
  { bicho: 'Lobo-guará', nome: 'Insígnia da Juba' },
  { bicho: 'Jararaca', nome: 'Insígnia do Bote' },
  { bicho: 'Mico-leão-dourado', nome: 'Insígnia do Salto' },
  { bicho: 'Jacaré', nome: 'Insígnia da Mordida' },
  { bicho: 'Piranha', nome: 'Insígnia do Dente' },
  { bicho: 'Harpia', nome: 'Insígnia da Asa' },
];

const CASAS_DA_NOTA = 3;
const formatoNota = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: CASAS_DA_NOTA, maximumFractionDigits: CASAS_DA_NOTA });

let token = null;
let estado = null;

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
  const acumulado = new Map(jogadores.map(id => [id, { soma: 0, partidas: 0 }]));
  for (const partida of partidas) {
    for (const [id, nota] of notasDaPartida(partida)) {
      const jogador = acumulado.get(id);
      if (!jogador) continue;
      jogador.soma += nota;
      jogador.partidas++;
    }
  }

  const total = partidas.length;
  const linhas = jogadores
    .map(id => {
      const { soma, partidas: jogadas } = acumulado.get(id);
      return { id, nota: total ? soma / total : 0, partidas: jogadas };
    })
    .sort((a, b) => b.nota - a.nota);

  const exibida = nota => nota.toFixed(CASAS_DA_NOTA);
  linhas.forEach((linha, i) => {
    const empatado = i > 0 && exibida(linhas[i - 1].nota) === exibida(linha.nota);
    linha.posicao = empatado ? linhas[i - 1].posicao : i + 1;
  });
  return { linhas, total };
}

function partidaParaFormula(partida, jogoPorId) {
  const jogo = jogoPorId.get(partida.jogo) || {};
  return {
    menorVence: jogo.menorVence,
    semPlacar: jogo.semPlacar,
    resultados: Object.fromEntries(partida.placares.map(s => [s.jogador, s.valor])),
  };
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

function textoFechamento(mesAtual, hoje = new Date()) {
  const [ano, mes] = mesAtual.split('-').map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const faltam = ultimoDia - hoje.getDate();
  if (faltam <= 0) return 'Fecha hoje à meia-noite';
  if (faltam === 1) return `Fecha amanhã, dia ${ultimoDia}`;
  return `Fecha em ${faltam} dias, dia ${ultimoDia}`;
}

async function chamar(acao, dados) {
  let corpo;
  try {
    const resposta = await fetch(SERVIDOR, { method: 'POST', body: JSON.stringify({ acao, token, dados }) });
    corpo = await resposta.json();
  } catch {
    throw Object.assign(new Error('Não consegui falar com a planilha. Confira a internet e tente de novo.'), { codigo: 'rede' });
  }
  if (!corpo.ok) throw Object.assign(new Error(corpo.erro), { codigo: corpo.codigo });
  return corpo.dados;
}

function expiracaoDoToken(jwt) {
  try {
    return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000;
  } catch {
    return 0;
  }
}

function tokenGuardado() {
  try {
    const valor = localStorage.getItem(CHAVE_TOKEN);
    return valor && expiracaoDoToken(valor) > Date.now() + 60000 ? valor : null;
  } catch {
    return null;
  }
}

function guardarToken(valor) {
  token = valor;
  try {
    if (valor) localStorage.setItem(CHAVE_TOKEN, valor);
    else localStorage.removeItem(CHAVE_TOKEN);
  } catch {}
}

function mostrarTela(nome) {
  document.querySelectorAll('[data-tela]').forEach(tela => { tela.hidden = tela.dataset.tela !== nome; });
  document.getElementById('abrir-menu').hidden = !TELAS_COM_MENU.includes(nome);
}

function mostrarEntrada(mensagem, saida = null) {
  document.getElementById('aviso-entrada').textContent = mensagem;
  document.getElementById('botao-google').hidden = saida !== 'google';
  document.getElementById('tentar-de-novo').hidden = saida !== 'tentar';
  mostrarTela('entrada');
}

function tratarFalha(erro, avisar) {
  if (erro.codigo === 'token' || erro.codigo === 'nao-liberado') {
    guardarToken(null);
    window.google?.accounts.id.disableAutoSelect();
    mostrarEntrada(erro.message, 'google');
  } else if (erro.codigo === 'sem-apelido') {
    mostrarTela('apelido');
  } else {
    avisar(erro.message);
  }
}

function aplicarEstado(novo) {
  estado = novo;
  if (!estado.eu.apelido) {
    mostrarTela('apelido');
    return;
  }
  mostrarRanking();
  mostrarTela('ranking');
}

async function carregar() {
  mostrarEntrada('Abrindo o ginásio…');
  try {
    aplicarEstado(await chamar('estado'));
  } catch (erro) {
    tratarFalha(erro, mensagem => mostrarEntrada(mensagem, 'tentar'));
  }
}

function mostrarRanking() {
  const { mesAtual, eu, jogadores, jogos, partidas, premios } = estado;
  const indiceMes = Number(mesAtual.slice(5)) - 1;
  const jogadorPorId = new Map(jogadores.map(j => [j.id, j]));
  const jogoPorId = new Map(jogos.map(j => [j.id, j]));
  const doMes = partidas.filter(p => p.mes === mesAtual);

  document.querySelectorAll('[data-mes]').forEach(el => { el.textContent = MESES[indiceMes]; });
  document.getElementById('premio-texto').textContent = premios[mesAtual] || 'O administrador ainda não definiu.';
  document.getElementById('premio-insignia').textContent = INSIGNIAS[indiceMes].nome;
  document.getElementById('premio-fecha').textContent = textoFechamento(mesAtual);
  document.querySelector('[data-item="perfil"]').textContent = eu.apelido;

  const pendentes = doMes.filter(p => p.estado === 'aberta' && p.placares.some(s => s.jogador === eu.id && s.valor === null));
  document.getElementById('pendente').hidden = !pendentes.length;
  if (pendentes.length) {
    const [primeira] = pendentes;
    const lancados = primeira.placares.filter(s => s.valor !== null).length;
    const outras = pendentes.length > 1 ? `. Mais ${pendentes.length - 1} esperando o seu placar` : '';
    document.getElementById('pendente-autor').textContent = jogadorPorId.get(primeira.abertaPor)?.apelido || 'Alguém';
    document.getElementById('pendente-jogo').textContent = jogoPorId.get(primeira.jogo)?.nome || 'uma partida';
    document.getElementById('pendente-progresso').textContent = `${lancados} de ${primeira.placares.length} já lançaram${outras}`;
  }

  const fechadas = doMes.filter(p => p.estado === 'fechada').map(p => partidaParaFormula(p, jogoPorId));
  const { linhas, total } = rankingDoMes(jogadores.map(j => j.id), fechadas);
  document.getElementById('total-partidas').textContent = `${total} ${total === 1 ? 'partida' : 'partidas'} no mês`;

  const modelo = document.getElementById('modelo-linha').content.firstElementChild;
  document.getElementById('ranking').replaceChildren(...linhas.map(linha => {
    const jogador = jogadorPorId.get(linha.id);
    const item = modelo.cloneNode(true);
    const barra = item.querySelector('.barra');
    item.dataset.posicao = linha.posicao;
    if (linha.id === eu.id) item.dataset.eu = '';
    item.querySelector('.posicao').textContent = `${linha.posicao}º`;
    item.querySelector('.foto').src = jogador.foto || avatarPadrao(jogador.apelido);
    item.querySelector('.apelido').textContent = jogador.apelido;
    item.querySelector('.nota').textContent = formatoNota.format(linha.nota);
    barra.setAttribute('aria-valuenow', linha.nota.toFixed(CASAS_DA_NOTA));
    barra.firstElementChild.style.width = `${linha.nota * 100}%`;
    item.querySelector('.partidas').textContent = `${linha.partidas} de ${total} partidas`;
    return item;
  }));
}

function ligarApelido() {
  const formulario = document.getElementById('form-apelido');
  const campo = document.getElementById('campo-apelido');
  const botao = formulario.querySelector('button');
  const aviso = document.getElementById('aviso-apelido');

  campo.addEventListener('input', () => {
    campo.value = campo.value.toUpperCase().replace(/[^\p{L}\p{N}]/gu, '').slice(0, 8);
    botao.disabled = !campo.value;
    aviso.textContent = '';
  });

  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    botao.disabled = true;
    aviso.textContent = 'Salvando…';
    try {
      aplicarEstado(await chamar('definirPerfil', { apelido: campo.value }));
      aviso.textContent = '';
    } catch (erro) {
      tratarFalha(erro, mensagem => {
        aviso.textContent = mensagem;
        botao.disabled = false;
      });
    }
  });
}

function sairDaConta() {
  guardarToken(null);
  estado = null;
  window.google?.accounts.id.disableAutoSelect();
  mostrarEntrada('Entre com a conta Google que o administrador liberou.', 'google');
}

function ligarMenu() {
  const botao = document.getElementById('abrir-menu');
  const menu = document.getElementById('menu');
  const itensAtivos = () => [...menu.querySelectorAll('button:not(:disabled)')];
  const acoes = { ranking: () => mostrarTela('ranking'), sair: sairDaConta };

  const alternar = aberto => {
    menu.hidden = !aberto;
    botao.setAttribute('aria-expanded', aberto);
    (aberto ? itensAtivos()[0] : botao).focus();
  };

  botao.addEventListener('click', () => alternar(menu.hidden));
  menu.addEventListener('click', e => {
    const item = e.target.closest('button:not(:disabled)');
    if (!item) return;
    alternar(false);
    acoes[item.dataset.item]?.();
  });
  menu.addEventListener('pointerover', e => e.target.closest('button:not(:disabled)')?.focus());
  menu.addEventListener('keydown', e => {
    const itens = itensAtivos();
    const atual = itens.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') itens[(atual + 1) % itens.length].focus();
    else if (e.key === 'ArrowUp') itens[(atual - 1 + itens.length) % itens.length].focus();
    else if (e.key === 'Escape') alternar(false);
    else return;
    e.preventDefault();
  });
  document.addEventListener('pointerdown', e => {
    if (!menu.hidden && !menu.contains(e.target) && !botao.contains(e.target)) alternar(false);
  });
}

function iniciarGoogle() {
  google.accounts.id.initialize({
    client_id: CLIENTE_GOOGLE,
    callback: ({ credential }) => {
      guardarToken(credential);
      carregar();
    },
    auto_select: true,
    use_fedcm_for_prompt: true,
  });
  google.accounts.id.renderButton(document.getElementById('botao-google'), {
    theme: 'filled_black', size: 'large', text: 'signin_with', locale: 'pt-BR',
  });
  if (!token) {
    mostrarEntrada('Entre com a conta Google que o administrador liberou.', 'google');
    google.accounts.id.prompt();
  }
}

function iniciar() {
  ligarMenu();
  ligarApelido();
  document.getElementById('tentar-de-novo').addEventListener('click', carregar);

  if (SERVIDOR.startsWith('COLE_AQUI')) {
    mostrarEntrada('A planilha ainda não foi ligada a este site.');
    return;
  }

  token = tokenGuardado();
  if (token) carregar();
  else mostrarEntrada('Abrindo o ginásio…');

  if (window.google?.accounts?.id) iniciarGoogle();
  else window.onGoogleLibraryLoad = iniciarGoogle;
}

iniciar();
