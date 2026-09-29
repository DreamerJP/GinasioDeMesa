const SERVIDOR = 'https://script.google.com/macros/s/AKfycbzYLpiPppzfMLWMTQuQ7R5EkBud4oeGGqdxV4fM5p9KmPGnUqMQiesW9eN-ml-U_Biq/exec';
const CLIENTE_GOOGLE = '777149850301-ht36a0eodiaqs0398l5qgoaoeglteajg.apps.googleusercontent.com';
const CHAVE_TOKEN = 'ginasio.token';
const CHAVE_SOM = 'ginasio.som';
const MARGEM_DA_ENTRADA = 5 * 60000;
const ESPERA_DA_RENOVACAO = 15000;
const KATEX = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/';
const LIMITE_FOTO = 45000;
const LADO_FOTO = 160;
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
  { nome: 'Insígnia do Canto', trecho: 'Mar de verão' },
  { nome: 'Insígnia do Trovão', trecho: 'Tempestade de verão' },
  { nome: 'Insígnia da Maré', trecho: 'Praia no fim do verão' },
  { nome: 'Insígnia do Vento', trecho: 'Planície dos ventos' },
  { nome: 'Insígnia da Teia', trecho: 'Bosque das teias' },
  { nome: 'Insígnia da Lã', trecho: 'Pasto de nuvens' },
  { nome: 'Insígnia da Geada', trecho: 'Campos de gelo' },
  { nome: 'Insígnia do Cume', trecho: 'Pico da montanha' },
  { nome: 'Insígnia do Leque', trecho: 'Vale do canto' },
  { nome: 'Insígnia da Flor', trecho: 'Jardim de espinhos' },
  { nome: 'Insígnia da Estrela', trecho: 'Árvore das estrelas' },
  { nome: 'Insígnia dos Confins', trecho: 'Confins do mapa' },
].map((insignia, i) => ({ ...insignia, imagem: `midia/insignia-${String(i + 1).padStart(2, '0')}.webp` }));

const CASAS_DA_NOTA = 3;
const formatoNota = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: CASAS_DA_NOTA, maximumFractionDigits: CASAS_DA_NOTA });
const formatoPlacar = new Intl.NumberFormat('pt-BR');

let token = null;
let estado = null;
let telaVisivel = '';
let partidaAberta = '';
let jogoEscolhido = '';
let selecao = null;
let conviteDeFraseFeito = false;
let carregamentoKatex = null;
let renovacaoPendente = null;
let esperaDaRenovacao = null;
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

function dataCurta(momento) {
  const partes = momento.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return partes ? `${partes[2]}/${partes[1]} ${partes[3]}:${partes[4]}` : '';
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

function fotoDe(alguem) {
  return alguem?.foto || avatarPadrao(alguem?.apelido || '?');
}

function imagemDe(alguem, classe) {
  const imagem = criar('img', classe);
  imagem.alt = '';
  imagem.referrerPolicy = 'no-referrer';
  imagem.src = fotoDe(alguem);
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

async function chamar(acao, dados, repeticao = false) {
  if (token && expiracaoDoToken(token) - Date.now() < MARGEM_DA_ENTRADA) await renovarEntrada().catch(() => {});
  let corpo;
  try {
    const resposta = await fetch(SERVIDOR, { method: 'POST', body: JSON.stringify({ acao, token, dados }) });
    corpo = await resposta.json();
  } catch {
    throw Object.assign(new Error('Não consegui falar com a planilha. Confira a internet e tente de novo.'), { codigo: 'rede' });
  }
  if (!corpo.ok && corpo.codigo === 'token' && !repeticao) {
    const renovou = await renovarEntrada().then(() => true, () => false);
    if (renovou) return chamar(acao, dados, true);
  }
  if (!corpo.ok) throw Object.assign(new Error(corpo.erro), { codigo: corpo.codigo });
  return corpo.dados;
}

function renovarEntrada() {
  if (!window.google?.accounts?.id) return Promise.reject(new Error('Entrada do Google indisponível.'));
  renovacaoPendente ??= new Promise((resolver, rejeitar) => {
    let terminou = false;
    const encerrar = sucesso => {
      if (terminou) return;
      terminou = true;
      clearTimeout(limite);
      renovacaoPendente = null;
      esperaDaRenovacao = null;
      if (sucesso) resolver();
      else rejeitar(new Error('A entrada não foi renovada.'));
    };
    const limite = setTimeout(() => encerrar(false), ESPERA_DA_RENOVACAO);
    esperaDaRenovacao = encerrar;
    google.accounts.id.prompt(momento => {
      const pulou = momento.isSkippedMoment?.();
      const fechou = momento.isDismissedMoment?.() && momento.getDismissedReason?.() !== 'credential_returned';
      if (pulou || fechou) encerrar(false);
    });
  });
  return renovacaoPendente;
}

async function enviar(botao, aviso, acao, dados, somDoSucesso = 'confirmar') {
  const texto = botao.textContent;
  botao.disabled = true;
  botao.textContent = 'Salvando…';
  aviso.textContent = '';
  try {
    aplicarEstado(await chamar(acao, dados));
    tocar(typeof somDoSucesso === 'function' ? somDoSucesso() : somDoSucesso);
    return true;
  } catch (erro) {
    tocar('erro');
    tratarFalha(erro, mensagem => { aviso.textContent = mensagem; });
    return false;
  } finally {
    if (botao.textContent === 'Salvando…') {
      botao.textContent = texto;
      botao.disabled = false;
    }
  }
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

function tratarFalha(erro, avisar) {
  if (['token', 'nao-liberado'].includes(erro.codigo)) {
    guardarToken(null);
    window.google?.accounts.id.disableAutoSelect();
    mostrarEntrada(erro.message, 'google');
  } else if (erro.codigo === 'pendente') {
    guardarToken(null);
    window.google?.accounts.id.disableAutoSelect();
    mostrarEntrada(erro.message);
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
  const venceu = ultimo && campeoesDe(ultimo).some(l => l.id === estado.eu.id);
  const escreveu = estado.frases.some(f => f.mes === ultimo && f.jogador === estado.eu.id);
  if (!venceu || escreveu) return false;
  tocar('campeao');
  irPara('campeoes');
  return true;
}

async function carregar() {
  mostrarEntrada('Abrindo o ginásio…');
  try {
    aplicarEstado(await chamar('estado'));
  } catch (erro) {
    tratarFalha(erro, mensagem => mostrarEntrada(mensagem, 'tentar'));
  }
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
  item.querySelector('.foto').src = fotoDe(alguem);
  item.querySelector('.apelido').textContent = alguem.apelido;
  item.querySelector('.nota').textContent = principal;
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
  return linhaDoRanking(linha.id, linha.posicao, formatoNota.format(1 + linha.nota), `${linha.partidas} de ${total} partidas`, linha.nota);
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
  document.getElementById('premio-insignia-imagem').replaceChildren(desenhoDaInsignia(indice, 1));

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
  const podio = total ? linhas.filter(l => l.posicao <= 3).map(l => linhaDoMes(l, total)) : [criar('li', 'detalhe', 'Nenhuma partida neste mês ainda.')];
  document.getElementById('inicio-podio').replaceChildren(...podio);

  const geral = rankingGeral();
  const proximo = MESES[(indice + 1) % 12];
  document.getElementById('ranking-geral').replaceChildren(...(geral.length
    ? geral.map(l => linhaDoRanking(
      l.id,
      l.posicao,
      `${l.insignias} ${l.insignias === 1 ? 'insígnia' : 'insígnias'}`,
      `${l.podios} ${l.podios === 1 ? 'vez' : 'vezes'} entre os 3 primeiros`,
    ))
    : [criar('li', 'detalhe', `Nenhum mês fechou ainda. O primeiro entra aqui em 1º de ${proximo}.`)]));
}

function mostrarRanking() {
  const { mesAtual, partidas } = estado;
  const doMes = partidas.filter(p => p.mes === mesAtual);
  const { linhas, total } = rankingDe(mesAtual);
  document.getElementById('total-partidas').textContent = `${total} ${total === 1 ? 'partida' : 'partidas'} no mês`;
  document.getElementById('ranking').replaceChildren(...linhas.map(l => linhaDoMes(l, total)));

  const itens = [...doMes].reverse().map(partida => {
    const botao = criar('button', 'item-partida');
    botao.type = 'button';
    botao.append(
      criar('span', '', jogoDe(partida).nome),
      criar('span', 'detalhe', partida.abertaPor ? dataCurta(partida.abertaEm) : ''),
      criar('span', 'detalhe item-resumo', resumoDaPartida(partida)),
    );
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
      valor.append(criar('span', 'detalhe', `nota ${formatoNota.format(1 + notas.get(s.jogador))}`));
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
  const semPlacar = jogoSelecionado()?.semPlacar;
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

  nome.addEventListener('input', () => { salvarJogo.disabled = nome.value.trim().length < 2; });
  semPlacar.addEventListener('change', () => {
    menorVence.disabled = semPlacar.checked;
    if (semPlacar.checked) menorVence.checked = false;
  });

  formJogo.addEventListener('submit', async evento => {
    evento.preventDefault();
    const dados = { nome: nome.value.trim(), menorVence: menorVence.checked, semPlacar: semPlacar.checked };
    if (await enviar(salvarJogo, document.getElementById('aviso-jogo'), 'cadastrarJogo', dados)) {
      jogoEscolhido = estado.jogos.at(-1)?.id || '';
      formJogo.reset();
      menorVence.disabled = false;
      formJogo.hidden = true;
      mostrarNovaPartida();
    }
    salvarJogo.disabled = nome.value.trim().length < 2;
  });

  const formPartida = document.getElementById('form-partida');
  formPartida.addEventListener('submit', async evento => {
    evento.preventDefault();
    const jogo = jogoSelecionado();
    if (!jogo || selecao.length < 3) return;
    const dados = { jogo: jogo.id, participantes: selecao, ordem: jogo.semPlacar ? selecao : undefined };
    const abriu = await enviar(formPartida.querySelector('.botao'), document.getElementById('aviso-partida'), 'abrirPartida', dados, jogo.semPlacar ? 'partidaFechada' : 'confirmar');
    if (!abriu) {
      desenharFichas();
      return;
    }
    const nova = estado.partidas.filter(p => p.abertaPor === estado.eu.id).at(-1);
    selecao = null;
    jogoEscolhido = '';
    irPara(nova ? 'partida' : 'inicio', nova?.id);
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
  document.getElementById('perfil-foto').src = fotoDe(alguem);
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

async function fotoReduzida(arquivo) {
  let imagem;
  try {
    imagem = await createImageBitmap(arquivo);
  } catch {
    throw new Error('Não consegui abrir essa imagem. Tente uma foto JPG ou PNG.');
  }
  const lado = Math.min(imagem.width, imagem.height);
  const quadro = document.createElement('canvas');
  quadro.width = LADO_FOTO;
  quadro.height = LADO_FOTO;
  quadro.getContext('2d').drawImage(imagem, (imagem.width - lado) / 2, (imagem.height - lado) / 2, lado, lado, 0, 0, LADO_FOTO, LADO_FOTO);
  for (const qualidade of [0.85, 0.7, 0.55, 0.4]) {
    const dados = quadro.toDataURL('image/jpeg', qualidade);
    if (dados.length <= LIMITE_FOTO) return dados;
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
  const vezes = vezesPorInsignia(conquistas().get(estado.eu.id));
  document.getElementById('grade-insignias').replaceChildren(...INSIGNIAS.map((insignia, i) => {
    const botao = criar('button', 'botao-insignia');
    botao.type = 'button';
    botao.append(desenhoDaInsignia(i, vezes[i]), criar('span', '', insignia.nome), criar('span', 'detalhe', MESES[i]));
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
  const { trecho, nome } = INSIGNIAS[indice];
  const todas = conquistas();
  const minhas = vezesPorInsignia(todas.get(estado.eu.id))[indice];
  const donos = [...todas]
    .map(([id, meses]) => [jogador(id), meses.filter(m => indiceDoMes(m) === indice).map(m => m.slice(0, 4))])
    .filter(([alguem, anos]) => alguem && anos.length);

  document.getElementById('insignia-imagem').replaceChildren(desenhoDaInsignia(indice, minhas, true));
  document.getElementById('insignia-nome').textContent = nome;
  document.getElementById('insignia-trecho').textContent = `${trecho}, ${MESES[indice]}`;
  document.getElementById('insignia-texto').textContent = `${nome}. Entregue a quem fecha ${MESES[indice]} no topo do Ginásio.`;
  document.getElementById('insignia-donos').textContent = donos.length
    ? `Quem tem: ${donos.map(([alguem, anos]) => `${alguem.apelido} (${anos.join(', ')})`).join(', ')}`
    : 'Ninguém tem esta insígnia ainda.';
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
  lista.replaceChildren(...meses.map(cartaoDeCampeao));
}

function cartaoDeCampeao(mes) {
  const campeoes = campeoesDe(mes);
  const cartao = criar('section', 'caixa campeao');
  cartao.append(criar('h2', 'rotulo', nomeDoMes(mes)));

  for (const linha of campeoes) {
    const alguem = jogador(linha.id);
    const pessoa = criar('div', 'campeao-pessoa');
    const dados = criar('div');
    dados.append(criar('p', 'perfil-apelido', alguem.apelido), criar('p', 'detalhe', `Nota do mês ${formatoNota.format(1 + linha.nota)}`));
    pessoa.append(imagemDe(alguem, 'foto-grande'), dados);
    cartao.append(pessoa);
    const frase = estado.frases.find(f => f.mes === mes && f.jogador === linha.id);
    if (frase) cartao.append(criar('p', 'frase', `“${frase.texto}”`));
  }

  cartao.append(criar('p', 'detalhe', `Prêmio: ${estado.premios[mes] || 'não registrado'}`));

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
    const recusar = criar('button', 'botao-texto', 'Recusar pedido');
    const aviso = criar('p', 'aviso');
    const linhaCampo = criar('div', 'linha-campo');
    escolha.setAttribute('aria-label', `De quem é a conta ${pedido.email}`);
    escolha.append(...opcoesDeVinculo());
    aprovar.addEventListener('click', () => enviar(aprovar, aviso, 'aprovarPedido', { pedido: pedido.id, jogador: escolha.value || undefined }));
    recusar.addEventListener('click', () => enviar(recusar, aviso, 'recusarPedido', { pedido: pedido.id }));
    linhaCampo.append(escolha, aprovar);
    item.append(criar('span', '', pedido.nome || pedido.email), criar('span', 'detalhe', pedido.email), linhaCampo, recusar, aviso);
    return item;
  }));

  const ordenados = [...liberados].sort((a, b) => Boolean(b.email) - Boolean(a.email));
  document.getElementById('lista-acessos').replaceChildren(...ordenados.map(l => {
    const item = criar('li');
    item.append(criar('span', l.email ? '' : 'detalhe', l.email || 'sem e-mail'), criar('span', l.apelido ? '' : 'detalhe', l.apelido || 'ainda não entrou'));
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

function sairDaConta() {
  guardarToken(null);
  estado = null;
  conviteDeFraseFeito = false;
  history.replaceState(null, '', location.pathname);
  window.google?.accounts.id.disableAutoSelect();
  mostrarEntrada('Entre com a conta Google que o administrador liberou.', 'google');
}

function ligarMenu() {
  const botao = document.getElementById('abrir-menu');
  const menu = document.getElementById('menu');
  const itensAtivos = () => [...menu.querySelectorAll('button:not([hidden])')];
  const acoes = { som: alternarSom, sair: sairDaConta, fechar: () => {} };

  const alternar = aberto => {
    if (aberto) tocar('mover');
    menu.hidden = !aberto;
    botao.setAttribute('aria-expanded', aberto);
    const atual = menu.querySelector(`[data-item="${telaVisivel === 'insignia' ? 'insignias' : telaVisivel}"]`);
    (aberto ? atual || itensAtivos()[0] : botao).focus();
  };

  botao.addEventListener('click', () => alternar(menu.hidden));
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
    if (!menu.hidden && !menu.contains(e.target) && !botao.contains(e.target)) alternar(false);
  });
  document.addEventListener('click', e => {
    const atalho = e.target.closest('[data-ir]');
    if (atalho) irPara(atalho.dataset.ir);
  });
}

function iniciarGoogle() {
  google.accounts.id.initialize({
    client_id: CLIENTE_GOOGLE,
    callback: ({ credential }) => {
      guardarToken(credential);
      if (esperaDaRenovacao) esperaDaRenovacao(true);
      else carregar();
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
  mostrarItemDeSom();
  ligarMenu();
  ligarApelido();
  ligarPartida();
  ligarNovaPartida();
  ligarPerfil();
  ligarAdministracao();
  document.getElementById('tentar-de-novo').addEventListener('click', carregar);
  window.addEventListener('hashchange', renderizar);

  token = tokenGuardado();
  if (token) carregar();
  else mostrarEntrada('Abrindo o ginásio…');

  if (window.google?.accounts?.id) iniciarGoogle();
  else window.onGoogleLibraryLoad = iniciarGoogle;
}

iniciar();
