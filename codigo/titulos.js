import { MAXIMO_DE_ROSTOS, jogoDe, jogador, nomeDoMes, avisosVistos, diaDaMesa, criar, imagemDaCapa, imagemDe } from './base.js?v=103';
import { rankingDoMes, partidaParaFormula, lugaresDaPartida, presentesEmCadaDia, rankingDe, mesesFechados } from './ranking.js?v=103';
import { duelosDoGinasio, momentoDoDuelo, mesDoDuelo } from './duelos.js?v=103';
import { estado, irPara } from './app.js?v=103';

const FOLGA_DO_ATROPELO = 1.5;
const METAS_DE_MESTRE = [5, 10, 15, 20, 25];
const MINIMO_PARA_TURISTA = 5;
const ATRASO_DA_CONTA_PENDURADA = 2 * 60e3;
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
  { id: 'casa', nome: 'Casa Cheia', desenho: 'casa', metas: [1, 3, 6, 10, 20], medida: 'Vitórias em partidas com 6 ou mais jogadores.', unidade: ['vitória de casa cheia', 'vitórias de casa cheia'] },
  { id: 'volta', nome: 'Volta por Cima', desenho: 'volta', metas: [1, 3, 6, 10, 20], medida: 'Vitórias logo depois de ficar em último.', unidade: ['volta por cima', 'voltas por cima'] },
  { id: 'sorte', nome: 'Sorte de Principiante', desenho: 'sorte', metas: [1, 2, 4, 6, 10], medida: 'Vitórias na primeira vez que jogou um jogo.', nota: '(Mesmo se já conhecer as regras).', unidade: ['vitória de estreia', 'vitórias de estreia'] },
  { id: 'recorde', nome: 'Recordista', desenho: 'recorde', metas: [1, 3, 6, 10, 20], medida: 'Vezes que bateu o maior placar já feito num jogo.', unidade: ['recorde', 'recordes'] },
  { id: 'zebra', nome: 'Zebra', desenho: 'zebra', metas: [1, 3, 6, 10, 20], medida: 'Vitórias numa mesa em que você era o último do ranking do mês.', unidade: ['zebra', 'zebras'] },
  { id: 'trave', nome: 'Na Trave', desenho: 'trave', metas: [1, 3, 6, 10, 20], medida: 'Vezes em 2º a 1 ponto do vencedor.', unidade: ['vez', 'vezes'] },
  { id: 'cadeira', nome: 'Cadeira Cativa', desenho: 'cadeira', metas: [10, 30, 60, 100, 200], medida: 'Partidas jogadas.', unidade: ['partida', 'partidas'] },
  { id: 'presenca', nome: 'Presença VIP', desenho: 'presenca', metas: [1, 3, 6, 9, 12], medida: 'Meses fechados em que foi a todos os dias de jogo.', unidade: ['mês completo', 'meses completos'] },
  { id: 'mesa', nome: 'Dono da Mesa', desenho: 'mesa', metas: [5, 15, 30, 50, 100], medida: 'Partidas que abriu.', unidade: ['partida aberta', 'partidas abertas'] },
  { id: 'ecletico', nome: 'Eclético', desenho: 'ecletico', metas: [3, 5, 8, 12, 20], medida: 'Jogos diferentes jogados.', unidade: ['jogo', 'jogos'] },
  { id: 'duelista', nome: 'Duelista', desenho: 'duelista', metas: [1, 3, 6, 10, 20], medida: 'Duelos vencidos.', unidade: ['duelo vencido', 'duelos vencidos'] },
  { id: 'vice', nome: 'Vice', desenho: 'vice', metas: [5, 10, 20, 35, 50], medida: 'Vezes em 2º lugar.', unidade: ['vez', 'vezes'], soPorEscolha: true },
  { id: 'praia', nome: 'Morreu na Praia', desenho: 'praia', metas: [1, 2, 3, 5, 8], medida: 'Meses em que chegou ao último dia de jogo em 1º e não foi campeão.', unidade: ['mês', 'meses'], soPorEscolha: true },
  { id: 'turista', nome: 'Turista', desenho: 'turista', metas: [1, 3, 6, 9, 12], medida: 'Meses em que jogou só 1 ou 2 partidas.', unidade: ['mês', 'meses'], soPorEscolha: true },
  { id: 'pendurada', nome: 'Conta Pendurada', desenho: 'pendurada', metas: [1, 3, 6, 10, 20], medida: 'Vezes que lançou o placar mais de 2 minutos depois de todo mundo.', unidade: ['vez', 'vezes'], soPorEscolha: true },
  { id: 'lanterna', nome: 'Lanterninha', desenho: 'lanterna', metas: [5, 10, 20, 35, 50], medida: 'Vezes em último.', unidade: ['vez', 'vezes'], soPorEscolha: true },
  { id: 'estreante', nome: 'Estreante', desenho: 'estreante', metas: [1], medida: 'Jogou a primeira partida.', unidade: ['partida', 'partidas'] },
];

let titulosCalculados = { estado: null, valor: null };

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
        vice: 0, casa: 0, voltas: 0, vinhaDeUltimo: false, zebras: 0, praias: 0, presencas: 0, turismos: 0, sortes: 0, recordes: 0, penduradas: 0, duelos: 0,
      });
    }
    return contagens.get(id);
  };

  const ids = estado.jogadores.map(j => j.id);
  const rankingDas = partidas => new Map(rankingDoMes(ids, partidas.map(partidaParaFormula)).linhas.map(l => [l.id, l]));
  const jogadasDoMes = new Map();
  const recordes = new Map();
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
    if (!jogadasDoMes.has(mes)) jogadasDoMes.set(mes, []);
    const anteriores = jogadasDoMes.get(mes);
    const rankingAntes = anteriores.length ? rankingDas(anteriores) : null;
    const ehZebra = id => {
      const meu = rankingAntes?.get(id);
      if (!meu?.partidas) return false;
      const outros = partida.placares.map(s => rankingAntes.get(s.jogador)).filter(l => l && l.id !== id && l.partidas);
      return outros.length > 0 && outros.every(l => l.nota > meu.nota);
    };
    if (jogador(partida.abertaPor)) marcar(partida.abertaPor, 'mesa', ++contagemDe(partida.abertaPor).abertas, mes);
    const valores = partida.placares.map(s => s.valor);
    const melhorDaMesa = jogo.menorVence ? Math.min(...valores) : Math.max(...valores);
    const recordeAntes = recordes.get(partida.jogo);
    const bateuRecorde = !jogo.semPlacar && recordeAntes !== undefined && (jogo.menorVence ? melhorDaMesa < recordeAntes : melhorDaMesa > recordeAntes);
    if (!jogo.semPlacar && (recordeAntes === undefined || bateuRecorde)) recordes.set(partida.jogo, melhorDaMesa);

    for (const { jogador: id, valor } of partida.placares) {
      const conta = contagemDe(id);
      const lugar = lugares.get(id);
      const venceu = lugar === 1 && pior > 1;
      marcar(id, 'estreante', ++conta.partidas, mes);
      marcar(id, 'cadeira', conta.partidas, mes);
      if (venceu && !conta.jogos.has(partida.jogo)) marcar(id, 'sorte', ++conta.sortes, mes);
      if (bateuRecorde && valor === melhorDaMesa) marcar(id, 'recorde', ++conta.recordes, mes);
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
      if (lugar === 2 && pior > 2) marcar(id, 'vice', ++conta.vice, mes);
      if (venceu && partida.placares.length >= 6) marcar(id, 'casa', ++conta.casa, mes);
      if (venceu && conta.vinhaDeUltimo) marcar(id, 'volta', ++conta.voltas, mes);
      conta.vinhaDeUltimo = lugar === pior && pior > 1;
      if (lugar === pior && pior > 1) marcar(id, 'lanterna', ++conta.ultimo, mes);
      if (!jogo.semPlacar && lugar === 2 && Math.abs(valor - doPrimeiro) <= 1) marcar(id, 'trave', ++conta.trave, mes);
      if (venceu && ehZebra(id)) marcar(id, 'zebra', ++conta.zebras, mes);
    }
    const lancamentos = partida.placares.map(s => partida.lancadoEm.get(s.jogador));
    if (lancamentos.length > 1 && lancamentos.every(Boolean)) {
      const [penultimo, ultimo] = lancamentos.map(m => m.getTime()).sort((a, b) => a - b).slice(-2);
      if (ultimo - penultimo > ATRASO_DA_CONTA_PENDURADA) {
        partida.placares.filter(s => partida.lancadoEm.get(s.jogador).getTime() === ultimo)
          .forEach(s => marcar(s.jogador, 'pendurada', ++contagemDe(s.jogador).penduradas, mes));
      }
    }
    anteriores.push(partida);
  }

  for (const mes of [...mesesFechados()].reverse()) {
    const doMes = jogadasDoMes.get(mes) || [];
    const ultimoDia = doMes.length ? diaDaMesa(doMes.at(-1).abertaEm) : '';
    const antesDoUltimoDia = doMes.filter(p => diaDaMesa(p.abertaEm) !== ultimoDia);
    const lideres = antesDoUltimoDia.length ? [...rankingDas(antesDoUltimoDia).values()].filter(l => l.posicao === 1 && l.nota > 0).map(l => l.id) : [];
    const presentesNoDia = presentesEmCadaDia();
    const presentes = [...new Set(doMes.map(p => diaDaMesa(p.abertaEm)))].map(dia => presentesNoDia.get(dia));
    for (const linha of rankingDe(mes).linhas) {
      if (linha.nota <= 0) continue;
      const conta = contagemDe(linha.id);
      if (linha.posicao === 1) marcar(linha.id, 'campeao', ++conta.campeao, mes);
      if (linha.posicao <= 3) marcar(linha.id, 'podio', ++conta.podio, mes);
      if (linha.posicao !== 1 && lideres.includes(linha.id)) marcar(linha.id, 'praia', ++conta.praias, mes);
      if (presentes.every(dia => dia.has(linha.id))) marcar(linha.id, 'presenca', ++conta.presencas, mes);
      if (doMes.length >= MINIMO_PARA_TURISTA && linha.partidas <= 2) marcar(linha.id, 'turista', ++conta.turismos, mes);
    }
  }

  const vencidos = duelosDoGinasio().filter(d => d.fase === 'decidido' && d.vencedor).sort((a, b) => momentoDoDuelo(a) - momentoDoDuelo(b));
  for (const duelo of vencidos) marcar(duelo.vencedor, 'duelista', ++contagemDe(duelo.vencedor).duelos, duelo.partida?.mes || mesDoDuelo(duelo));

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

function figuraDoTitulo(titulo, classe = '') {
  if (titulo.jogo) return imagemDaCapa(titulo.jogo, `capa-titulo ${classe}`);
  const figura = criar('img', `icone-titulo ${classe}`);
  figura.alt = '';
  figura.src = `midia/titulos/titulo-${titulo.desenho}.png`;
  return figura;
}

function quadroDoTitulo(situacao, grande = false) {
  const { titulo, nivel, alcancados } = situacao;
  const quadro = criar('span', `quadro-titulo nivel-${nivel}${alcancados ? '' : ' apagado'}${grande ? ' grande' : ''}`);
  const moldura = criar('img', 'moldura-titulo');
  moldura.alt = '';
  moldura.src = `midia/titulos/moldura-${nivel}.png`;
  quadro.append(figuraDoTitulo(titulo), moldura);
  return quadro;
}

function faixaDoTitulo({ titulo, nivel }, comFigura = true) {
  const faixa = criar('span', `faixa nivel-${nivel}`);
  if (comFigura) faixa.append(figuraDoTitulo(titulo, 'faixa-figura'));
  faixa.append(criar('span', 'faixa-meio', comFigura && titulo.jogo ? titulo.jogo.nome : titulo.nome));
  return faixa;
}

function encaixarFaixa(lugar) {
  const meio = lugar.querySelector('.faixa-meio');
  if (!meio) return;
  document.fonts.ready.then(() => {
    if (meio.scrollWidth > meio.clientWidth) meio.parentElement.classList.add('compacta');
  });
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

function cartaoDoTitulo(situacao, { emUso = false, aoTocar = () => irPara('titulo', situacao.titulo.id) } = {}) {
  const { titulo, nivel, alcancados } = situacao;
  const cartao = criar('button', `cartao-titulo nivel-${nivel}${alcancados ? '' : ' falta'}`);
  cartao.type = 'button';
  const etiquetas = criar('span', 'etiquetas');
  if (titulo.metas.length > 1) etiquetas.append(etiquetaDoNivel(nivel, !alcancados), degrausDoTitulo(situacao));
  if (emUso) etiquetas.append(criar('span', 'etiqueta-escura', 'Em uso'));
  const texto = criar('span', 'cartao-texto');
  texto.append(etiquetas, criar('span', 'cartao-nome', titulo.nome), criar('span', 'cartao-regra', titulo.medida), barraDoProgresso(situacao));
  cartao.append(quadroDoTitulo(situacao), texto);
  cartao.addEventListener('click', aoTocar);
  return cartao;
}

function donosDoTitulo(id) {
  return estado.jogadores
    .map(alguem => [alguem, situacaoDe(alguem.id, id)])
    .filter(([, s]) => s.alcancados)
    .sort(([, a], [, b]) => b.alcancados - a.alcancados || a.desde.localeCompare(b.desde));
}

function mostrarTitulos(parametro) {
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
  const mestres = catalogo.filter(t => t.jogo).sort((a, b) => a.jogo.nome.localeCompare(b.jogo.nome, 'pt-BR'));
  document.getElementById('lista-mestres').replaceChildren(...(mestres.length
    ? mestres.map(linha)
    : [criar('li', 'detalhe', 'Nenhum jogo cadastrado ainda.')]));
  if (parametro === 'mestres') {
    history.replaceState(null, '', '#titulos');
    window.scrollTo(0, document.getElementById('lista-mestres').closest('section').getBoundingClientRect().top + window.scrollY - 12);
  }
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
  document.getElementById('titulo-meu').hidden = eu.observador;
  const vitrine = meu.alcancados ? meu : { titulo, nivel: nivelInicial(titulo), alcancados: 1 };
  document.getElementById('titulo-quadro').replaceChildren(quadroDoTitulo(vitrine, true));
  document.getElementById('titulo-faixa').replaceChildren(faixaDoTitulo(vitrine, false));
  encaixarFaixa(document.getElementById('titulo-faixa'));
  const medidaEl = document.getElementById('titulo-medida');
  medidaEl.textContent = titulo.medida;
  if (titulo.nota) {
    const nota = criar('span', '', titulo.nota);
    nota.style.cssText = 'display:block; font-size:12px;';
    medidaEl.append(nota);
  }

  const situacao = document.getElementById('titulo-meu');
  if (variosNiveis) {
    const datas = porJogador.get(eu.id)?.get(id)?.niveis || [];
    const escada = criar('ol', 'escada-niveis');
    escada.append(...titulo.metas.map((meta, i) => {
      const degrau = criar('li', i < meu.alcancados ? 'alcancado' : '');
      degrau.append(etiquetaDoNivel(NIVEIS[i], i >= meu.alcancados), criar('span', '', quantidade(meta, titulo.unidade)));
      return degrau;
    }));
    const nivelAtual = meu.alcancados ? [criar('p', '', `${NOME_DO_NIVEL[meu.nivel]} desde ${nomeDoMes(datas[meu.alcancados - 1])}`)] : [];
    situacao.replaceChildren(...nivelAtual, barraDoProgresso(meu), escada);
  } else if (meu.alcancados) {
    situacao.replaceChildren(criar('p', '', `Você tem desde ${nomeDoMes(meu.desde)}.`));
  } else {
    situacao.replaceChildren(criar('p', 'rotulo', 'Seu progresso'), barraDoProgresso(meu));
  }

  const donos = donosDoTitulo(id);
  document.getElementById('titulo-donos').replaceChildren(...(donos.length
    ? donos.map(([alguem, s]) => {
      const item = criar('li');
      const botao = criar('button', 'botao-limpo dono-titulo');
      botao.type = 'button';
      const nome = criar('span', 'dono-nome');
      nome.append(criar('span', '', alguem.apelido), criar('span', 'detalhe', `desde ${nomeDoMes(s.desde)}`));
      botao.append(imagemDe(alguem, 'foto'), nome);
      if (variosNiveis) botao.append(etiquetaDoNivel(s.nivel));
      botao.addEventListener('click', () => irPara('perfil', alguem.id));
      item.append(botao);
      return item;
    })
    : [criar('li', 'detalhe', 'Ninguém ganhou ainda.')]));
}

export {
  METAS_DE_MESTRE, NIVEIS, NOME_DO_NIVEL, TITULOS, titulosDoGinasio, situacaoNoTitulo, situacaoDe, titulosGanhos, tituloExibido, quantidade, titulosNovos,
  quadroDoTitulo, faixaDoTitulo, encaixarFaixa, linhaDoTitulo, degrausDoTitulo, cartaoDoTitulo, mostrarTitulos, mostrarTitulo,
};
