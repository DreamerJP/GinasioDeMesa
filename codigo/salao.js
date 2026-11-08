import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { POUCO_MOVIMENTO, tocar, criar } from './base.js';
import { SERVIDORES, PRINCIPAL, email, servidor, estado, trocarDeServidor, pendenciasDe, entrarComGoogle, mostrarEntrada } from './app.js';

// Medidas em pixels da arte de salao.png e salao-mesas.png. Na folha das mesas, a linha de cima tem
// o lampião aceso e a de baixo, apagado. Com mais de duas mesas o chão cresce repetindo a faixa de
// tábuas logo acima do corte; a faixa vai de uma emenda de tábuas à seguinte, então as cópias se encaixam.
const SALAO = { largura: 255, altura: 316, corte: 235, faixa: 54, primeiraFileira: 108, margem: 6 };
const MESAS = [
  { x: 0, largura: 117, placa: [61, 91] },
  { x: 117, largura: 104, placa: [41, 91] },
];
const ALTURA_DA_MESA = 121;
const AMPLIACAO_DO_SALAO = 4;
const TOALHA_DA_ARTE = [63, 129, 72];
let imagensDoSalao = null;
let mesaEscolhida = '';

function carregarImagem(endereco) {
  const imagem = new Image();
  imagem.src = endereco;
  return imagem.decode().then(() => imagem);
}

function carregarSalao() {
  imagensDoSalao ??= Promise.all(['salao', 'salao-mesas'].map(nome => carregarImagem(`midia/site/${nome}.png?v=2`))).catch(erro => {
    imagensDoSalao = null;
    throw erro;
  });
  return imagensDoSalao;
}

function emOklab([r, g, b]) {
  const linear = c => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [lr, lg, lb] = [r, g, b].map(linear);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

function deOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ].map(c => {
    const limitado = Math.min(1, Math.max(0, c));
    return Math.round(255 * (limitado <= 0.0031308 ? 12.92 * limitado : 1.055 * limitado ** (1 / 2.4) - 0.055));
  });
}

function eDaToalha(r, g, b) {
  const maior = Math.max(r, g, b);
  const menor = Math.min(r, g, b);
  if (g !== maior || maior === menor || (maior - menor) / maior <= 0.25) return false;
  return Math.abs(120 + 60 * (b - r) / (maior - menor) - 128) < 40;
}

// Só a toalha usa verde na arte. Cada tom de verde vira a cor do servidor deslocada pela mesma
// diferença de claridade que esse tom tem em relação a TOALHA_DA_ARTE.
function pintarMesa(folha, mesa, linha, cor) {
  const tela = document.createElement('canvas');
  tela.width = mesa.largura;
  tela.height = ALTURA_DA_MESA;
  const contexto = tela.getContext('2d', { willReadFrequently: true });
  contexto.drawImage(folha, mesa.x, linha * ALTURA_DA_MESA, mesa.largura, ALTURA_DA_MESA, 0, 0, mesa.largura, ALTURA_DA_MESA);
  const pixels = contexto.getImageData(0, 0, tela.width, tela.height);
  const base = emOklab(TOALHA_DA_ARTE);
  const alvo = emOklab(cor.match(/\w\w/g).map(par => parseInt(par, 16)));
  const proporcao = Math.hypot(alvo[1], alvo[2]) / Math.hypot(base[1], base[2]);
  const angulo = Math.atan2(alvo[2], alvo[1]);
  const trocas = new Map();
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3] || !eDaToalha(d[i], d[i + 1], d[i + 2])) continue;
    const chave = d[i] * 65536 + d[i + 1] * 256 + d[i + 2];
    if (!trocas.has(chave)) {
      const [L, a, b] = emOklab([d[i], d[i + 1], d[i + 2]]);
      const croma = Math.hypot(a, b) * proporcao;
      trocas.set(chave, deOklab([alvo[0] + L - base[0], Math.cos(angulo) * croma, Math.sin(angulo) * croma]));
    }
    [d[i], d[i + 1], d[i + 2]] = trocas.get(chave);
  }
  contexto.putImageData(pixels, 0, 0);
  return tela;
}

function ampliar(destino, origem) {
  const contexto = destino.getContext('2d');
  contexto.imageSmoothingEnabled = false;
  contexto.drawImage(origem, 0, 0, destino.width, destino.height);
}

function desenharFundo(tela, salao, fileiras) {
  const { largura, altura, corte, faixa } = SALAO;
  const contexto = tela.getContext('2d');
  contexto.imageSmoothingEnabled = false;
  const copiar = (y, alto, destino) => contexto.drawImage(salao, 0, y, largura, alto, 0, destino * AMPLIACAO_DO_SALAO, largura * AMPLIACAO_DO_SALAO, alto * AMPLIACAO_DO_SALAO);
  const extras = (fileiras - 1) * 2;
  copiar(0, corte, 0);
  for (let i = 0; i < extras; i++) copiar(corte - faixa, faixa, corte + i * faixa);
  copiar(corte, altura - corte, corte + extras * faixa);
}

function montarSalao(lista) {
  const mesas = document.getElementById('salao-mesas');
  const assinatura = lista.map(cada => cada.id).join();
  if (mesas.dataset.servidores === assinatura) return;
  mesas.dataset.servidores = assinatura;
  const fileiras = Math.ceil(lista.length / 2);
  const altura = SALAO.altura + (fileiras - 1) * 2 * SALAO.faixa;
  document.querySelector('.salao-cena').style.setProperty('--altura', altura);
  const fundo = document.getElementById('salao-fundo');
  fundo.width = SALAO.largura * AMPLIACAO_DO_SALAO;
  fundo.height = altura * AMPLIACAO_DO_SALAO;
  const lugares = lista.map((cada, i) => {
    const mesa = MESAS[i % MESAS.length];
    const sozinha = i % 2 === 0 && i === lista.length - 1;
    const x = sozinha ? Math.round((SALAO.largura - mesa.largura) / 2) : i % 2 ? SALAO.largura - SALAO.margem - mesa.largura : SALAO.margem;
    const y = SALAO.primeiraFileira + Math.floor(i / 2) * 2 * SALAO.faixa;
    const botao = criar('button', 'mesa');
    botao.type = 'button';
    botao.dataset.servidor = cada.id;
    Object.assign(botao.style, { left: `${x / SALAO.largura * 100}%`, top: `${y / altura * 100}%`, width: `${mesa.largura / SALAO.largura * 100}%` });
    const telas = [['mesa-apagada', 1], ['mesa-acesa', 0]].map(([classe, linha]) => {
      const tela = criar('canvas', classe);
      tela.width = mesa.largura * AMPLIACAO_DO_SALAO;
      tela.height = ALTURA_DA_MESA * AMPLIACAO_DO_SALAO;
      return { tela, linha };
    });
    const nome = criar('span', 'mesa-nome', cada.nome);
    Object.assign(nome.style, { left: `${mesa.placa[0] / mesa.largura * 100}%`, top: `${mesa.placa[1] / ALTURA_DA_MESA * 100}%` });
    const selo = criar('span', 'selo-menu mesa-selo');
    selo.hidden = true;
    Object.assign(selo.style, { left: `${(mesa.placa[0] + 22) / mesa.largura * 100}%`, top: `${(mesa.placa[1] - 15) / ALTURA_DA_MESA * 100}%` });
    botao.append(...telas.map(({ tela }) => tela), nome, selo);
    return { botao, mesa, cor: cada.cor, telas };
  });
  mesas.replaceChildren(...lugares.map(({ botao }) => botao));
  carregarSalao().then(([salao, folha]) => {
    if (mesas.dataset.servidores !== assinatura) return;
    desenharFundo(fundo, salao, fileiras);
    for (const { mesa, cor, telas } of lugares) {
      for (const { tela, linha } of telas) ampliar(tela, pintarMesa(folha, mesa, linha, cor));
    }
  }).catch(() => {});
}

// Pixels da arte de salao.png; desenho, descanso e canaleta contam a partir do x e y do quadro.
const QUADRO_NEGRO = { x: 128, y: 16, desenho: [5, 7], interior: [5, 7, 64, 46], descanso: [50, 46] };
const GIZ_NA_CANALETA = { x: 51, y: 47, largura: 7, fundo: [172, 63] };
const GIZ_LEVANTADO = [
  [0, 0, '#d6cdc0'], [1, -1, '#ece6da'], [2, -2, '#ece6da'], [3, -3, '#ece6da'], [4, -4, '#ece6da'],
  [2, -1, '#a99f91'], [3, -2, '#a99f91'], [4, -3, '#a99f91'], [5, -4, '#a99f91'],
];
const DESENHOS_DO_GIZ = ['coelho', 'c4-na-arvore', 'trevo', 'pipoca', 'granola'];
const FOTOS_DO_QUADRO = ['grupo'];
const CORES_DO_GIZ = ['#d6cdc0', '#c9c0b3', '#e3dbce'];
const VIZINHOS_DO_PIXEL = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const VELOCIDADE_DO_TRACO = 50;
const VELOCIDADE_DO_GIZ = 160;
const VELOCIDADE_DO_APAGADOR = 120;
const APAGADOR = { descanso: [12, 45], largura: 8, intervalo: 6, area: [5, 7, 57, 44], linhas: ['#d29b65', '#a3724a', '#8a8590'] };
const POEIRA_DO_APAGADOR = { rastro: [0.06, 0.07, 0.06, 0.05, 0.03, 0.02], sobra: 0.35, maxima: 0.16, minima: 0.02 };
const TEMPOS_DO_QUADRO = { pronto: 6000, pausa: 1200 };
const POLAROIDE = { margem: 2, rodape: 5, papel: '#e8e2d4', fita: [9, 3, '#ecdea0', 0.75], sombra: ['#14141c', 0.5] };
const TEMPOS_DA_FOTO = { etapas: 4, etapa: 80, parada: 8000 };
const CHAVE_DO_QUADRO = 'ginasio.quadro';
let itensDoQuadro = null;
let filaDoQuadro = null;
let quadroAnimado = null;

function carregarItensDoQuadro() {
  itensDoQuadro ??= Promise.all([
    ...DESENHOS_DO_GIZ.map(nome => carregarImagem(`midia/site/giz/${nome}.png?v=1`).then(imagem => ({ nome: `giz/${nome}`, pixels: pixelsDoDesenho(imagem) }))),
    ...FOTOS_DO_QUADRO.map(nome => carregarImagem(`midia/site/fotos/${nome}.png?v=1`).then(foto => ({ nome: `fotos/${nome}`, foto }))),
  ]).catch(erro => {
    itensDoQuadro = null;
    throw erro;
  });
  return itensDoQuadro;
}

function pixelsDoDesenho(imagem) {
  const tela = document.createElement('canvas');
  tela.width = imagem.width;
  tela.height = imagem.height;
  const contexto = tela.getContext('2d');
  contexto.drawImage(imagem, 0, 0);
  const { data } = contexto.getImageData(0, 0, tela.width, tela.height);
  const [x0, y0] = QUADRO_NEGRO.desenho;
  const pixels = [];
  for (let y = 0; y < tela.height; y++) {
    for (let x = 0; x < tela.width; x++) if (data[(y * tela.width + x) * 4 + 3] > 127) pixels.push([x0 + x, y0 + y]);
  }
  return pixels;
}

function vizinhoMaisReto(atual, direcao, candidatos) {
  let escolhido = null;
  let menor = Infinity;
  for (const pixel of candidatos) {
    const dx = pixel[0] - atual[0];
    const dy = pixel[1] - atual[1];
    const curva = direcao ? 1 - (dx * direcao[0] + dy * direcao[1]) / Math.hypot(dx, dy) / Math.hypot(...direcao) : 0;
    const custo = curva + (dx && dy ? 0.05 : 0);
    if (custo < menor) {
      menor = custo;
      escolhido = pixel;
    }
  }
  return escolhido;
}

function maisProximo(pixels, [x, y]) {
  let escolhido = null;
  let menor = Infinity;
  for (const pixel of pixels) {
    const distancia = Math.hypot(pixel[0] - x, pixel[1] - y);
    if (distancia < menor) {
      menor = distancia;
      escolhido = pixel;
    }
  }
  return escolhido;
}

function chaveDoPixel(x, y) {
  return y * 1000 + x;
}

// Ao levantar, o giz recomeça na ponta do traço mais próximo; começando no meio, a outra metade
// ficaria para uma volta depois.
function ordemDoTraco(pixels) {
  const restantes = new Map(pixels.map(pixel => [chaveDoPixel(...pixel), pixel]));
  const vizinhos = ([x, y], fora) => VIZINHOS_DO_PIXEL
    .map(([dx, dy]) => restantes.get(chaveDoPixel(x + dx, y + dy)))
    .filter(pixel => pixel && !fora?.has(pixel));
  const ordem = [];
  let atual = null;
  let direcao = null;
  while (restantes.size) {
    let proximo = atual && vizinhoMaisReto(atual, direcao, vizinhos(atual));
    if (proximo) direcao = [proximo[0] - atual[0], proximo[1] - atual[1]];
    else {
      proximo = maisProximo(restantes.values(), atual ?? QUADRO_NEGRO.descanso);
      const percorridos = new Set([proximo]);
      let sentido = null;
      for (let seguinte; (seguinte = vizinhoMaisReto(proximo, sentido, vizinhos(proximo, percorridos)));) {
        sentido = [seguinte[0] - proximo[0], seguinte[1] - proximo[1]];
        percorridos.add(seguinte);
        proximo = seguinte;
      }
      direcao = null;
    }
    restantes.delete(chaveDoPixel(...proximo));
    ordem.push(proximo);
    atual = proximo;
  }
  return ordem;
}

function retaEntre(x0, y0, x1, y1) {
  const pontos = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  let erro = dx + dy;
  while (x0 !== x1 || y0 !== y1) {
    const dobro = 2 * erro;
    if (dobro >= dy) {
      erro += dy;
      x0 += Math.sign(x1 - x0);
    }
    if (dobro <= dx) {
      erro += dx;
      y0 += Math.sign(y1 - y0);
    }
    pontos.push([x0, y0]);
  }
  return pontos;
}

function sortear(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

function areaDoApagador(ordem) {
  const [menorX, menorY, maiorX, maiorY] = APAGADOR.area;
  const limitar = (valor, menor, maior) => Math.min(maior, Math.max(menor, valor));
  const xs = ordem.map(([x]) => x);
  const ys = ordem.map(([, y]) => y);
  const esquerda = limitar(Math.min(...xs) - 1, menorX, maiorX);
  const direita = limitar(Math.max(...xs) - APAGADOR.largura + 2, esquerda, maiorX);
  const colunas = [];
  for (let x = esquerda; ; x += APAGADOR.intervalo) {
    colunas.push(Math.min(x, direita));
    if (x >= direita) break;
  }
  const topo = limitar(Math.min(...ys) - 1, menorY, maiorY);
  const base = limitar(Math.max(...ys) - APAGADOR.linhas.length + 2, topo, maiorY);
  return { colunas, topo, base };
}

function roteiroDoQuadro(ordem) {
  const passos = [];
  let tempo = 0;
  const marcar = (espera, passo) => {
    tempo += espera;
    passos.push({ tempo, ...passo });
  };
  let giz = QUADRO_NEGRO.descanso;
  const levarGiz = alvo => {
    for (const ponto of retaEntre(...giz, ...alvo)) marcar(1000 / VELOCIDADE_DO_GIZ, { giz: ponto });
    giz = alvo;
  };
  for (const ponto of ordem) {
    if (Math.max(Math.abs(ponto[0] - giz[0]), Math.abs(ponto[1] - giz[1])) > 1) levarGiz(ponto);
    marcar(1000 / VELOCIDADE_DO_TRACO, { giz: ponto, risca: sortear(CORES_DO_GIZ) });
    giz = ponto;
  }
  levarGiz(QUADRO_NEGRO.descanso);
  marcar(1000 / VELOCIDADE_DO_GIZ, { giz: null });
  let apagador = APAGADOR.descanso;
  const levarApagador = (alvo, passada) => {
    const espera = 1000 / (passada ? VELOCIDADE_DO_APAGADOR : VELOCIDADE_DO_GIZ);
    for (const ponto of retaEntre(...apagador, ...alvo)) marcar(espera, { apagador: ponto, passada });
    apagador = alvo;
  };
  const { colunas, topo, base } = areaDoApagador(ordem);
  tempo += TEMPOS_DO_QUADRO.pronto;
  levarApagador([colunas[0], topo]);
  colunas.forEach((x, i) => {
    if (i) levarApagador([x, apagador[1]], { dx: 1, dy: 0 });
    const alvo = apagador[1] === topo ? base : topo;
    levarApagador([x, alvo], { dx: 0, dy: Math.sign(alvo - apagador[1]) });
  });
  levarApagador(APAGADOR.descanso);
  marcar(TEMPOS_DO_QUADRO.pausa, {});
  return passos;
}

function roteiroDaFoto() {
  const passos = [];
  let tempo = 0;
  const marcar = (espera, etapaDaFoto) => {
    tempo += espera;
    passos.push({ tempo, etapaDaFoto });
  };
  const { etapas, etapa: duracao, parada } = TEMPOS_DA_FOTO;
  for (let etapa = 1; etapa <= etapas; etapa++) marcar(duracao, etapa);
  for (let etapa = etapas - 1; etapa >= 0; etapa--) marcar(etapa === etapas - 1 ? parada : duracao, etapa);
  marcar(TEMPOS_DO_QUADRO.pausa, 0);
  return passos;
}

function sujarQuadro(quadro, x, y, quantidade, passada) {
  const [esquerda, topo, direita, base] = QUADRO_NEGRO.interior;
  const chave = chaveDoPixel(x, y);
  if (x < esquerda || x > direita || y < topo || y > base || quadro.riscos.has(chave)) return;
  const poeira = quadro.poeira.get(chave) ?? [x, y, 0];
  poeira[2] = Math.min(POEIRA_DO_APAGADOR.maxima, poeira[2] + quantidade);
  quadro.poeira.set(chave, poeira);
  quadro.passadas.set(chave, passada);
}

// Cada pixel é limpo uma vez por passada; o pó que o apagador arrasta fica atrás dele, já fora da passada.
function passarApagador(quadro, [ax, ay], passada) {
  const { rastro, sobra, minima } = POEIRA_DO_APAGADOR;
  for (let y = ay; y < ay + APAGADOR.linhas.length; y++) {
    for (let x = ax; x < ax + APAGADOR.largura; x++) {
      const chave = chaveDoPixel(x, y);
      if (quadro.passadas.get(chave) === passada) continue;
      quadro.passadas.set(chave, passada);
      if (quadro.riscos.delete(chave)) {
        rastro.forEach((quantidade, distancia) => {
          const desvio = sortear([-1, 0, 0, 1]);
          sujarQuadro(quadro, x - passada.dx * distancia + passada.dy * desvio, y - passada.dy * distancia + passada.dx * desvio, quantidade, passada);
        });
        continue;
      }
      const poeira = quadro.poeira.get(chave);
      if (!poeira) continue;
      poeira[2] *= sobra;
      if (poeira[2] < minima) quadro.poeira.delete(chave);
    }
  }
}

function aplicarPasso(quadro, passo) {
  if ('etapaDaFoto' in passo) quadro.etapaDaFoto = passo.etapaDaFoto;
  if ('giz' in passo) quadro.giz = passo.giz;
  if (passo.risca) quadro.riscos.set(chaveDoPixel(...passo.giz), [...passo.giz, passo.risca]);
  if (!passo.apagador) return;
  quadro.apagador = passo.apagador;
  if (passo.passada) passarApagador(quadro, passo.apagador, passo.passada);
}

function embaralhar(lista) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

function proximoItemDoQuadro(itens) {
  const nomes = itens.map(item => item.nome);
  if (!filaDoQuadro) {
    try {
      filaDoQuadro = JSON.parse(localStorage.getItem(CHAVE_DO_QUADRO));
    } catch {}
    if (!Array.isArray(filaDoQuadro?.fila)) filaDoQuadro = { fila: [], ultimo: '' };
  }
  let fila = filaDoQuadro.fila.filter(nome => nomes.includes(nome));
  if (!fila.length) {
    fila = embaralhar([...nomes]);
    if (fila[0] === filaDoQuadro.ultimo && fila.length > 1) fila.push(fila.shift());
  }
  const [nome, ...resto] = fila;
  filaDoQuadro = { fila: resto, ultimo: nome };
  try {
    localStorage.setItem(CHAVE_DO_QUADRO, JSON.stringify(filaDoQuadro));
  } catch {}
  return itens[nomes.indexOf(nome)];
}

function trocarItemDoQuadro(quadro) {
  const item = proximoItemDoQuadro(quadro.itens);
  quadro.item = item;
  if (item.foto) quadro.passos = roteiroDaFoto();
  else {
    item.ordem ??= ordemDoTraco(item.pixels);
    quadro.passos = roteiroDoQuadro(item.ordem);
  }
  quadro.passo = 0;
  quadro.passadas = new Map();
  quadro.inicio = quadro.relogio;
}

function pintarFoto(contexto, foto, etapa) {
  const lado = AMPLIACAO_DO_SALAO;
  const { margem, rodape, papel, fita: [larguraDaFita, alturaDaFita, corDaFita, alfaDaFita], sombra: [corDaSombra, alfaDaSombra] } = POLAROIDE;
  const [esquerda, topo, direita, base] = QUADRO_NEGRO.interior;
  const largura = foto.width + 2 * margem;
  const altura = foto.height + margem + rodape;
  const x = esquerda + Math.floor((direita - esquerda + 1 - largura) / 2);
  const y = topo + Math.floor((base - topo + 1 - altura) / 2) - TEMPOS_DA_FOTO.etapas + etapa;
  const opacidade = etapa / TEMPOS_DA_FOTO.etapas;
  const retangulo = (rx, ry, rl, ra, cor, alfa = 1) => {
    contexto.globalAlpha = opacidade * alfa;
    contexto.fillStyle = cor;
    contexto.fillRect(rx * lado, ry * lado, rl * lado, ra * lado);
  };
  retangulo(x + largura, y + 1, 1, altura, corDaSombra, alfaDaSombra);
  retangulo(x + 1, y + altura, largura - 1, 1, corDaSombra, alfaDaSombra);
  retangulo(x, y, largura, altura, papel);
  contexto.globalAlpha = opacidade;
  contexto.drawImage(foto, (x + margem) * lado, (y + margem) * lado, foto.width * lado, foto.height * lado);
  retangulo(x + Math.round((largura - larguraDaFita) / 2), y - 1, larguraDaFita, alturaDaFita, corDaFita, alfaDaFita);
  contexto.globalAlpha = 1;
}

function pintarQuadro(quadro) {
  const contexto = quadro.tela.getContext('2d');
  const lado = AMPLIACAO_DO_SALAO;
  const pixel = (x, y, cor, largura = 1) => {
    contexto.fillStyle = cor;
    contexto.fillRect(x * lado, y * lado, largura * lado, lado);
  };
  contexto.clearRect(0, 0, quadro.tela.width, quadro.tela.height);
  for (const [x, y, alfa] of quadro.poeira.values()) {
    contexto.globalAlpha = alfa;
    pixel(x, y, CORES_DO_GIZ[0]);
  }
  contexto.globalAlpha = 1;
  for (const [x, y, cor] of quadro.riscos.values()) pixel(x, y, cor);
  contexto.imageSmoothingEnabled = false;
  if (quadro.etapaDaFoto) pintarFoto(contexto, quadro.item.foto, quadro.etapaDaFoto);
  const [ax, ay] = quadro.apagador;
  APAGADOR.linhas.forEach((cor, linha) => pixel(ax, ay + linha, cor, APAGADOR.largura));
  if (!quadro.giz) return;
  const { x, y, largura, fundo: [fx, fy] } = GIZ_NA_CANALETA;
  contexto.drawImage(quadro.salao, fx, fy, largura, 1, x * lado, y * lado, largura * lado, lado);
  for (const [dx, dy, cor] of GIZ_LEVANTADO) pixel(quadro.giz[0] + dx, quadro.giz[1] + dy, cor);
}

function avancarQuadro(agora) {
  const quadro = quadroAnimado;
  if (!quadro.tela.getClientRects().length) {
    quadro.tela.getContext('2d').clearRect(0, 0, quadro.tela.width, quadro.tela.height);
    quadroAnimado = null;
    return;
  }
  quadro.relogio += Math.min(100, Math.max(0, agora - quadro.ultimo));
  quadro.ultimo = agora;
  let mudou = false;
  for (;;) {
    if (quadro.passo === quadro.passos.length) trocarItemDoQuadro(quadro);
    const passo = quadro.passos[quadro.passo];
    if (quadro.relogio - quadro.inicio < passo.tempo) break;
    aplicarPasso(quadro, passo);
    quadro.passo++;
    mudou = true;
  }
  if (mudou) pintarQuadro(quadro);
  requestAnimationFrame(avancarQuadro);
}

function animarQuadro() {
  if (quadroAnimado) return;
  quadroAnimado = {};
  Promise.all([carregarSalao(), carregarItensDoQuadro()]).then(([[salao], itens]) => {
    const quadro = {
      tela: document.getElementById('salao-quadro'), salao, itens, item: null, relogio: 0, ultimo: performance.now(),
      riscos: new Map(), poeira: new Map(), giz: null, apagador: APAGADOR.descanso, etapaDaFoto: 0,
    };
    quadroAnimado = quadro;
    trocarItemDoQuadro(quadro);
    if (POUCO_MOVIMENTO.matches) {
      for (const passo of quadro.passos) if (passo.risca || passo.etapaDaFoto === TEMPOS_DA_FOTO.etapas) aplicarPasso(quadro, passo);
      quadro.giz = null;
    } else requestAnimationFrame(avancarQuadro);
    pintarQuadro(quadro);
  }).catch(() => {
    quadroAnimado = null;
  });
}

function acenderMesas(animar) {
  for (const botao of document.querySelectorAll('#salao-mesas .mesa')) {
    const acesa = botao.dataset.servidor === mesaEscolhida;
    if (animar && acesa && !botao.classList.contains('acesa')) botao.classList.add('acendendo');
    botao.classList.toggle('acesa', acesa);
    botao.setAttribute('aria-pressed', acesa);
  }
}

function mostrarServidores() {
  const comAcesso = SERVIDORES.filter(cada => cada.acesso);
  const pedir = !comAcesso.length;
  const lista = pedir ? SERVIDORES : comAcesso;
  if (!lista.some(cada => cada.id === mesaEscolhida)) mesaEscolhida = servidor?.id || '';
  montarSalao(lista);
  for (const botao of document.querySelectorAll('#salao-mesas .mesa')) {
    const cada = SERVIDORES.find(s => s.id === botao.dataset.servidor);
    const pendencias = pedir || cada === servidor ? 0 : pendenciasDe(cada);
    const selo = botao.querySelector('.mesa-selo');
    selo.hidden = !pendencias;
    selo.textContent = pendencias;
    botao.setAttribute('aria-label', pendencias ? `${cada.nome} (${pendencias} esperando)` : cada.nome);
  }
  acenderMesas(false);
  document.getElementById('botao-servidor').textContent = pedir ? 'Pedir entrada' : 'Entrar';
  document.getElementById('servidores-outra-conta').hidden = !pedir;
  const salao = document.getElementById('salao');
  const destino = document.querySelector(`[data-tela="${estado ? 'servidores' : 'entrada'}"]`);
  if (salao.parentElement !== destino) destino.append(salao);
  salao.hidden = false;
  validarServidor();
  animarQuadro();
}

function validarServidor() {
  document.getElementById('botao-servidor').disabled = !mesaEscolhida;
}

function ligarServidores() {
  const formulario = document.getElementById('form-servidor');
  const botao = document.getElementById('botao-servidor');
  const mesas = document.getElementById('salao-mesas');
  mesas.addEventListener('click', evento => {
    const mesa = evento.target.closest('.mesa');
    if (!mesa || mesa.dataset.servidor === mesaEscolhida) return;
    mesaEscolhida = mesa.dataset.servidor;
    acenderMesas(true);
    validarServidor();
  });
  mesas.addEventListener('animationend', evento => evento.target.closest('.mesa')?.classList.remove('acendendo'));
  formulario.addEventListener('submit', evento => {
    evento.preventDefault();
    const escolhido = SERVIDORES.find(cada => cada.id === mesaEscolhida);
    if (!escolhido) return;
    if (SERVIDORES.some(cada => cada.acesso)) trocarDeServidor(escolhido);
    else pedirEntrada(escolhido, botao);
  });
  document.getElementById('servidores-outra-conta').addEventListener('click', entrarComGoogle);
}

function mostrarEscolha() {
  mostrarEntrada('');
  mostrarServidores();
}

async function pedirEntrada(escolhido, botao) {
  const aviso = document.getElementById('aviso-servidores');
  botao.disabled = true;
  aviso.textContent = '';
  try {
    await setDoc(doc(escolhido.banco, 'pedidos', email), { nome: (PRINCIPAL.auth.currentUser?.displayName || '').slice(0, 60), criadoEm: serverTimestamp() });
    tocar('confirmar');
  } catch {
    tocar('erro');
    aviso.textContent = 'Não consegui registrar seu pedido de entrada.';
    botao.disabled = false;
  }
}

function esquecerMesaEscolhida() {
  mesaEscolhida = '';
}

export { mostrarServidores, ligarServidores, mostrarEscolha, esquecerMesaEscolhida };
