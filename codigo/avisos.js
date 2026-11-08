import { doc, updateDoc, arrayRemove } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {
  MESES, INSIGNIAS, formatoNota, formatoPlacar, POUCO_MOVIMENTO, tocar, jogoDe, jogador, indiceDoMes, avisosVistos, marcarComoVisto, quandoFoiAberta,
  criar, imagemDaCapa, imagemDe, desenhoDaInsignia, svgEmImagem,
} from './base.js?v=103';
import { notasDaPartida, partidaParaFormula, lugaresDaPartida, rankingDe, mesesFechados, campeoesDe, insigniaDaVitoria } from './ranking.js?v=103';
import { NIVEIS, NOME_DO_NIVEL, quantidade, titulosNovos, quadroDoTitulo, faixaDoTitulo, encaixarFaixa, degrausDoTitulo } from './titulos.js?v=103';
import { mostrarLinhaDoDuelo, avisarDuelo } from './duelos.js?v=103';
import { banco, estado, rotaAtual, renderizar, irPara } from './app.js?v=103';

const ATRASO_DA_ROLAGEM = 400;
const DURACAO_DA_ROLAGEM = 1400;
const PAUSA_ANTES_DO_PODIO = 600;
const ENTRE_LUGARES_DO_PODIO = 1200;
const SUSPENSE_DO_CAMPEAO = 800;
const DURACAO_DA_QUEDA = 640;
const CHEGADA_AO_PODIO = [
  { opacity: 0, transform: 'translateY(-48px) scale(0.6)' },
  { opacity: 1, transform: 'translateY(6px) scale(1.06)', offset: 0.6 },
  { opacity: 1, transform: 'none' },
];
let tituloSendoVisto = '';
let mesDoConvite = '';
const imagensDosIcones = new Map();

function convidarParaFrase() {
  const [ultimo] = mesesFechados();
  if (!ultimo || ultimo === mesDoConvite) return false;
  mesDoConvite = ultimo;
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

function vagaNoPodio() {
  const vaga = criar('span', 'podio-pessoa vaga');
  const imagem = criar('img', 'foto');
  imagem.src = 'midia/avatares/meeple-1.png';
  imagem.alt = '';
  vaga.append(criar('span', '', '?'), imagem);
  return vaga;
}

function mostrarCelebracao(mes, campeoes) {
  const indice = indiceDoMes(mes);
  const euVenci = campeoes.some(l => l.id === estado.eu.id);
  const daEntrega = insigniaDaVitoria(euVenci ? estado.eu.id : campeoes[0].id, mes);
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
  const lugarDaInsignia = document.getElementById('celebracao-insignia');
  const insigniaDaEntrega = daEntrega === null ? null : desenhoDaInsignia(daEntrega, true);
  insigniaDaEntrega?.style.setProperty('--atraso', `${(ATRASO_DA_ROLAGEM + DURACAO_DA_ROLAGEM) / 1000 + 0.2}s`);
  lugarDaInsignia.replaceChildren(...(insigniaDaEntrega ? [insigniaDaEntrega] : []));
  const nomeDaInsignia = daEntrega === null ? '' : INSIGNIAS[daEntrega].nome;
  const linhaDoPremio = document.getElementById('celebracao-premio');
  linhaDoPremio.textContent = premio ? `${nomes} ${varios ? 'dividem' : 'leva'}: ${premio}.` : '';
  linhaDoPremio.hidden = !premio;
  let entrega;
  if (varios) entrega = premio ? 'E cada um leva a sua próxima insígnia.' : `${nomes} levam, cada um, a sua próxima insígnia.`;
  else if (nomeDaInsignia) entrega = premio ? `E a ${nomeDaInsignia}.` : `${nomes} leva a ${nomeDaInsignia}.`;
  else entrega = premio ? '' : `${nomes} fecha o mês em 1º.`;
  const fraseDaEntrega = document.getElementById('celebracao-subtitulo');
  fraseDaEntrega.textContent = entrega;
  botao.textContent = euVenci && !escreveu ? 'Escrever minha frase' : 'Continuar';

  const entregar = () => {
    insigniaDaEntrega?.classList.add('brilha');
    if (insigniaDaEntrega && entrega && !POUCO_MOVIMENTO.matches) rolarInsignia(lugarDaInsignia, fraseDaEntrega);
  };
  const pararRevelacao = POUCO_MOVIMENTO.matches ? null : revelarPodio(overlay.querySelector('.celebracao-centro'), entregar);
  if (!pararRevelacao) {
    tocar('campeao');
    entregar();
  }

  const fechar = () => {
    pararRevelacao?.();
    overlay.hidden = true;
    if (euVenci && !escreveu) irPara('campeoes');
    else renderizar();
  };
  botao.onclick = fechar;
  overlay.onclick = e => { if (e.target === overlay) fechar(); };
  overlay.hidden = false;
}

function revelarPodio(cartao, aoTerminar) {
  const lugares = [3, 2, 1].map(degrau => cartao.querySelector(`.podio-lugar[data-degrau="${degrau}"]`)).filter(lugar => lugar.children.length);
  const animacoes = [];
  const relogios = [];
  let tocou = false;
  const soar = () => {
    if (!tocou) tocar('campeao');
    tocou = true;
  };
  let momento = PAUSA_ANTES_DO_PODIO;
  for (const lugar of lugares) {
    const campeao = lugar.dataset.degrau === '1';
    if (campeao) momento += SUSPENSE_DO_CAMPEAO;
    for (const pessoa of lugar.children) {
      animacoes.push(pessoa.animate(CHEGADA_AO_PODIO, { duration: DURACAO_DA_QUEDA, delay: momento, easing: 'steps(8, end)', fill: 'backwards' }));
      if (campeao) animacoes.push(pessoa.animate([{ filter: 'brightness(2.5)' }, { filter: 'none' }], { duration: 520, delay: momento + DURACAO_DA_QUEDA, easing: 'steps(4, end)' }));
    }
    if (campeao) relogios.push(setTimeout(soar, momento + DURACAO_DA_QUEDA / 2));
    momento += ENTRE_LUGARES_DO_PODIO;
  }
  const parar = () => {
    relogios.forEach(clearTimeout);
    animacoes.forEach(animacao => animacao.finish());
    cartao.classList.remove('revelando');
    cartao.onclick = null;
  };
  const terminar = () => {
    parar();
    soar();
    aoTerminar();
  };
  cartao.classList.add('revelando');
  cartao.onclick = terminar;
  relogios.push(setTimeout(terminar, momento));
  return parar;
}

function rolarInsignia(insignia, frase) {
  const lado = insignia.offsetWidth;
  const distancia = insignia.parentElement.clientWidth - lado;
  const giro = distancia / (lado / 2) * 180 / Math.PI;
  const tempo = { duration: DURACAO_DA_ROLAGEM, delay: ATRASO_DA_ROLAGEM, easing: 'cubic-bezier(0.25, 0.6, 0.35, 1)', fill: 'backwards' };
  insignia.animate([{ transform: `translateX(${distancia}px) rotate(${giro}deg)` }, { transform: 'none' }], tempo);
  frase.animate([{ clipPath: `inset(0 0 0 ${frase.offsetWidth}px)` }, { clipPath: 'inset(0 0 0 0)' }], tempo);
}

// Um toque que já vinha a caminho antes do aviso surgir não pode fechá-lo sem a pessoa ter visto.
const ESPERA_DOS_BOTOES = 1300;
let relogioDaConquista = null;
const PRAZO_DO_RESULTADO = 3 * 24 * 3600e3;
const INTERVALO_DO_PLACAR = 500;
let relogiosDoResultado = [];

function avisoAberto() {
  return ['celebracao', 'conquista', 'resultado'].some(id => !document.getElementById(id).hidden);
}

function verificarAvisos() {
  if (!estado?.eu.apelido || estado.gravando || avisoAberto() || convidarParaFrase()) return;
  const pendentes = resultadosPendentes();
  if (pendentes.length) mostrarResultado(pendentes[0], pendentes.length - 1);
  else if (!avisarDuelo()) verificarTitulosNovos();
}

function chaveDoResultado(partida) {
  return `partida:${partida.id}`;
}

function resultadosPendentes() {
  const vistos = avisosVistos();
  const limite = Date.now() - PRAZO_DO_RESULTADO;
  return estado.partidas.filter(p => p.estado === 'fechada' && p.abertaEm.getTime() > limite
    && p.placares.some(s => s.jogador === estado.eu.id) && !vistos.includes(chaveDoResultado(p)));
}

function marcarResultadoVisto(partida) {
  marcarComoVisto([chaveDoResultado(partida)]);
  const limite = Date.now() - PRAZO_DO_RESULTADO;
  const recentes = new Set(estado.partidas.filter(p => p.abertaEm.getTime() > limite).map(chaveDoResultado));
  const velhas = estado.eu.vistos.filter(c => c.startsWith('partida:') && !recentes.has(c));
  if (velhas.length) updateDoc(doc(banco, 'jogadores', estado.eu.id), { vistos: arrayRemove(...velhas) }).catch(() => {});
}

function contarAte(alvo, valor) {
  const inicio = performance.now();
  const avancar = agora => {
    const parte = Math.min(1, (agora - inicio) / (INTERVALO_DO_PLACAR - 100));
    alvo.textContent = formatoPlacar.format(parte < 1 ? Math.round(valor * parte) : valor);
    if (parte < 1) requestAnimationFrame(avancar);
  };
  requestAnimationFrame(avancar);
}

function mostrarResultado(partida, restantes) {
  const tela = document.getElementById('resultado');
  const caixa = tela.firstElementChild;
  const jogo = jogoDe(partida);
  const { eu } = estado;
  const notas = new Map(notasDaPartida(partidaParaFormula(partida)));
  const lugares = lugaresDaPartida(partida);
  const pior = Math.max(...lugares.values());
  const venci = lugares.get(eu.id) === 1 && pior > 1;
  const ordem = [...partida.placares].sort((a, b) => lugares.get(a.jogador) - lugares.get(b.jogador));

  document.getElementById('resultado-capa').replaceChildren(imagemDaCapa(jogo));
  document.getElementById('resultado-nome').textContent = jogo.nome;
  document.getElementById('resultado-data').textContent = quandoFoiAberta(partida);
  const linhas = ordem.map(({ jogador: id, valor }) => {
    const alguem = jogador(id);
    const lugar = lugares.get(id);
    const linha = criar('li', `jogador-linha${lugar === 1 && pior > 1 ? ' vencedor' : ''}${id === eu.id ? ' sou-eu' : ''}`);
    const placar = criar('span', 'valor');
    const numero = criar('span', '', '0');
    if (!jogo.semPlacar) placar.append(numero);
    placar.append(criar('span', 'detalhe', `nota ${formatoNota.format(notas.get(id))}`));
    linha.append(criar('span', 'posicao', `${lugar}º`), imagemDe(alguem, 'foto'), criar('span', '', alguem?.apelido || '?'), placar);
    return { linha, numero, valor };
  });
  document.getElementById('resultado-placar').replaceChildren(...linhas.map(l => l.linha));
  mostrarLinhaDoDuelo(document.getElementById('resultado-duelo'), partida);

  relogiosDoResultado.forEach(clearTimeout);
  relogiosDoResultado = [];
  let terminado = false;
  const terminar = () => {
    if (terminado) return;
    terminado = true;
    relogiosDoResultado.forEach(clearTimeout);
    linhas.forEach(l => {
      l.linha.classList.add('revelada');
      l.numero.textContent = formatoPlacar.format(l.valor);
    });
    caixa.classList.add('pronta');
    tocar(venci ? 'campeao' : 'partidaFechada');
  };
  caixa.classList.remove('pronta');
  if (POUCO_MOVIMENTO.matches) terminar();
  else {
    [...linhas].reverse().forEach((l, i) => relogiosDoResultado.push(setTimeout(() => {
      l.linha.classList.add('revelada');
      if (!jogo.semPlacar) contarAte(l.numero, l.valor);
      tocar('mover');
    }, INTERVALO_DO_PLACAR * (i + 1))));
    relogiosDoResultado.push(setTimeout(terminar, INTERVALO_DO_PLACAR * (linhas.length + 1) + 200));
  }

  const botao = document.getElementById('resultado-continuar');
  botao.textContent = restantes ? 'Próxima partida' : 'Continuar';
  botao.onclick = () => {
    tela.hidden = true;
    marcarResultadoVisto(partida);
    verificarAvisos();
  };
  caixa.onclick = e => {
    if (!terminado && !e.target.closest('button')) terminar();
  };
  tela.hidden = false;
}

function verificarTitulosNovos() {
  if (!estado?.eu.apelido || estado.gravando || avisoAberto()) return;
  const { tela, parametro } = rotaAtual();
  if (tituloSendoVisto && tela === 'titulo' && parametro === tituloSendoVisto) return;
  tituloSendoVisto = '';
  const novos = titulosNovos();
  if (!novos.length) return;
  mostrarConquista(novos[0]);
}

function imagemDoBrilho() {
  const linhas = ['...w...', '...w...', '..wyw..', 'wwy3yww', '..wyw..', '...w...', '...w...'];
  const cor = { w: '#ffffff', y: '#ffe38a', 3: '#f2c14e' };
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

function abrirConquista({ topo, palco, faixa, degraus, texto, detalhe, botaoVer, botaoOutro = '', botaoContinuar = 'Continuar', som = 'campeao', aoConcluir }) {
  const tela = document.getElementById('conquista');
  document.getElementById('conquista-topo').textContent = topo;
  document.getElementById('conquista-palco').replaceChildren(...palco);
  document.getElementById('conquista-faixa').replaceChildren(...(faixa ? [faixa] : []));
  document.getElementById('conquista-degraus').replaceChildren(...(degraus ? [degraus] : []));
  document.getElementById('conquista-texto').textContent = texto;
  document.getElementById('conquista-detalhe').textContent = detalhe;
  const continuar = document.getElementById('conquista-continuar');
  const outro = document.getElementById('conquista-outro');
  const ver = document.getElementById('conquista-ver');
  continuar.textContent = botaoContinuar;
  outro.textContent = botaoOutro;
  outro.hidden = !botaoOutro;
  ver.textContent = botaoVer;
  const abertaEm = Date.now();
  const espera = POUCO_MOVIMENTO.matches ? 400 : ESPERA_DOS_BOTOES;
  const concluir = escolha => {
    if (Date.now() - abertaEm < espera) return;
    tela.hidden = true;
    aoConcluir(escolha);
    verificarAvisos();
  };
  continuar.onclick = () => concluir('continuar');
  outro.onclick = () => concluir('outro');
  ver.onclick = () => concluir('ver');
  // Forçar o recálculo do layout reinicia as animações quando um aviso vem logo depois do outro.
  const caixa = tela.firstElementChild;
  caixa.classList.remove('animando', 'pronta');
  void caixa.offsetWidth;
  caixa.classList.add('animando');
  clearTimeout(relogioDaConquista);
  relogioDaConquista = setTimeout(() => caixa.classList.add('pronta'), espera);
  tela.hidden = false;
  encaixarFaixa(document.getElementById('conquista-faixa'));
  setTimeout(() => tocar(som), POUCO_MOVIMENTO.matches ? 0 : 380);
}

function mostrarConquista(situacao) {
  const { titulo, nivel, alcancados, antes } = situacao;
  const sobe = antes > 0;
  const quadro = quadroDoTitulo(sobe ? { ...situacao, nivel: NIVEIS[antes - 1] } : situacao, true);
  const subir = () => {
    quadro.classList.replace(`nivel-${NIVEIS[antes - 1]}`, `nivel-${nivel}`);
    quadro.querySelector('.moldura-titulo').src = `midia/titulos/moldura-${nivel}.png`;
  };
  if (sobe && !POUCO_MOVIMENTO.matches) {
    setTimeout(() => {
      subir();
      quadro.classList.add('clarao');
    }, 520);
  } else if (sobe) {
    subir();
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
    aoConcluir: escolha => {
      marcarComoVisto([situacao.chave]);
      if (escolha !== 'ver') return;
      tituloSendoVisto = titulo.id;
      irPara('titulo', titulo.id);
    },
  });
}

function esquecerAvisos() {
  tituloSendoVisto = '';
  mesDoConvite = '';
}

export { desenharPodio, vagaNoPodio, PRAZO_DO_RESULTADO, verificarAvisos, abrirConquista, esquecerAvisos };
