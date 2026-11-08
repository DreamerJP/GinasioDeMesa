import { doc, updateDoc, arrayRemove } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {
  tocar, jogoDe, jogador, nomeDoMes, avisosVistos, marcarComoVisto, formatoDiaDaMesa, formatoDiaCurto, criar, imagemDaCapa, imagemDe,
} from './base.js?v=102';
import { ACOES, enviar } from './acoes.js?v=102';
import { lugaresDaPartida } from './ranking.js?v=102';
import { quantidade } from './titulos.js?v=102';
import { PRAZO_DO_RESULTADO, abrirConquista } from './avisos.js?v=102';
import { banco, estado, irPara } from './app.js?v=102';

const PRAZO_DO_CONVITE = 7 * 864e5;
const PRAZO_DO_DUELO = 14 * 864e5;
const LIMITE_DE_DUELOS = 3;
const DUELOS_EM_ANDAMENTO = ['convite', 'valendo', 'em jogo'];
const DUELOS_TERMINADOS = ['decidido', 'recusado', 'expirado', 'sem jogo'];

let duelosCalculados = { estado: null, valor: null };
let desafio = { jogador: '', jogo: '' };
let mesDosDuelos = '';
let mesCompleto = false;

function participa(partida, id) {
  return partida.placares.some(s => s.jogador === id);
}

function envolve(duelo, id) {
  return duelo.desafiante === id || duelo.desafiado === id;
}

function situacaoDoDuelo(duelo) {
  const agora = Date.now();
  const comJogo = { ...duelo, jogoDoDuelo: jogoDe(duelo) };
  if (duelo.situacao === 'convite') {
    const ate = new Date(duelo.criadoEm.getTime() + PRAZO_DO_CONVITE);
    return { ...comJogo, ate, fase: agora > ate.getTime() ? 'expirado' : 'convite' };
  }
  if (duelo.situacao !== 'aceito' || !duelo.respondidoEm) return { ...comJogo, fase: duelo.situacao };
  const aceitoEm = duelo.respondidoEm.getTime();
  const ate = new Date(aceitoEm + PRAZO_DO_DUELO);
  if (duelo.decididoEm) return { ...comJogo, ate, fase: 'decidido' };
  const partida =estado.partidas.find(p => p.jogo === duelo.jogo && p.abertaEm.getTime() > aceitoEm && p.abertaEm <= ate
    && participa(p, duelo.desafiante) && participa(p, duelo.desafiado) && (p.estado === 'fechada' || p.mes === estado.mesAtual));
  if (!partida) return { ...comJogo, ate, fase: agora > ate.getTime() ? 'sem jogo' : 'valendo' };
  if (partida.estado === 'aberta') return { ...comJogo, ate, partida, fase: 'em jogo' };
  const lugares = lugaresDaPartida(partida);
  const [doDesafiante, doDesafiado] = [lugares.get(duelo.desafiante), lugares.get(duelo.desafiado)];
  let vencedor = '';
  if (doDesafiante !== doDesafiado) vencedor = doDesafiante < doDesafiado ? duelo.desafiante : duelo.desafiado;
  return { ...comJogo, ate, partida, lugares, vencedor, fase: 'decidido' };
}

function fimDoDuelo(duelo) {
  if (DUELOS_EM_ANDAMENTO.includes(duelo.fase)) return Infinity;
  return momentoDoDuelo(duelo);
}

function repetido(duelo, todos) {
  return todos.some(outro => outro !== duelo && envolve(outro, duelo.desafiante) && envolve(outro, duelo.desafiado)
    && (outro.criadoEm - duelo.criadoEm || outro.id.localeCompare(duelo.id)) < 0 && duelo.criadoEm.getTime() < fimDoDuelo(outro));
}

function duelosDoGinasio() {
  if (duelosCalculados.estado !== estado) {
    const todos = estado.duelos.map(situacaoDoDuelo);
    duelosCalculados = { estado, valor: todos.filter(d => !repetido(d, todos)) };
  }
  return duelosCalculados.valor;
}

function duelosEmAndamento(id) {
  return duelosDoGinasio().filter(d => DUELOS_EM_ANDAMENTO.includes(d.fase) && envolve(d, id));
}

function motivoParaNaoDesafiar(id) {
  const alguem = jogador(id);
  const meus = duelosEmAndamento(estado.eu.id);
  if (meus.some(d => envolve(d, id))) return `Você e ${alguem.apelido} já têm um duelo em andamento.`;
  if (meus.length >= LIMITE_DE_DUELOS) return `Você já tem ${LIMITE_DE_DUELOS} duelos em andamento.`;
  if (duelosEmAndamento(id).length >= LIMITE_DE_DUELOS) return `${alguem.apelido} já tem ${LIMITE_DE_DUELOS} duelos em andamento.`;
  return '';
}

function placarDeDuelos(id, contra = '') {
  const decididos = duelosDoGinasio().filter(d => d.fase === 'decidido' && envolve(d, id) && (!contra || envolve(d, contra)));
  return {
    vitorias: decididos.filter(d => d.vencedor === id).length,
    derrotas: decididos.filter(d => d.vencedor && d.vencedor !== id).length,
    empates: decididos.filter(d => !d.vencedor).length,
  };
}

function momentoDoDuelo(duelo) {
  if (duelo.fase === 'sem jogo' || duelo.fase === 'expirado') return duelo.ate.getTime();
  return (duelo.partida?.abertaEm || duelo.decididoEm || duelo.respondidoEm || duelo.criadoEm).getTime();
}

function nomeNoDuelo(id, comecaFrase = true) {
  if (id === estado.eu.id) return comecaFrase ? 'Você' : 'você';
  return jogador(id)?.apelido || '?';
}

function tituloDoDuelo(duelo) {
  const { eu } = estado;
  const [quemDesafiou, quemFoiDesafiado] = [nomeNoDuelo(duelo.desafiante), nomeNoDuelo(duelo.desafiado, false)];
  if (duelo.fase === 'convite') return `${quemDesafiou} desafiou ${quemFoiDesafiado}`;
  if (duelo.fase === 'recusado') {
    const quemRecusou = nomeNoDuelo(duelo.desafiado);
    return duelo.desafiante === eu.id ? `${quemRecusou} recusou o seu desafio` : `${quemRecusou} recusou o desafio de ${nomeNoDuelo(duelo.desafiante, false)}`;
  }
  if (duelo.fase === 'expirado') {
    const quemNaoRespondeu = nomeNoDuelo(duelo.desafiado);
    return duelo.desafiante === eu.id ? `${quemNaoRespondeu} não respondeu ao seu desafio` : `${quemNaoRespondeu} não respondeu ao desafio de ${nomeNoDuelo(duelo.desafiante, false)}`;
  }
  if (duelo.fase === 'decidido' && duelo.vencedor) {
    const perdedor = duelo.vencedor === duelo.desafiante ? duelo.desafiado : duelo.desafiante;
    return `${nomeNoDuelo(duelo.vencedor)} venceu ${nomeNoDuelo(perdedor, false)}`;
  }
  if (duelo.fase === 'decidido') return `${quemDesafiou} e ${quemFoiDesafiado} empataram`;
  return `${quemDesafiou} x ${quemFoiDesafiado}`;
}

function detalheDoDuelo(duelo) {
  const jogo = duelo.jogoDoDuelo.nome;
  if (duelo.fase === 'convite') return `${jogo}, resposta até ${formatoDiaCurto.format(duelo.ate)}`;
  if (duelo.fase === 'valendo') return `${jogo}, jogar até ${formatoDiaCurto.format(duelo.ate)}`;
  if (duelo.fase === 'em jogo') return `${jogo}, partida em andamento`;
  if (duelo.fase === 'sem jogo') return `${jogo}, terminou sem partida`;
  if (duelo.fase !== 'decidido' || !duelo.partida) return jogo;
  const primeiro = duelo.vencedor || duelo.desafiante;
  const segundo = primeiro === duelo.desafiante ? duelo.desafiado : duelo.desafiante;
  return `${jogo}, ${duelo.lugares.get(primeiro)}º x ${duelo.lugares.get(segundo)}º`;
}

function nomesDoDuelo(duelo) {
  return `${jogador(duelo.desafiante)?.apelido || '?'} x ${jogador(duelo.desafiado)?.apelido || '?'}`;
}

function textoDoPlacar({ vitorias, derrotas, empates }) {
  return [
    vitorias && quantidade(vitorias, ['vitória', 'vitórias']),
    derrotas && quantidade(derrotas, ['derrota', 'derrotas']),
    empates && quantidade(empates, ['empate', 'empates']),
  ].filter(Boolean).join(', ');
}

function rostosDoDuelo(duelo, classe) {
  const rostos = criar('span', classe);
  const [primeiro, segundo] = [duelo.desafiante, duelo.desafiado].map(id => {
    const foto = imagemDe(jogador(id), 'foto');
    if (duelo.fase === 'decidido' && duelo.vencedor === id) foto.classList.add('vencedor');
    return foto;
  });
  rostos.append(primeiro, criar('span', 'contra', 'x'), segundo);
  return rostos;
}

function pedirRevanche(duelo) {
  const oponente = duelo.desafiante === estado.eu.id ? duelo.desafiado : duelo.desafiante;
  desafio = { jogador: oponente, jogo: duelo.jogo };
  irPara('duelos', 'desafiar');
}

function botoesDoConvite(duelo) {
  const linha = criar('span', 'linha-botoes');
  const aviso = criar('p', 'aviso');
  const acao = (rotulo, classe, nome, valores) => {
    const botao = criar('button', classe, rotulo);
    botao.type = 'button';
    botao.addEventListener('click', () => enviar(botao, aviso, nome, valores));
    return botao;
  };
  if (duelo.desafiado === estado.eu.id) {
    linha.append(acao('Aceitar', 'botao', 'responderDuelo', { duelo: duelo.id, aceitar: true }), acao('Recusar', 'botao botao-claro', 'responderDuelo', { duelo: duelo.id, aceitar: false }));
  } else {
    linha.append(acao('Cancelar convite', 'botao-menu', 'cancelarDuelo', { duelo: duelo.id }));
  }
  return [linha, aviso];
}

function podeLancarResultado(duelo) {
  return estado.eu.admin && ['valendo', 'em jogo'].includes(duelo.fase);
}

function resultadoPeloAdmin(duelo) {
  const abrir = criar('button', 'botao-menu botao-resultado', 'Resultado');
  abrir.type = 'button';
  abrir.setAttribute('aria-expanded', 'false');
  const escolha = criar('div', 'escolha-do-vencedor');
  escolha.hidden = true;
  const aviso = criar('p', 'aviso');
  const opcoes = criar('span', 'linha-botoes');
  opcoes.append(...[duelo.desafiante, duelo.desafiado].map(id => {
    const botao = criar('button', 'botao', `${jogador(id)?.apelido || '?'} venceu`);
    botao.type = 'button';
    botao.addEventListener('click', () => enviar(botao, aviso, 'lancarResultadoDoDuelo', { duelo: duelo.id, vencedor: id }));
    return botao;
  }));
  escolha.append(opcoes, aviso);
  abrir.addEventListener('click', () => {
    const abrindo = escolha.hidden;
    document.querySelectorAll('.escolha-do-vencedor').forEach(outra => { outra.hidden = true; });
    document.querySelectorAll('.botao-resultado').forEach(outro => outro.setAttribute('aria-expanded', 'false'));
    escolha.hidden = !abrindo;
    abrir.setAttribute('aria-expanded', abrindo);
  });
  return [abrir, escolha];
}

function cartazDoMeuDuelo(duelo) {
  const { eu } = estado;
  const rival = duelo.desafiante === eu.id ? duelo.desafiado : duelo.desafiante;
  const meResponder = duelo.fase === 'convite' && duelo.desafiado === eu.id;
  const dias = duelo.ate ? quantidade(Math.max(1, Math.ceil((duelo.ate.getTime() - Date.now()) / 864e5)), ['dia', 'dias']) : '';
  const [situacao, prazo] = {
    convite: meResponder ? ['Te desafiou', `${dias} para responder`] : ['Esperando resposta', `${dias} para a resposta`],
    valendo: ['Valendo', `${dias} para jogar`],
    'em jogo': ['Em jogo agora', 'Partida aberta'],
  }[duelo.fase];
  const item = criar('li', 'meu-duelo');
  const cartaz = criar('div', `cartaz-duelo${duelo.fase === 'em jogo' ? ' jogando' : ''}`);
  const vs = criar('img', 'cartaz-vs');
  vs.src = 'midia/duelos/vs.webp';
  vs.alt = 'contra';
  const rostos = criar('div', 'cartaz-rostos');
  rostos.append(imagemDe(eu, 'foto'), vs, imagemDe(jogador(rival), 'foto'));
  const jogo = criar('span', 'cartaz-jogo');
  jogo.append(imagemDaCapa(duelo.jogoDoDuelo, 'cartaz-capa'), criar('span', '', duelo.jogoDoDuelo.nome));
  const texto = criar('div', 'cartaz-texto');
  texto.append(criar('span', 'cartaz-situacao', situacao), criar('strong', 'cartaz-rival', jogador(rival)?.apelido || '?'), jogo, criar('span', 'cartaz-prazo', prazo));
  cartaz.append(rostos, texto);
  if (duelo.fase !== 'em jogo') {
    const pavio = criar('span', 'cartaz-pavio');
    const total = duelo.fase === 'convite' ? PRAZO_DO_CONVITE : PRAZO_DO_DUELO;
    pavio.style.setProperty('--resta', Math.max(0, duelo.ate.getTime() - Date.now()) / total);
    cartaz.append(pavio);
  }
  item.append(cartaz);
  if (duelo.fase === 'convite') {
    const rodape = criar('div', 'cartaz-rodape');
    if (meResponder && duelo.provocacao) rodape.append(criar('p', 'cartaz-provocacao', `"${duelo.provocacao}"`));
    rodape.append(...botoesDoConvite(duelo));
    item.append(rodape);
  }
  if (podeLancarResultado(duelo)) {
    const rodape = criar('div', 'cartaz-rodape');
    const [abrir, escolha] = resultadoPeloAdmin(duelo);
    const linha = criar('span', 'linha-botoes');
    linha.append(abrir);
    rodape.append(linha, escolha);
    item.append(rodape);
  }
  return item;
}

function rivalidadesDe(id) {
  const pares = new Map();
  for (const duelo of duelosDoGinasio().filter(d => DUELOS_TERMINADOS.includes(d.fase) && envolve(d, id))) {
    const rival = duelo.desafiante === id ? duelo.desafiado : duelo.desafiante;
    if (!pares.has(rival)) pares.set(rival, []);
    pares.get(rival).push(duelo);
  }
  return [...pares].map(([b, duelos]) => {
    const vitorias = quem => duelos.filter(d => d.fase === 'decidido' && d.vencedor === quem).length;
    return { b, placarA: vitorias(id), placarB: vitorias(b), ultimo: Math.max(...duelos.map(momentoDoDuelo)) };
  }).sort((x, y) => y.ultimo - x.ultimo);
}

function destaqueDaFicha(rotulo, emblema, rival) {
  const destaque = criar('div', 'ficha-destaque');
  const icone = criar('img', 'ficha-emblema');
  icone.src = `midia/duelos/emblema-${emblema}.webp`;
  icone.alt = '';
  const texto = criar('span');
  texto.append(criar('span', 'detalhe', rotulo), criar('span', '', jogador(rival.b)?.apelido || '?'), criar('span', 'detalhe', `${rival.placarA} x ${rival.placarB}`));
  destaque.append(icone, texto, imagemDe(jogador(rival.b), 'foto'));
  return destaque;
}

function placarDePedra(esquerda, direita) {
  const placar = criar('span', 'placar-de-pedra');
  placar.append(...[[esquerda, direita], [direita, esquerda]].map(([valor, outro]) => {
    const numero = criar('span', valor > outro ? 'lider' : '', valor);
    const texto = String(valor);
    numero.style.setProperty('--centro-da-tinta', `${(texto.endsWith('1') - texto.startsWith('1')) * .06}em`);
    return numero;
  }));
  return placar;
}

function linhaDeDuelo(duelo, detalhe) {
  const linha = criar('li', `linha-de-duelo${envolve(duelo, estado.eu.id) ? ' minha' : ''}`);
  const texto = criar('span', 'linha-de-duelo-texto');
  texto.append(criar('span', '', tituloDoDuelo(duelo)), criar('span', 'detalhe', detalhe));
  linha.append(rostosDoDuelo(duelo, 'rostos-do-duelo'), texto);
  return linha;
}

function linhaDeResultado(duelo) {
  return linhaDeDuelo(duelo, `${formatoDiaCurto.format(new Date(momentoDoDuelo(duelo)))} · ${detalheDoDuelo(duelo)}`);
}

function cartaoDoRival(rival) {
  const cartao = criar('li', 'rival');
  const situacao = rival.placarA > rival.placarB ? ' ganhando' : rival.placarA < rival.placarB ? ' perdendo' : '';
  cartao.append(imagemDe(jogador(rival.b), 'foto'), criar('span', 'rival-nome', jogador(rival.b)?.apelido || '?'), criar('span', `rival-placar${situacao}`, `${rival.placarA}x${rival.placarB}`));
  return cartao;
}

function mesDoDuelo(duelo) {
  return formatoDiaDaMesa.format(new Date(momentoDoDuelo(duelo))).slice(0, 7);
}

function mesesComDuelos() {
  const meses = [...new Set(duelosDoGinasio().filter(d => DUELOS_TERMINADOS.includes(d.fase)).map(mesDoDuelo))].sort();
  return meses.length ? meses : [estado.mesAtual];
}

function trocarMesDosDuelos(passo) {
  const meses = mesesComDuelos();
  mesDosDuelos = meses[meses.indexOf(mesDosDuelos) + passo] || mesDosDuelos;
  mesCompleto = false;
  mostrarHistorico();
}

function mostrarHistorico() {
  const { eu } = estado;
  const placar = placarDeDuelos(eu.id);
  const legenda = criar('span', 'placar-legenda');
  legenda.append(criar('span', '', 'Vitórias'), criar('span', '', 'Derrotas'));
  const empates = placar.empates ? [criar('span', 'detalhe', quantidade(placar.empates, ['empate', 'empates']))] : [];
  document.getElementById('ficha-contagem').replaceChildren(placarDePedra(placar.vitorias, placar.derrotas), legenda, ...empates);
  const rivais = rivalidadesDe(eu.id);
  const fregues = rivais.filter(r => r.placarA > r.placarB).sort((x, y) => (y.placarA - y.placarB) - (x.placarA - x.placarB))[0];
  const carrasco = rivais.filter(r => r.placarB > r.placarA).sort((x, y) => (y.placarB - y.placarA) - (x.placarB - x.placarA))[0];
  document.getElementById('ficha-destaques').replaceChildren(...[fregues && destaqueDaFicha('Freguês', 'fregues', fregues), carrasco && destaqueDaFicha('Carrasco', 'carrasco', carrasco)].filter(Boolean));

  document.getElementById('caixa-rivais').hidden = !rivais.length;
  document.getElementById('grade-rivais').replaceChildren(...rivais.map(cartaoDoRival));

  const meses = mesesComDuelos();
  if (!meses.includes(mesDosDuelos)) mesDosDuelos = meses.at(-1);
  const posicao = meses.indexOf(mesDosDuelos);
  document.getElementById('duelos-mes-anterior').style.visibility = posicao > 0 ? '' : 'hidden';
  document.getElementById('duelos-mes-seguinte').style.visibility = posicao < meses.length - 1 ? '' : 'hidden';
  const titulo = nomeDoMes(mesDosDuelos);
  document.getElementById('duelos-mes').textContent = titulo[0].toUpperCase() + titulo.slice(1);
  const doMes = duelosDoGinasio().filter(d => DUELOS_TERMINADOS.includes(d.fase) && mesDoDuelo(d) === mesDosDuelos).sort((a, b) => momentoDoDuelo(b) - momentoDoDuelo(a));
  document.getElementById('duelos-mes-conta').textContent = doMes.length ? quantidade(doMes.length, ['duelo terminado', 'duelos terminados']) : 'Nenhum duelo terminou neste mês.';
  const visiveis = mesCompleto ? doMes : doMes.slice(0, 8);
  document.getElementById('duelos-do-mes').replaceChildren(...visiveis.map(d => linhaDeResultado(d)));
  const mais = document.getElementById('mais-do-mes');
  mais.hidden = visiveis.length === doMes.length;
  mais.textContent = `Mais ${doMes.length - visiveis.length}`;
}

function mostrarLinhaDoDuelo(lugar, partida) {
  const duelos = duelosDoGinasio().filter(d => d.partida?.id === partida.id);
  lugar.hidden = !duelos.length;
  lugar.textContent = duelos.map(d => (d.fase === 'em jogo' ? `Vale o duelo ${nomesDoDuelo(d)}.` : `Duelo: ${tituloDoDuelo(d)}.`)).join(' ');
}

function mostrarRival(entrando) {
  const rival = jogador(desafio.jogador);
  const foto = document.getElementById('lutador-rival');
  if (rival) foto.replaceChildren(imagemDe(rival, 'foto'));
  else foto.textContent = '?';
  document.getElementById('nome-rival').textContent = rival?.apelido || 'Escolha';
  for (const ficha of document.getElementById('escolha-rival').children) ficha.setAttribute('aria-pressed', ficha.dataset.jogador === desafio.jogador);
  if (entrando) {
    for (const elemento of [foto, document.getElementById('vs')]) {
      elemento.classList.remove('entrando');
      void elemento.offsetWidth;
      elemento.classList.add('entrando');
    }
  }
  validarDesafio();
}

function validarDesafio() {
  const motivo = desafio.jogador ? motivoParaNaoDesafiar(desafio.jogador) : '';
  document.getElementById('aviso-duelo').textContent = motivo;
  document.getElementById('enviar-desafio').disabled = !desafio.jogador || !desafio.jogo || Boolean(motivo);
}

const VISTAS_DE_DUELO = ['desafiar', 'em-jogo', 'historico'];

function mostrarDuelos(pedido) {
  const { eu } = estado;
  const vista = VISTAS_DE_DUELO.includes(pedido) && !(eu.observador && pedido === 'desafiar') ? pedido : '';
  const tela = document.querySelector('[data-tela="duelos"]');
  document.querySelector('#arena [data-ir="duelos/desafiar"]').disabled = eu.observador;
  document.querySelector('#sem-confrontos [data-ir="duelos/desafiar"]').hidden = eu.observador;
  document.getElementById('ficha-duelos').hidden = eu.observador;
  document.getElementById('arena').hidden = Boolean(vista);
  document.getElementById('voltar-arena').hidden = !vista;
  tela.querySelectorAll('[data-vista]').forEach(parte => { parte.hidden = parte.dataset.vista !== vista; });
  const recebidos = duelosDoGinasio().filter(d => d.fase === 'convite' && d.desafiado === eu.id).length;
  document.getElementById('selo-convites').hidden = !recebidos;
  document.getElementById('selo-convites').textContent = recebidos;
  if (!jogador(desafio.jogador) || desafio.jogador === eu.id) desafio.jogador = '';
  if (!estado.jogos.some(j => j.id === desafio.jogo)) desafio.jogo = '';
  const outros = estado.jogadores.filter(j => j.id !== eu.id).sort((a, b) => a.apelido.localeCompare(b.apelido, 'pt-BR'));
  document.getElementById('lutador-eu').replaceChildren(imagemDe(eu, 'foto'));
  document.getElementById('nome-eu').textContent = eu.apelido;
  document.getElementById('escolha-rival').replaceChildren(...outros.map(alguem => {
    const ficha = criar('button', 'ficha-rival');
    ficha.type = 'button';
    ficha.dataset.jogador = alguem.id;
    ficha.append(imagemDe(alguem, 'foto'), criar('span', '', alguem.apelido));
    ficha.addEventListener('click', () => {
      desafio.jogador = alguem.id;
      mostrarRival(true);
      tocar('escolher');
    });
    return ficha;
  }));
  mostrarRival(false);
  const jogos = [...estado.jogos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const campoJogo = document.getElementById('duelo-jogo');
  campoJogo.replaceChildren(new Option('Em qual jogo', ''), ...jogos.map(j => new Option(j.nome, j.id)));
  campoJogo.value = desafio.jogo;
  validarDesafio();

  const andamento = duelosDoGinasio().filter(d => DUELOS_EM_ANDAMENTO.includes(d.fase)).sort((a, b) => a.ate - b.ate);
  const meResponder = d => d.fase === 'convite' && d.desafiado === eu.id;
  const meus = andamento.filter(d => envolve(d, eu.id)).sort((a, b) => meResponder(b) - meResponder(a));
  const doGinasio = andamento.filter(d => !envolve(d, eu.id));
  document.getElementById('caixa-meus-duelos').hidden = !meus.length;
  document.getElementById('lista-meus-duelos').replaceChildren(...meus.map(cartazDoMeuDuelo));
  document.getElementById('caixa-no-ginasio').hidden = !doGinasio.length;
  document.getElementById('lista-no-ginasio').replaceChildren(...doGinasio.map(d => {
    const linha = linhaDeDuelo(d, detalheDoDuelo(d));
    if (podeLancarResultado(d)) linha.append(...resultadoPeloAdmin(d));
    return linha;
  }));
  document.getElementById('sem-confrontos').hidden = andamento.length > 0;
  mostrarHistorico();
}

function ligarDuelos() {
  const formulario = document.getElementById('form-duelo');
  const campoJogo = document.getElementById('duelo-jogo');
  const provocacao = document.getElementById('duelo-provocacao');
  campoJogo.addEventListener('change', () => {
    desafio.jogo = campoJogo.value;
    validarDesafio();
  });
  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    const dados = { desafiado: desafio.jogador, jogo: desafio.jogo, provocacao: provocacao.value };
    if (await enviar(document.getElementById('enviar-desafio'), document.getElementById('aviso-duelo'), 'desafiar', dados)) {
      provocacao.value = '';
      desafio = { jogador: '', jogo: '' };
      irPara('duelos', 'em-jogo');
    }
  });
  document.getElementById('mais-do-mes').addEventListener('click', () => {
    mesCompleto = true;
    mostrarHistorico();
  });
  document.getElementById('duelos-mes-anterior').addEventListener('click', () => trocarMesDosDuelos(-1));
  document.getElementById('duelos-mes-seguinte').addEventListener('click', () => trocarMesDosDuelos(1));
}

function palcoDoDuelo(duelo) {
  return rostosDoDuelo(duelo, 'duelo-palco');
}

function marcarDueloVisto(chave) {
  marcarComoVisto([chave]);
  const limite = Date.now() - PRAZO_DO_RESULTADO;
  const atuais = new Set(duelosDoGinasio().flatMap(d => {
    if (d.fase === 'convite') return [`convite:${d.id}`];
    if (d.fase === 'decidido' && momentoDoDuelo(d) > limite) return [`duelo:${d.id}`];
    return [];
  }));
  const velhas = estado.eu.vistos.filter(c => (c.startsWith('convite:') || c.startsWith('duelo:')) && !atuais.has(c));
  if (velhas.length) updateDoc(doc(banco, 'jogadores', estado.eu.id), { vistos: arrayRemove(...velhas) }).catch(() => {});
}

async function responderPeloAviso(duelo, aceitar) {
  try {
    await ACOES.responderDuelo({ duelo, aceitar });
    tocar('confirmar');
  } catch {
    tocar('erro');
  }
  irPara('duelos', 'em-jogo');
}

function mostrarDueloDecidido(duelo) {
  const { eu } = estado;
  const oponente = duelo.desafiante === eu.id ? duelo.desafiado : duelo.desafiante;
  const venci = duelo.vencedor === eu.id;
  const perdi = duelo.vencedor === oponente;
  let topo = 'Duelo empatado';
  if (venci) topo = 'Duelo vencido!';
  if (perdi) topo = 'Duelo perdido';
  abrirConquista({
    topo,
    palco: [palcoDoDuelo(duelo)],
    texto: `${tituloDoDuelo(duelo)} em ${duelo.jogoDoDuelo.nome}.`,
    detalhe: duelo.partida ? `Você em ${duelo.lugares.get(eu.id)}º, ${nomeNoDuelo(oponente)} em ${duelo.lugares.get(oponente)}º.` : '',
    botaoVer: perdi ? 'Revanche' : 'Ver duelos',
    som: venci ? 'campeao' : 'partidaFechada',
    aoConcluir: escolha => {
      marcarDueloVisto(`duelo:${duelo.id}`);
      if (escolha !== 'ver') return;
      if (perdi) pedirRevanche(duelo);
      else irPara('duelos', 'historico');
    },
  });
}

function mostrarConvite(duelo) {
  abrirConquista({
    topo: 'Desafio!',
    palco: [palcoDoDuelo(duelo)],
    texto: `${nomeNoDuelo(duelo.desafiante)} desafiou você em ${duelo.jogoDoDuelo.nome}.`,
    detalhe: duelo.provocacao ? `"${duelo.provocacao}"` : `Responda até ${formatoDiaCurto.format(duelo.ate)}.`,
    botaoContinuar: 'Depois',
    botaoOutro: 'Aceitar',
    botaoVer: 'Recusar',
    aoConcluir: escolha => {
      marcarDueloVisto(`convite:${duelo.id}`);
      if (escolha !== 'continuar') responderPeloAviso(duelo.id, escolha === 'outro');
    },
  });
}

function avisarDuelo() {
  const { eu } = estado;
  const vistos = avisosVistos();
  const limite = Date.now() - PRAZO_DO_RESULTADO;
  const duelos = duelosDoGinasio();
  const decidido = duelos.find(d => d.fase === 'decidido' && envolve(d, eu.id) && momentoDoDuelo(d) > limite && !vistos.includes(`duelo:${d.id}`));
  if (decidido) {
    mostrarDueloDecidido(decidido);
    return true;
  }
  const convite = duelos.find(d => d.fase === 'convite' && d.desafiado === eu.id && !vistos.includes(`convite:${d.id}`));
  if (!convite) return false;
  mostrarConvite(convite);
  return true;
}

function esquecerDuelos() {
  desafio = { jogador: '', jogo: '' };
  mesDosDuelos = '';
  mesCompleto = false;
}

export {
  PRAZO_DO_CONVITE, desafio, duelosDoGinasio, momentoDoDuelo, mesDoDuelo, motivoParaNaoDesafiar, placarDeDuelos, nomesDoDuelo, textoDoPlacar, mostrarLinhaDoDuelo, mostrarDuelos,
  ligarDuelos, avisarDuelo, esquecerDuelos,
};
