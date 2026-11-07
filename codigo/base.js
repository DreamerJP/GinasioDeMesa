import { doc, updateDoc, arrayUnion } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { banco, lidos, estado } from './app.js?v=101';

const CHAVE_SOM = 'ginasio.som';
const FUSO = 'America/Sao_Paulo';
const DIAS_PARA_FECHAR_O_MES = 7;
const LIMITE_FOTO = 45000;
const MAXIMO_DE_ROSTOS = 8;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SONS = {
  mover: 'midia/sons/som-mover.wav',
  escolher: 'midia/sons/som-escolher.wav',
  confirmar: 'midia/sons/som-confirmar.wav',
  partidaFechada: 'midia/sons/som-partida-fechada.wav',
  campeao: 'midia/sons/som-campeao.wav',
  erro: 'midia/sons/som-erro.wav',
};

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const INSIGNIAS = [
  { nome: 'Insígnia do Canto', trecho: 'Mar de verão', lore: 'A baleia desta insígnia veio do mar de verão. Encostada no ouvido, ainda se ouve o canto dela.' },
  { nome: 'Insígnia do Trovão', trecho: 'Tempestade de verão', lore: 'Os raios desta insígnia guardam a energia da tempestade de verão. Na mão, ela vibra como se o trovão ainda estivesse preso dentro.' },
  { nome: 'Insígnia da Maré', trecho: 'Praia no fim do verão', lore: 'Água-viva presa num globo de resina, recolhida quando a maré baixou. No escuro, ela ainda acende devagar.' },
  { nome: 'Insígnia do Vento', trecho: 'Planície dos ventos', lore: 'Um galho florido arrancado pela ventania das planícies. As folhas ainda estão viradas para o lado em que o vento soprou.' },
  { nome: 'Insígnia da Teia', trecho: 'Bosque das teias', lore: 'A aranha desta insígnia veio do bosque das teias. Os fios dela ainda brilham com o orvalho da manhã.' },
  { nome: 'Insígnia da Lã', trecho: 'Pasto de nuvens', lore: 'A ovelha desta insígnia veio do pasto de nuvens. É tão macia que parece feita da própria nuvem.' },
  { nome: 'Insígnia da Geada', trecho: 'Campos de gelo', lore: 'Floco de neve que não derrete, trazido dos campos de gelo. Deixa frio o bolso de quem o carrega.' },
  { nome: 'Insígnia do Cume', trecho: 'Pico da montanha', lore: 'O pico e a lua desta insígnia vêm do ponto mais alto da travessia. Na mão, ela pesa como a própria montanha.' },
  { nome: 'Insígnia da Asa', trecho: 'Vale do canto', lore: 'O pássaro desta insígnia veio do vale do canto. As asas dele guardam o primeiro vento da primavera.' },
  { nome: 'Insígnia da Flor', trecho: 'Jardim de espinhos', lore: 'Flor de cristal colhida no jardim de espinhos. Não murcha, e o caule ainda espeta quem a segura.' },
  { nome: 'Insígnia da Estrela', trecho: 'Bosque estrelado', lore: 'No alto do bosque estrelado, as noites são tão claras que dá para ler o mapa sem lanterna.' },
  { nome: 'Insígnia dos Confins', trecho: 'Confins do mapa', lore: 'Bússola achada nos confins do mapa. A agulha não aponta para o norte, aponta o caminho de volta.' },
].map((insignia, i) => ({ ...insignia, imagem: `midia/insignias/insignia-${String(i + 1).padStart(2, '0')}.webp` }));

const CASAS_DA_NOTA = 3;
const HORA_QUE_O_DIA_VIRA = 8;
const formatoNota = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: CASAS_DA_NOTA, maximumFractionDigits: CASAS_DA_NOTA });
const formatoPlacar = new Intl.NumberFormat('pt-BR');
const POUCO_MOVIMENTO = matchMedia('(prefers-reduced-motion: reduce)');
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
  mostrarSom();
  tocar('escolher');
}

function mostrarSom() {
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

function jogoDe(partida) {
  return estado.jogos.find(j => j.id === partida.jogo) || { nome: 'Jogo removido', menorVence: false, semPlacar: false };
}

function jogador(id) {
  return estado.jogadores.find(j => j.id === id);
}

function indiceDoMes(mes) {
  return Number(mes.slice(5, 7)) - 1;
}

function nomeDoMes(mes) {
  return `${MESES[indiceDoMes(mes)]} de ${mes.slice(0, 4)}`;
}

function nomeDoMesComAnoSeOutro(mes) {
  return mes.slice(0, 4) === estado.mesAtual.slice(0, 4) ? MESES[indiceDoMes(mes)] : `${MESES[indiceDoMes(mes)]}/${mes.slice(0, 4)}`;
}

// A gravação no servidor demora a voltar; sem esta lista o mesmo aviso abriria de novo nesse meio-tempo.
const vistosNestaSessao = new Set();

function avisosVistos() {
  return [...new Set([...estado.eu.vistos, ...vistosNestaSessao])];
}

function marcarComoVisto(chaves) {
  if (estado.eu.observador) return;
  const novas = chaves.filter(c => !estado.eu.vistos.includes(c));
  novas.forEach(c => vistosNestaSessao.add(c));
  if (novas.length) updateDoc(doc(banco, 'jogadores', estado.eu.id), { vistos: arrayUnion(...novas) }).catch(() => {});
}

const formatoHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
const formatoDia = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long', day: 'numeric' });
const formatoDataLonga = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
const formatoDiaDaMesa = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });
const formatoDiaCurto = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' });
const formatoDataDoDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });

function diaDaMesa(momento) {
  return formatoDiaDaMesa.format(new Date(momento.getTime() - HORA_QUE_O_DIA_VIRA * 3600e3));
}

function quandoFoiAberta(partida) {
  if (!partida.abertaEm.getTime()) return '';
  const dia = formatoDataLonga.format(partida.abertaEm);
  return dia[0].toUpperCase() + dia.slice(1) + (partida.abertaPor ? ` às ${formatoHora.format(partida.abertaEm)}` : '');
}

function diaDaPartida(momento) {
  const partes = formatoDia.formatToParts(momento);
  return `${partes.find(p => p.type === 'weekday').value}, dia ${partes.find(p => p.type === 'day').value}`;
}

function mesDoCalendario() {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${partes.find(p => p.type === 'year').value}-${partes.find(p => p.type === 'month').value}`;
}

function mesSeguinte(mes) {
  const [ano, numero] = mes.split('-').map(Number);
  return numero === 12 ? `${ano + 1}-01` : `${ano}-${String(numero + 1).padStart(2, '0')}`;
}

function mesDeHoje() {
  const mes = mesDoCalendario();
  return lidos.fechamentos?.some(f => f.id === mes) ? mesSeguinte(mes) : mes;
}

function diasAteOFim(mes, hoje = new Date()) {
  const [ano, numero] = mes.split('-').map(Number);
  return Math.round((new Date(ano, numero, 0) - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) / 864e5);
}

function podeFecharOMes() {
  const mes = mesDoCalendario();
  return estado.eu.admin && estado.mesAtual === mes && diasAteOFim(mes) < DIAS_PARA_FECHAR_O_MES;
}

function textoFechamento(mesAtual) {
  const faltam = diasAteOFim(mesAtual);
  if (faltam <= 0) return 'Fecha hoje à meia-noite';
  if (faltam === 1) return 'Fecha amanhã';
  return `Fecha em ${faltam} dias`;
}

function criar(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

const QUANTOS_MEEPLES = 12;
const CORES_DAS_CAIXAS = ['vermelha', 'azul', 'verde', 'laranja'];

function numeroDoTexto(texto) {
  let numero = 0;
  for (const letra of texto) numero = (numero * 31 + letra.charCodeAt(0)) >>> 0;
  return numero;
}

// Distribui os meeples entre quem está sem foto para que dois jogadores não fiquem com o mesmo enquanto houver sobrando.
function avatarPadrao(alguem) {
  const id = alguem?.id || alguem?.apelido || '?';
  const usados = new Set();
  const semFoto = (estado?.jogadores || []).filter(j => !j.foto).sort((a, b) => a.id.localeCompare(b.id));
  for (const outro of semFoto) {
    let numero = numeroDoTexto(outro.id) % QUANTOS_MEEPLES;
    while (usados.has(numero) && usados.size < QUANTOS_MEEPLES) numero = (numero + 1) % QUANTOS_MEEPLES;
    usados.add(numero);
    if (outro.id === id) return `midia/avatares/meeple-${numero + 1}.png`;
  }
  return `midia/avatares/meeple-${numeroDoTexto(id) % QUANTOS_MEEPLES + 1}.png`;
}

function capaPadrao(nome) {
  return `midia/avatares/caixa-${CORES_DAS_CAIXAS[numeroDoTexto(nome) % CORES_DAS_CAIXAS.length]}.png`;
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
  return alguem?.foto || avatarPadrao(alguem);
}

function mostrarFoto(imagem, alguem) {
  imagem.onerror = () => {
    imagem.onerror = null;
    imagem.src = avatarPadrao(alguem);
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

function desenhoDaInsignia(indice, ganha, grande = false) {
  const { imagem } = INSIGNIAS[indice];
  const desenho = criar('span', `insignia com-imagem${ganha ? ' ganha' : ''}${grande ? ' grande brilha' : ''}`);
  const figura = criar('img');
  figura.alt = '';
  figura.src = imagem;
  desenho.append(figura);
  desenho.style.setProperty('--imagem', `url(${imagem})`);
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

export {
  LIMITE_FOTO, MAXIMO_DE_ROSTOS, EMAIL_VALIDO, MESES, INSIGNIAS, CASAS_DA_NOTA, formatoNota, formatoPlacar, POUCO_MOVIMENTO,
  alternarSom, mostrarSom, tocar, jogoDe, jogador, indiceDoMes, nomeDoMes, nomeDoMesComAnoSeOutro, vistosNestaSessao, avisosVistos, marcarComoVisto,
  formatoHora, formatoDiaDaMesa, formatoDiaCurto, formatoDataDoDia, diaDaMesa, quandoFoiAberta, diaDaPartida, mesSeguinte, mesDeHoje, podeFecharOMes,
  textoFechamento, criar, avatarPadrao, imagemDaCapa, mostrarCapa, mostrarFoto, imagemDe, desenhoDaInsignia, svgEmImagem,
};
