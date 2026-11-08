import { MESES, INSIGNIAS, formatoNota, jogador, indiceDoMes, nomeDoMes, criar, imagemDe, desenhoDaInsignia } from './base.js?v=103';
import { enviar } from './acoes.js?v=103';
import { rankingDe, mesesFechados, campeoesDe, colecaoDe, insigniaDaVitoria } from './ranking.js?v=103';
import { estado, irPara } from './app.js?v=103';

let mesDoCampeaoAberto = '';

function trilhaDeInsignias(ganhas, destacarProxima) {
  return INSIGNIAS.map((insignia, i) => {
    const linha = Math.floor(i / 4);
    const posicao = i % 4;
    let trilha = '';
    if (i < INSIGNIAS.length - 1 && posicao < 3) trilha = linha % 2 ? 'trilha-esquerda' : 'trilha-direita';
    if (i < INSIGNIAS.length - 1 && posicao === 3) trilha = linha % 2 ? 'trilha-volta-esquerda' : 'trilha-volta-direita';
    const tem = i < ganhas;
    const casa = criar('span', `casa-insignia ${trilha}${i + 1 < ganhas ? ' trilha-feita' : ''}`);
    casa.style.gridRow = linha + 1;
    casa.style.gridColumn = (linha % 2 ? 3 - posicao : posicao) + 1;
    const botao = criar('button', `botao-insignia${destacarProxima && i === ganhas ? ' proxima' : ''}`);
    botao.type = 'button';
    botao.setAttribute('aria-label', `${insignia.nome}${tem ? '' : ', ainda não tem'}`);
    botao.append(desenhoDaInsignia(i, tem));
    botao.addEventListener('click', () => irPara('insignia', i + 1));
    casa.append(botao);
    return casa;
  });
}

const COLUNAS_DO_MAPA = [11.6, 37.2, 62.8, 88.4];
const ALTURA_VISIVEL_DO_MAPA = 0.95;

function mostrarInsignias() {
  document.getElementById('mapa-insignias').replaceChildren(...INSIGNIAS.map((insignia, i) => {
    const linha = Math.floor(i / 4);
    const coluna = linha % 2 ? 3 - i % 4 : i % 4;
    const parada = criar('button', 'parada-insignia');
    parada.type = 'button';
    parada.style.left = `${COLUNAS_DO_MAPA[coluna]}%`;
    parada.style.top = `${(13 + 34 * linha) / ALTURA_VISIVEL_DO_MAPA}%`;
    parada.setAttribute('aria-label', insignia.nome);
    const pedestal = criar('img', 'parada-pedestal');
    pedestal.alt = '';
    pedestal.src = 'midia/insignias/pedestal.webp';
    parada.append(pedestal, desenhoDaInsignia(i, true), criar('span', 'parada-nome', insignia.nome.replace(/^Insígnia d[aeo]s? /, '')));
    parada.addEventListener('click', () => irPara('insignia', i + 1));
    return parada;
  }));
}

function mostrarInsignia(numero) {
  const indice = Number(numero) - 1;
  if (!(indice >= 0 && indice < INSIGNIAS.length)) {
    irPara('insignias');
    return;
  }
  const { trecho, nome, lore } = INSIGNIAS[indice];
  const donos = estado.jogadores
    .map(alguem => [alguem, colecaoDe(alguem.id)[indice]])
    .filter(([, ganha]) => ganha)
    .sort(([, a], [, b]) => a.mes.localeCompare(b.mes));

  document.getElementById('insignia-imagem').replaceChildren(desenhoDaInsignia(indice, true, true));
  document.getElementById('insignia-nome').textContent = nome;
  document.getElementById('insignia-trecho').textContent = `${indice + 1}º trecho · ${trecho}`;
  document.getElementById('insignia-texto').textContent = lore;
  document.getElementById('insignia-donos').replaceChildren(...(donos.length
    ? donos.map(([alguem, { mes }]) => {
      const item = criar('li');
      const nome = criar('span', 'dono-nome');
      nome.append(criar('span', '', alguem.apelido), criar('span', 'detalhe', nomeDoMes(mes)));
      item.append(imagemDe(alguem, 'foto'), nome);
      return item;
    })
    : [criar('li', 'detalhe', 'Ninguém chegou aqui ainda.')]));
}

function mostrarCampeoes() {
  const lista = document.getElementById('lista-campeoes');
  const meses = mesesFechados();
  if (!meses.length) {
    const proximo = MESES[(indiceDoMes(estado.mesAtual) + 1) % 12];
    const vazio = criar('section', 'papel');
    vazio.append(criar('p', '', `Nenhum mês fechou ainda. O primeiro campeão aparece em 1º de ${proximo}.`));
    lista.replaceChildren(vazio);
    return;
  }
  const [recente, ...anteriores] = meses;
  const partes = [cartaoDeCampeao(recente)];
  if (anteriores.length) {
    const caixa = criar('section', 'papel');
    const topo = criar('div', 'secao-topo');
    topo.append(criar('h3', '', 'Meses anteriores'));
    const linhas = criar('ul', 'lista-campeoes-antigos');
    for (const mes of anteriores) {
      const item = criar('li');
      if (mes === mesDoCampeaoAberto) {
        const cartao = cartaoDeCampeao(mes);
        cartao.classList.replace('papel', 'campeao-aberto');
        const recolher = criar('button', 'botao-menu', 'Recolher');
        recolher.type = 'button';
        const topo = cartao.querySelector('.secao-topo');
        topo.append(recolher);
        topo.addEventListener('click', () => abrirCampeao(''));
        item.append(cartao);
      } else {
        item.append(linhaDeCampeao(mes));
      }
      linhas.append(item);
    }
    caixa.append(topo, linhas);
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
  const insignia = insigniaDaVitoria(campeoes[0].id, mes);
  botao.append(insignia === null ? criar('span') : desenhoDaInsignia(insignia, true), rostos, nome);
  botao.addEventListener('click', () => abrirCampeao(mes));
  return botao;
}

function cartaoDeCampeao(mes) {
  const { linhas } = rankingDe(mes);
  const campeoes = linhas.filter(l => l.posicao === 1 && l.nota > 0);
  const euVenci = campeoes.some(l => l.id === estado.eu.id);
  const indice = insigniaDaVitoria(euVenci ? estado.eu.id : campeoes[0].id, mes);
  const dono = euVenci ? estado.eu.id : campeoes[0].id;
  const titulo = nomeDoMes(mes);
  const cartao = criar('section', 'papel campeao');
  const topo = criar('div', 'secao-topo');
  topo.append(criar('h3', '', titulo[0].toUpperCase() + titulo.slice(1)));
  cartao.append(topo);

  const pessoas = criar('div', 'campeao-pessoas');
  pessoas.append(...campeoes.map(linha => {
    const alguem = jogador(linha.id);
    const retrato = criar('div', 'campeao-retrato');
    retrato.append(imagemDe(alguem, 'campeao-foto'));
    if (linha.id === dono && indice !== null) {
      const selo = criar('span', 'campeao-selo');
      selo.append(desenhoDaInsignia(indice, true));
      retrato.append(selo);
    }
    const dados = criar('div');
    dados.append(criar('p', 'campeao-nome', alguem.apelido), criar('p', 'campeao-nota', `Nota do mês ${formatoNota.format(linha.nota)}`));
    const pessoa = criar('div', 'campeao-pessoa');
    pessoa.append(retrato, dados);
    return pessoa;
  }));
  cartao.append(pessoas);

  for (const linha of campeoes) {
    const frase = estado.frases.find(f => f.mes === mes && f.jogador === linha.id);
    if (!frase) continue;
    const balao = criar('div', 'balao');
    if (campeoes.length > 1) balao.append(criar('span', 'campeao-nota', jogador(linha.id).apelido));
    balao.append(criar('p', 'frase', frase.texto));
    cartao.append(balao);
  }

  const entrega = criar('dl', 'campeao-entrega');
  const item = (rotulo, valor) => {
    const linha = criar('div');
    linha.append(criar('dt', '', rotulo), criar('dd', '', valor));
    return linha;
  };
  entrega.append(item('Prêmio', estado.premios[mes] || 'Não registrado'));
  if (campeoes.length > 1) entrega.append(item('Insígnia', 'Cada um levou a sua próxima'));
  else if (indice !== null) entrega.append(item('Insígnia', INSIGNIAS[indice].nome.replace(/^Insígnia d[aeo]s? /, '')));
  cartao.append(entrega);

  const seguintes = linhas.filter(l => l.nota > 0 && l.posicao > 1 && l.posicao <= 3);
  if (seguintes.length) {
    const podio = criar('div', 'campeao-seguintes');
    podio.append(...seguintes.map(linha => {
      const alguem = jogador(linha.id);
      const dados = criar('span', 'campeao-seguinte-dados');
      dados.append(criar('span', '', alguem.apelido), criar('span', 'campeao-nota', `nota ${formatoNota.format(linha.nota)}`));
      const vaga = criar('div', 'campeao-seguinte');
      vaga.append(criar('span', 'campeao-posicao', `${linha.posicao}º`), imagemDe(alguem, 'foto'), dados);
      return vaga;
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

function esquecerCampeoes() {
  mesDoCampeaoAberto = '';
}

export { trilhaDeInsignias, mostrarInsignias, mostrarInsignia, mostrarCampeoes, esquecerCampeoes };
