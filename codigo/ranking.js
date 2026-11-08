import {
  MESES, INSIGNIAS, CASAS_DA_NOTA, formatoNota, jogoDe, jogador, indiceDoMes, nomeDoMes, nomeDoMesComAnoSeOutro, diaDaMesa, diaDaPartida,
  textoFechamento, criar, mostrarFoto, imagemDe, desenhoDaInsignia,
} from './base.js?v=102';
import { tituloExibido, linhaDoTitulo } from './titulos.js?v=102';
import { desenharPodio, vagaNoPodio } from './avisos.js?v=102';
import { itemDaPartida } from './partidas.js?v=102';
import { estado, irPara } from './app.js?v=102';

const KATEX = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/';
const MAXIMO_DE_INSIGNIAS = 6;
const FRACAO_DA_FALTA = 0.5;
let diaAberto = '';
let mesDoDiaAberto = '';
let carregamentoKatex = null;

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
    const colocacao = (n - lugares[i] + 0.5) / n;
    if (soColocacao) return [nome, colocacao];
    const placar = menorVence ? media / (2 * valores[i]) : valores[i] / (2 * media);
    return [nome, (colocacao + Math.min(1, placar)) / 2];
  });
}

function presentesPorDia(partidas) {
  const presentes = new Map();
  for (const { dia, resultados } of partidas) {
    if (!presentes.has(dia)) presentes.set(dia, new Set());
    Object.keys(resultados).forEach(id => presentes.get(dia).add(id));
  }
  return presentes;
}

function rankingDoMes(jogadores, partidas, presentes = presentesPorDia(partidas)) {
  const acumulado = new Map(jogadores.map(id => [id, { soma: 0, faltas: 0, partidas: 0, contadas: 0 }]));
  for (const partida of partidas) {
    const notas = new Map(notasDaPartida(partida));
    const notaDaFalta = Math.min(...notas.values()) * FRACAO_DA_FALTA;
    for (const [id, jogador] of acumulado) {
      if (notas.has(id)) {
        jogador.soma += notas.get(id);
        jogador.partidas++;
        jogador.contadas++;
      } else if (!presentes.get(partida.dia).has(id)) {
        jogador.faltas += notaDaFalta;
        jogador.contadas++;
      }
    }
  }

  const total = partidas.length;
  const dias = [...new Set(partidas.map(p => p.dia))];
  const linhas = jogadores
    .map(id => {
      const { soma, faltas, partidas: jogadas, contadas } = acumulado.get(id);
      const diasQueFoi = dias.filter(dia => presentes.get(dia).has(id)).length;
      return { id, nota: jogadas ? (soma + faltas) / contadas : 0, partidas: jogadas, podePodio: 2 * diasQueFoi >= dias.length };
    })
    .sort((a, b) => b.nota - a.nota);

  const exibida = nota => nota.toFixed(CASAS_DA_NOTA);
  const numerar = (lista, primeira) => lista.forEach((linha, i) => {
    const empatado = i > 0 && exibida(lista[i - 1].nota) === exibida(linha.nota);
    linha.posicao = empatado ? lista[i - 1].posicao : primeira + i;
  });
  numerar(linhas.filter(l => l.podePodio), 1);
  const podio = linhas.filter(l => l.podePodio && l.posicao <= 3);
  const resto = linhas.filter(l => !podio.includes(l));
  numerar(resto, podio.length + 1);
  const corte = Math.min(...podio.map(l => l.nota));
  resto.forEach(l => { l.foraDoPodio = !l.podePodio && l.nota > corte; });
  return { linhas: [...podio, ...resto], total };
}

function partidaParaFormula(partida) {
  const { menorVence, semPlacar } = jogoDe(partida);
  return { menorVence, semPlacar, dia: diaDaMesa(partida.abertaEm), resultados: Object.fromEntries(partida.placares.map(s => [s.jogador, s.valor])) };
}

function lugaresDaPartida(partida) {
  const { menorVence, semPlacar } = jogoDe(partida);
  const valores = partida.placares.map(s => s.valor);
  const lugares = semPlacar ? valores : colocacoes(valores, menorVence);
  return new Map(partida.placares.map((s, i) => [s.jogador, lugares[i]]));
}

function fechadasDoMes(mes) {
  return estado.partidas.filter(p => p.mes === mes && p.estado === 'fechada').map(partidaParaFormula);
}

function presentesEmCadaDia() {
  return presentesPorDia(estado.partidas.filter(p => p.estado === 'fechada').map(partidaParaFormula));
}

function rankingDe(mes) {
  return rankingDoMes(estado.jogadores.map(j => j.id), fechadasDoMes(mes), presentesEmCadaDia());
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

function mesesVencidos(id) {
  return [...(conquistas().get(id) || [])].sort();
}

function colecaoDe(id) {
  return mesesVencidos(id).slice(0, INSIGNIAS.length).map((mes, indice) => ({ indice, mes }));
}

function insigniaDaVitoria(id, mes) {
  const indice = mesesVencidos(id).indexOf(mes);
  return indice >= 0 && indice < INSIGNIAS.length ? indice : null;
}

function proximaInsignia(id) {
  const vitorias = mesesVencidos(id).length;
  return vitorias < INSIGNIAS.length ? vitorias : null;
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
  const foraDoPodio = linha.foraDoPodio ? ', fora do pódio' : '';
  return linhaDoRanking(linha.id, linha.posicao, formatoNota.format(linha.nota), `${linha.partidas} de ${total} ${total === 1 ? 'partida' : 'partidas'}${foraDoPodio}`, linha.nota);
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
  document.getElementById('premio-texto').textContent = premios[mesAtual] || 'Prêmio a definir';
  document.getElementById('premio-fecha').textContent = textoFechamento(mesAtual);
  const proxima = eu.observador ? null : proximaInsignia(eu.id);
  document.getElementById('premio-insignia-imagem').hidden = proxima === null;
  document.getElementById('premio-linha-insignia').hidden = proxima === null;
  if (proxima !== null) {
    document.getElementById('premio-insignia').textContent = INSIGNIAS[proxima].nome;
    document.getElementById('premio-insignia-imagem').replaceChildren(desenhoDaInsignia(proxima, true, true));
    document.getElementById('premio-insignia-imagem').onclick = () => irPara('insignia', proxima + 1);
    document.getElementById('premio-insignia').onclick = () => irPara('insignia', proxima + 1);
  }

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
  const contados = linhas.filter(l => l.partidas > 0);
  const lugar = contados.findIndex(l => l.id === eu.id);
  const minha = contados[lugar];
  const vizinho = contados[lugar ? lugar - 1 : 1];
  document.getElementById('voce-no-mes').hidden = eu.observador;
  document.getElementById('voce-foto').replaceChildren(imagemDe(eu, 'foto'));
  document.getElementById('voce-posicao').textContent = minha ? `${minha.posicao}º lugar` : 'Fora da disputa';
  let situacao = `Você ainda não jogou em ${MESES[indice]}.`;
  if (minha && !vizinho) situacao = 'Sozinho na disputa.';
  else if (minha && lugar === 0) situacao = `${formatoNota.format(minha.nota - vizinho.nota)} à frente de ${jogador(vizinho.id).apelido}.`;
  else if (minha && vizinho.nota > minha.nota) situacao = `Faltam ${formatoNota.format(vizinho.nota - minha.nota)} para passar ${jogador(vizinho.id).apelido}.`;
  else if (minha) situacao = `Empatado com ${jogador(vizinho.id).apelido}.`;
  document.getElementById('voce-detalhe').textContent = minha ? `Nota ${formatoNota.format(minha.nota)}. ${situacao}` : situacao;

  const podio = document.getElementById('podio-do-mes');
  if (total) desenharPodio(podio, linhas);
  else podio.querySelectorAll('.podio-lugar').forEach(lugar => lugar.replaceChildren(vagaNoPodio()));

  const geral = rankingGeral();
  const proximo = MESES[(indice + 1) % 12];
  document.getElementById('ranking-geral').replaceChildren(...(geral.length
    ? geral.map(l => linhaDoRanking(l.id, l.posicao, insigniasEmMiniatura(l.id, l.insignias), ''))
    : [criar('li', 'detalhe', `Nenhum mês fechou ainda. O primeiro entra aqui em 1º de ${proximo}.`)]));
}

function insigniasEmMiniatura(id, total) {
  const miniaturas = criar('span', 'insignias-miniatura');
  miniaturas.setAttribute('aria-label', `${total} ${total === 1 ? 'insígnia' : 'insígnias'}`);
  const colecao = colecaoDe(id);
  miniaturas.append(...colecao.slice(0, MAXIMO_DE_INSIGNIAS).map(({ indice }) => desenhoDaInsignia(indice, true)));
  if (colecao.length > MAXIMO_DE_INSIGNIAS) miniaturas.append(criar('span', 'insignias-mais', `+${colecao.length - MAXIMO_DE_INSIGNIAS}`));
  return miniaturas;
}

function ligarTrocaDeMes(botao, mes) {
  botao.style.visibility = mes ? '' : 'hidden';
  if (!mes) return;
  botao.setAttribute('aria-label', `Ver ${nomeDoMes(mes)}`);
  botao.onclick = () => irPara('ranking', mes === estado.mesAtual ? '' : mes);
}

function mostrarRanking(pedido) {
  const { mesAtual, partidas } = estado;
  const meses = [...new Set([...partidas.map(p => p.mes), mesAtual])].sort();
  const mes = meses.includes(pedido) ? pedido : mesAtual;
  const posicao = meses.indexOf(mes);
  ligarTrocaDeMes(document.getElementById('mes-anterior'), meses[posicao - 1]);
  ligarTrocaDeMes(document.getElementById('mes-seguinte'), meses[posicao + 1]);
  const titulo = nomeDoMes(mes);
  document.getElementById('ranking-mes').textContent = titulo[0].toUpperCase() + titulo.slice(1);
  document.getElementById('partidas-mes').textContent = nomeDoMesComAnoSeOutro(mes);
  const doMes = partidas.filter(p => p.mes === mes);
  const { linhas, total } = rankingDe(mes);
  document.getElementById('total-partidas').textContent = `${total} ${total === 1 ? 'partida' : 'partidas'}`;
  document.getElementById('ranking-do-mes').replaceChildren(...linhas.filter(l => l.partidas > 0).map(l => linhaDoMes(l, total)));

  // Partidas lançadas pelo administrador trazem o dia certo, mas não a hora em que foram abertas.
  const dias = new Map();
  for (const partida of [...doMes].reverse()) {
    const dia = partida.abertaEm.getTime() ? diaDaPartida(partida.abertaEm) : 'Sem data';
    if (!dias.has(dia)) dias.set(dia, []);
    dias.get(dia).push(partida);
  }
  if (mesDoDiaAberto !== mes || !dias.has(diaAberto)) {
    diaAberto = '';
    mesDoDiaAberto = mes;
  }
  let cabecaAberta = null;
  const grupos = [...dias].map(([dia, doDia]) => {
    const aberto = dia === diaAberto;
    const cabeca = criar('button', 'faixa-recolhivel');
    cabeca.type = 'button';
    cabeca.setAttribute('aria-expanded', aberto);
    cabeca.append(criar('span', 'rotulo', dia), criar('span', 'detalhe', `${doDia.length} ${doDia.length === 1 ? 'partida' : 'partidas'}`), criar('span', 'seta-redonda'));
    cabeca.addEventListener('click', () => {
      diaAberto = aberto ? '' : dia;
      mostrarRanking(pedido);
    });
    const grupo = criar('li', 'grupo-dia');
    grupo.append(cabeca);
    if (aberto) {
      const lista = criar('ul', 'lista-partidas');
      lista.append(...doDia.map(itemDaPartida));
      grupo.append(lista);
      cabecaAberta = cabeca;
    }
    return grupo;
  });
  document.getElementById('lista-partidas').replaceChildren(...(grupos.length ? grupos : [criar('li', 'detalhe', 'Nenhuma partida neste mês ainda.')]));
  if (cabecaAberta && cabecaAberta.getBoundingClientRect().top < 0) cabecaAberta.scrollIntoView();
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

function ligarRegras() {
  const perguntas = [...document.querySelectorAll('[data-tela="regras"] .pergunta-topo')];
  perguntas.forEach(pergunta => pergunta.addEventListener('click', () => {
    const abrir = pergunta.getAttribute('aria-expanded') !== 'true';
    perguntas.forEach(outra => {
      const aberta = outra === pergunta && abrir;
      outra.setAttribute('aria-expanded', aberta);
      document.getElementById(outra.getAttribute('aria-controls')).hidden = !aberta;
    });
    if (abrir && pergunta.getBoundingClientRect().top < 0) pergunta.scrollIntoView();
  }));
}

function esquecerRanking() {
  diaAberto = '';
  mesDoDiaAberto = '';
}

export {
  FRACAO_DA_FALTA, notasDaPartida, rankingDoMes, partidaParaFormula, lugaresDaPartida, presentesEmCadaDia, rankingDe, mesesFechados, campeoesDe,
  colecaoDe, insigniaDaVitoria, mostrarInicio, mostrarRanking, mostrarRegras, ligarRegras, esquecerRanking,
};
