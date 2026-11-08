import {
  MAXIMO_DE_ROSTOS, formatoNota, formatoPlacar, tocar, jogoDe, jogador, formatoHora, diaDaMesa, quandoFoiAberta, criar, imagemDaCapa, mostrarCapa, imagemDe,
} from './base.js?v=103';
import { novoId, linkDeFoto, enviar } from './acoes.js?v=103';
import { FRACAO_DA_FALTA, notasDaPartida, partidaParaFormula, lugaresDaPartida, presentesEmCadaDia, rankingDe } from './ranking.js?v=103';
import { duelosDoGinasio, nomesDoDuelo, mostrarLinhaDoDuelo } from './duelos.js?v=103';
import { fotoReduzida } from './perfil.js?v=103';
import { estado, aplicarEstadoEmEspera, irPara } from './app.js?v=103';

let partidaAberta = '';
let correcao = null;
let jogoEscolhido = '';
let selecao = null;

function itemDaPartida(partida) {
  const jogo = jogoDe(partida);
  const aberta = partida.estado === 'aberta';
  const botao = criar('button', `item-partida${aberta ? ' aberta' : ''}`);
  botao.type = 'button';
  const topo = criar('span', 'item-topo');
  topo.append(criar('span', '', jogo.nome), criar('span', 'detalhe', partida.abertaPor ? formatoHora.format(partida.abertaEm) : ''));
  const lugares = aberta ? null : lugaresDaPartida(partida);
  const ordem = aberta ? partida.placares : [...partida.placares].sort((a, b) => lugares.get(a.jogador) - lugares.get(b.jogador));
  const rostos = criar('span', 'item-jogadores');
  rostos.append(...ordem.slice(0, MAXIMO_DE_ROSTOS).map(s => {
    const foto = imagemDe(jogador(s.jogador), 'foto');
    if (!aberta && lugares.get(s.jogador) === 1) foto.classList.add('vencedor');
    return foto;
  }));
  if (ordem.length > MAXIMO_DE_ROSTOS) rostos.append(criar('span', 'mais', '…'));
  const corpo = criar('span', 'item-corpo');
  corpo.append(topo, criar('span', 'detalhe', resumoDaPartida(partida)), rostos);
  botao.append(imagemDaCapa(jogo), corpo);
  botao.addEventListener('click', () => irPara('partida', partida.id));
  const item = criar('li');
  item.append(botao);
  return item;
}

function resumoDaPartida(partida) {
  if (partida.estado === 'aberta' && partida.mes < estado.mesAtual) return 'Não contou: faltou placar';
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

  document.getElementById('partida-capa').replaceChildren(imagemDaCapa(jogo));
  document.getElementById('partida-jogo').textContent = jogo.nome;
  const data = document.getElementById('partida-data');
  data.textContent = quandoFoiAberta(partida);
  data.hidden = !data.textContent;
  let situacao = `Fechada, ranking ${partida.mes.slice(5)}/${partida.mes.slice(0, 4)}`;
  if (aberta && valeNoMes) situacao = `Aberta${autor ? ` por ${autor}` : ''}.`;
  if (aberta && !valeNoMes) situacao = 'Não conta: o mês fechou antes de todos lançarem.';
  document.getElementById('partida-situacao').textContent = situacao;
  const progresso = document.getElementById('partida-progresso');
  progresso.hidden = !(aberta && valeNoMes);
  progresso.textContent = `${lancados} de ${partida.placares.length} lançaram.`;
  mostrarLinhaDoDuelo(document.getElementById('partida-duelo'), partida);

  const faltaDeOutro = partida.placares.some(s => s.valor === null && s.jogador !== eu.id);
  const modoDoAdmin = !eu.admin ? '' : aberta ? (valeNoMes && faltaDeOutro ? 'incluir' : '') : 'corrigir';
  if (correcao && (correcao.partida !== id || correcao.modo !== modoDoAdmin)) correcao = null;
  const notas = aberta ? new Map() : new Map(notasDaPartida(partidaParaFormula(partida)));
  const lugares = aberta ? new Map() : lugaresDaPartida(partida);
  const placares = aberta ? partida.placares : [...partida.placares].sort((a, b) => lugares.get(a.jogador) - lugares.get(b.jogador));
  document.getElementById('partida-jogadores').classList.toggle('aberta', aberta);
  document.getElementById('partida-jogadores').replaceChildren(...placares.map(s => {
    const alguem = jogador(s.jogador);
    const falta = aberta && s.valor === null;
    const linha = criar('li', `jogador-linha${!aberta && lugares.get(s.jogador) === 1 ? ' vencedor' : ''}${falta ? ' pendente' : ''}`);
    const valor = criar('span', 'valor');
    if (correcao && (!aberta || (falta && s.jogador !== eu.id))) {
      const campo = criar('input', 'campo campo-texto campo-correcao');
      campo.inputMode = 'decimal';
      campo.autocomplete = 'off';
      campo.setAttribute('aria-label', `${jogo.semPlacar ? 'Colocação' : 'Placar'} de ${alguem?.apelido || '?'}`);
      campo.value = correcao.rascunho.get(s.jogador) ?? (falta ? '' : String(s.valor).replace('.', ','));
      campo.addEventListener('input', () => {
        correcao.rascunho.set(s.jogador, campo.value);
        validarCorrecao();
      });
      valor.append(campo);
    } else if (falta) {
      valor.append(criar('span', 'detalhe', 'aguardando'));
    } else if (aberta) {
      const lancou = criar('span', 'lancou');
      lancou.setAttribute('aria-label', 'lançou');
      if (s.jogador === eu.id) lancou.append(criar('span', '', formatoPlacar.format(s.valor)));
      lancou.append(criar('span', 'visto'));
      valor.append(lancou);
    } else {
      if (!jogo.semPlacar) valor.append(criar('span', '', formatoPlacar.format(s.valor)));
      valor.append(criar('span', 'detalhe', `nota ${formatoNota.format(notas.get(s.jogador))}`));
    }
    linha.append(criar('span', 'posicao', aberta ? '' : `${lugares.get(s.jogador)}º`), imagemDe(alguem, 'foto'), criar('span', '', alguem?.apelido || '?'), valor);
    return linha;
  }));

  // Só conta como falta para quem jogou alguma partida no mês; quem não jogou nenhuma fica com nota 0 de qualquer jeito.
  const presentes = aberta ? new Set() : presentesEmCadaDia().get(diaDaMesa(partida.abertaEm));
  const ausentes = aberta ? [] : rankingDe(partida.mes).linhas.filter(l => l.partidas > 0 && !presentes.has(l.id));
  const notaDaFalta = aberta ? 0 : Math.min(...notas.values()) * FRACAO_DA_FALTA;
  document.getElementById('partida-faltas').hidden = !ausentes.length;
  document.getElementById('partida-ausentes').replaceChildren(...ausentes.map(l => {
    const alguem = jogador(l.id);
    const linha = criar('li', 'jogador-linha pendente');
    const valor = criar('span', 'valor');
    valor.append(criar('span', 'detalhe', `nota ${formatoNota.format(notaDaFalta)}`));
    linha.append(criar('span', 'posicao'), imagemDe(alguem, 'foto'), criar('span', '', alguem?.apelido || '?'), valor);
    return linha;
  }));

  const regras = [];
  if (jogo.semPlacar) regras.push('Jogo sem placar: vale a ordem de chegada.');
  const comCampo = Boolean(aberta && valeNoMes && meu);
  if (jogo.menorVence && !comCampo) regras.push('Neste jogo, menor placar vence.');
  document.getElementById('partida-rodape').textContent = regras.join(' ');
  document.getElementById('partida-rodape').hidden = !regras.length;
  document.getElementById('correcao-placar').hidden = !modoDoAdmin;
  document.getElementById('corrigir-placares').hidden = Boolean(correcao);
  document.getElementById('corrigir-placares').textContent = modoDoAdmin === 'incluir' ? 'Incluir placares' : jogo.semPlacar ? 'Corrigir colocações' : 'Corrigir placares';
  document.getElementById('botoes-correcao').hidden = !correcao;
  if (correcao) validarCorrecao();

  const formulario = document.getElementById('form-placar');
  formulario.hidden = !comCampo;
  if (!formulario.hidden) {
    const campo = document.getElementById('campo-placar');
    const falta = meu.valor === null;
    if (!mesmaPartida || !campo.value) campo.value = falta ? '' : String(meu.valor).replace('.', ',');
    formulario.querySelector('button').textContent = falta ? 'Confirmar' : 'Corrigir';
    formulario.classList.toggle('urgente', falta);
    const jogadores = document.getElementById('caixa-jogadores');
    if (falta) jogadores.before(formulario);
    else jogadores.after(formulario);
    const dica = document.getElementById('dica-placar');
    dica.hidden = !jogo.menorVence;
    dica.textContent = 'Neste jogo, menor placar vence.';
    validarPlacar();
  }

  const podeCancelar = aberta && (partida.abertaPor === eu.id || eu.admin);
  document.getElementById('caixa-cancelar').hidden = !podeCancelar;
  document.getElementById('cancelar-partida').textContent = 'Cancelar partida';
  document.getElementById('cancelar-partida').classList.remove('confirmando');
}

function numeroDoPlacar(digitado) {
  const texto = digitado.trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const numero = Number(texto);
  return texto !== '' && Number.isFinite(numero) && numero >= 0 ? numero : null;
}

function valorDoPlacar() {
  return numeroDoPlacar(document.getElementById('campo-placar').value);
}

function mudancasDaCorrecao() {
  const partida = estado.partidas.find(p => p.id === correcao.partida);
  const mudancas = {};
  for (const { jogador: id, valor } of partida.placares) {
    const digitado = correcao.rascunho.get(id);
    if (digitado === undefined) continue;
    if (correcao.modo === 'incluir' && (valor !== null || !digitado.trim())) continue;
    const numero = numeroDoPlacar(digitado);
    if (numero === null) return null;
    if (numero !== valor) mudancas[id] = numero;
  }
  if (jogoDe(partida).semPlacar && !ordemDeChegadaValida(partida, mudancas)) return null;
  return mudancas;
}

function ordemDeChegadaValida(partida, mudancas) {
  const lugares = partida.placares.map(s => mudancas[s.jogador] ?? s.valor).sort((a, b) => a - b);
  return lugares.every((lugar, i) => lugar === i + 1);
}

function validarCorrecao() {
  const mudancas = mudancasDaCorrecao();
  document.getElementById('salvar-correcao').disabled = !mudancas || !Object.keys(mudancas).length;
  const partida = estado.partidas.find(p => p.id === correcao.partida);
  if (jogoDe(partida).semPlacar) {
    document.getElementById('aviso-correcao').textContent = mudancas ? '' : `Use cada colocação de 1 a ${partida.placares.length} uma vez.`;
  }
}

function validarPlacar() {
  document.querySelector('#form-placar button').disabled = valorDoPlacar() === null;
}

function ligarPartida() {
  const formulario = document.getElementById('form-placar');
  const somDoSucesso = () => (estado.partidas.find(p => p.id === partidaAberta)?.estado === 'fechada' ? 'partidaFechada' : 'confirmar');
  document.getElementById('campo-placar').addEventListener('input', validarPlacar);
  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    const valor = valorDoPlacar();
    if (valor === null) return;
    await enviar(formulario.querySelector('button'), document.getElementById('aviso-placar'), 'lancarPlacar', { partida: partidaAberta, valor }, somDoSucesso);
    if (!formulario.hidden) validarPlacar();
  });

  const avisoDaCorrecao = document.getElementById('aviso-correcao');
  document.getElementById('corrigir-placares').addEventListener('click', () => {
    const aberta = estado.partidas.find(p => p.id === partidaAberta)?.estado === 'aberta';
    correcao = { partida: partidaAberta, modo: aberta ? 'incluir' : 'corrigir', rascunho: new Map() };
    avisoDaCorrecao.textContent = '';
    mostrarPartida(partidaAberta);
    document.querySelector('.campo-correcao')?.focus();
  });
  document.getElementById('cancelar-correcao').addEventListener('click', () => {
    correcao = null;
    avisoDaCorrecao.textContent = '';
    mostrarPartida(partidaAberta);
  });
  document.getElementById('salvar-correcao').addEventListener('click', async evento => {
    aplicarEstadoEmEspera();
    if (!correcao) return;
    const mudancas = mudancasDaCorrecao();
    if (!mudancas || !Object.keys(mudancas).length) return;
    const incluindo = correcao.modo === 'incluir';
    if (await enviar(evento.currentTarget, avisoDaCorrecao, incluindo ? 'incluirPlacares' : 'corrigirPlacares', { partida: correcao.partida, mudancas }, incluindo ? somDoSucesso : undefined)) {
      correcao = null;
      mostrarPartida(partidaAberta);
    }
  });

  const cancelar = document.getElementById('cancelar-partida');
  let confirmando = null;
  cancelar.addEventListener('click', async () => {
    if (!confirmando) {
      cancelar.textContent = 'Toque de novo para apagar';
      cancelar.classList.add('confirmando');
      confirmando = setTimeout(() => {
        confirmando = null;
        cancelar.textContent = 'Cancelar partida';
        cancelar.classList.remove('confirmando');
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

function motivoParaNaoAbrir() {
  if (!jogoEscolhido && selecao.length < 3) return 'Escolha um jogo e selecione pelo menos 3 participantes.';
  if (!jogoEscolhido) return 'Escolha um jogo para abrir a partida.';
  if (selecao.length < 3) return 'Selecione pelo menos 3 participantes.';
  return '';
}

function mostrarNovaPartida() {
  const jogo = jogoSelecionado();
  if (!jogo) jogoEscolhido = '';
  if (!selecao) selecao = [estado.eu.id];
  selecao = selecao.filter(id => jogador(id));
  const miniatura = document.getElementById('miniatura-jogo');
  if (jogo) mostrarCapa(miniatura, jogo);
  else miniatura.src = 'midia/avatares/caixa-azul.png';
  document.getElementById('nome-jogo-selecionado').textContent = jogo?.nome || 'Escolha o jogo';
  document.getElementById('escolher-jogo').disabled = !estado.jogos.length;
  document.getElementById('trocar-foto-jogo').hidden = !jogo;
  document.getElementById('resumo-jogo').textContent = jogo?.nome || 'Escolha um jogo';
  document.getElementById('instrucao-jogadores').hidden = !jogo?.semPlacar;
  document.getElementById('rodape-partida').textContent = jogo?.semPlacar
    ? 'Sem placar: a ordem dos jogadores já fecha a partida.'
    : 'Cada jogador lança o próprio placar depois.';
  document.getElementById('aviso-abrir-partida').hidden = true;
  const jogadores = [...estado.jogadores].sort((a, b) => a.apelido.localeCompare(b.apelido, 'pt-BR'));
  document.getElementById('escolha-jogadores').replaceChildren(...jogadores.map(fichaDoJogador));
  marcarParticipantes();
}

function fichaDoJogador(alguem) {
  const ficha = criar('button', 'ficha-jogador');
  ficha.type = 'button';
  ficha.dataset.jogador = alguem.id;
  const giro = criar('span', 'retrato-giro');
  giro.append(imagemDe(alguem, 'foto-jogador face-cinza'), imagemDe(alguem, 'foto-jogador face-colorida'));
  const retrato = criar('span', 'retrato-jogador');
  retrato.append(giro);
  const identidade = criar('span', 'identidade-jogador');
  identidade.append(criar('span', 'nome-jogador', alguem.apelido), criar('span', 'ordem-jogador'));
  ficha.append(retrato, identidade);
  ficha.addEventListener('click', () => {
    const aviso = document.getElementById('aviso-partida');
    const posicao = selecao.indexOf(alguem.id);
    if (posicao < 0 && selecao.length === 10) {
      aviso.textContent = 'A mesa pode ter até 10 jogadores.';
      tocar('erro');
      return;
    }
    if (posicao >= 0) selecao.splice(posicao, 1);
    else selecao.push(alguem.id);
    aviso.textContent = '';
    marcarParticipantes();
    tocar('escolher');
  });
  return ficha;
}

function marcarParticipantes() {
  const ordenada = jogoSelecionado()?.semPlacar;
  for (const ficha of document.getElementById('escolha-jogadores').children) {
    const posicao = selecao.indexOf(ficha.dataset.jogador);
    ficha.setAttribute('aria-pressed', posicao >= 0);
    ficha.querySelector('.ordem-jogador').textContent = ordenada && posicao >= 0 ? `${posicao + 1}º` : '';
  }
  document.getElementById('resumo-quantidade').textContent = `${selecao.length} ${selecao.length === 1 ? 'jogador' : 'jogadores'}`;
  const decide = duelosDoGinasio().filter(d => d.fase === 'valendo' && d.jogo === jogoEscolhido && selecao.includes(d.desafiante) && selecao.includes(d.desafiado));
  const linhaDoDuelo = document.getElementById('duelo-da-partida');
  linhaDoDuelo.hidden = !decide.length;
  linhaDoDuelo.textContent = `Esta partida decide ${decide.length > 1 ? 'os duelos' : 'o duelo'} ${decide.map(nomesDoDuelo).join(' e ')}.`;
  document.getElementById('abrir-partida').setAttribute('aria-disabled', Boolean(motivoParaNaoAbrir()));
}

function textoDeBusca(texto) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

function mostrarCatalogo() {
  const busca = textoDeBusca(document.getElementById('buscar-jogo').value);
  const jogos = [...estado.jogos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).filter(j => textoDeBusca(j.nome).includes(busca));
  document.getElementById('lista-catalogo').replaceChildren(...jogos.map(jogo => {
    const opcao = criar('button', 'opcao-jogo');
    opcao.type = 'button';
    opcao.setAttribute('aria-pressed', jogo.id === jogoEscolhido);
    opcao.append(imagemDaCapa(jogo, ''), criar('span', '', jogo.nome));
    opcao.addEventListener('click', () => {
      jogoEscolhido = jogo.id;
      document.getElementById('catalogo-jogos').close();
      document.getElementById('aviso-capa').textContent = '';
      mostrarNovaPartida();
      tocar('escolher');
    });
    const item = criar('li');
    item.append(opcao);
    return item;
  }));
  document.getElementById('catalogo-vazio').hidden = jogos.length > 0;
}

function ligarNovaPartida() {
  const catalogo = document.getElementById('catalogo-jogos');
  const busca = document.getElementById('buscar-jogo');
  document.getElementById('escolher-jogo').addEventListener('click', () => {
    busca.value = '';
    mostrarCatalogo();
    catalogo.showModal();
    document.getElementById('lista-catalogo').scrollTop = 0;
  });
  busca.addEventListener('input', mostrarCatalogo);
  document.getElementById('fechar-catalogo').addEventListener('click', () => catalogo.close());
  catalogo.addEventListener('click', evento => {
    if (evento.target === catalogo) catalogo.close();
  });

  const trocar = document.getElementById('trocar-foto-jogo');
  const arquivoTroca = document.getElementById('foto-jogo-atual');
  trocar.addEventListener('click', () => arquivoTroca.click());
  arquivoTroca.addEventListener('change', async () => {
    const [escolhido] = arquivoTroca.files;
    const jogo = jogoEscolhido;
    const aviso = document.getElementById('aviso-capa');
    arquivoTroca.value = '';
    if (!escolhido || !jogo) return;
    aviso.textContent = '';
    try {
      await enviar(trocar, aviso, 'definirCapa', { jogo, capa: await fotoReduzida(escolhido, { inteira: true }) });
    } catch (erro) {
      aviso.textContent = erro.message;
    }
  });

  const formJogo = document.getElementById('form-jogo');
  const alternar = document.getElementById('alternar-jogo-novo');
  const nome = document.getElementById('campo-nome-jogo');
  const menorVence = document.getElementById('jogo-menor-vence');
  const semPlacar = document.getElementById('jogo-sem-placar');
  const salvarJogo = document.getElementById('salvar-jogo');
  const avisoJogo = document.getElementById('aviso-jogo');
  const previa = document.getElementById('capa-nova');
  const arquivoNovo = document.getElementById('capa-nova-arquivo');
  const linkNovo = document.getElementById('capa-nova-link');
  let capaNova = '';
  const mostrarPrevia = () => {
    previa.hidden = !capaNova;
    if (capaNova) mostrarCapa(previa, { nome: nome.value.trim(), capa: capaNova });
  };
  const fecharCadastro = () => {
    formJogo.reset();
    formJogo.hidden = true;
    alternar.setAttribute('aria-expanded', false);
    capaNova = '';
    avisoJogo.textContent = '';
    menorVence.disabled = false;
    salvarJogo.disabled = true;
    mostrarPrevia();
  };

  alternar.addEventListener('click', () => {
    if (!formJogo.hidden) {
      fecharCadastro();
      return;
    }
    formJogo.hidden = false;
    alternar.setAttribute('aria-expanded', true);
    nome.focus();
  });
  document.getElementById('cancelar-jogo').addEventListener('click', fecharCadastro);
  nome.addEventListener('input', () => {
    salvarJogo.disabled = nome.value.trim().length < 2;
  });
  semPlacar.addEventListener('change', () => {
    menorVence.disabled = semPlacar.checked;
    if (semPlacar.checked) menorVence.checked = false;
  });
  document.getElementById('escolher-foto-jogo').addEventListener('click', () => arquivoNovo.click());
  arquivoNovo.addEventListener('change', async () => {
    const [escolhido] = arquivoNovo.files;
    arquivoNovo.value = '';
    if (!escolhido) return;
    avisoJogo.textContent = '';
    try {
      capaNova = await fotoReduzida(escolhido, { inteira: true });
      linkNovo.value = '';
      mostrarPrevia();
    } catch (erro) {
      avisoJogo.textContent = erro.message;
    }
  });
  linkNovo.addEventListener('input', () => {
    const link = linkNovo.value.trim();
    capaNova = linkDeFoto(link) ? link : '';
    mostrarPrevia();
  });
  formJogo.addEventListener('submit', async evento => {
    evento.preventDefault();
    if (linkNovo.value.trim() && !capaNova) {
      avisoJogo.textContent = 'Use um link começando com https://.';
      return;
    }
    const id = novoId('jogos');
    const dados = { id, nome: nome.value, menorVence: menorVence.checked, semPlacar: semPlacar.checked, capa: capaNova };
    if (!await enviar(salvarJogo, avisoJogo, 'cadastrarJogo', dados)) return;
    jogoEscolhido = id;
    fecharCadastro();
    mostrarNovaPartida();
  });

  const abrir = document.getElementById('abrir-partida');
  const avisoAbrir = document.getElementById('aviso-abrir-partida');
  document.getElementById('form-partida').addEventListener('submit', async evento => {
    evento.preventDefault();
    const motivo = motivoParaNaoAbrir();
    if (motivo) {
      avisoAbrir.textContent = motivo;
      avisoAbrir.hidden = false;
      tocar('erro');
      return;
    }
    const jogo = jogoSelecionado();
    const id = novoId('partidas');
    if (!await enviar(abrir, document.getElementById('aviso-partida'), 'abrirPartida', { id, jogo: jogo.id, participantes: selecao }, jogo.semPlacar ? 'partidaFechada' : 'confirmar')) return;
    selecao = null;
    jogoEscolhido = '';
    irPara('partida', id);
  });
  document.addEventListener('pointerdown', evento => {
    if (evento.target !== abrir) avisoAbrir.hidden = true;
  });
}

function esquecerPartidas() {
  partidaAberta = '';
  correcao = null;
  jogoEscolhido = '';
  selecao = null;
}

export { itemDaPartida, mostrarPartida, ordemDeChegadaValida, ligarPartida, mostrarNovaPartida, ligarNovaPartida, esquecerPartidas };
