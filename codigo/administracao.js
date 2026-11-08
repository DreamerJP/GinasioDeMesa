import { EMAIL_VALIDO, MESES, indiceDoMes, formatoHora, formatoDataDoDia, mesSeguinte, podeFecharOMes, criar } from './base.js?v=102';
import { jogadoresSemEmail, enviar } from './acoes.js?v=102';
import { SERVIDORES, email, servidor, estado } from './app.js?v=102';

let servidorNosAcessos = '';
let acessoAberto = '';

function mostrarAdministracao() {
  const { mesAtual, premios } = estado;
  const premio = document.getElementById('campo-premio');
  premio.value = premios[mesAtual] || '';
  validarPremio();

  document.getElementById('caixa-fechar-mes').hidden = !podeFecharOMes();
  const temAberta = estado.partidas.some(p => p.mes === mesAtual && p.estado === 'aberta');
  const fecharMes = document.getElementById('fechar-mes');
  fecharMes.textContent = 'Fechar o mês agora';
  fecharMes.classList.remove('botao-perigo');
  fecharMes.disabled = temAberta;
  document.getElementById('rodape-fechar-mes').textContent = temAberta
    ? 'Feche ou cancele a partida aberta antes.'
    : `O campeão aparece para todos na hora e as partidas novas já contam para ${MESES[indiceDoMes(mesSeguinte(mesAtual))]}.`;

  const { dono } = estado.eu;
  const alvo = servidorDosAcessos();
  const vinculo = document.getElementById('campo-vinculo');
  const semEmail = jogadoresSemEmail(alvo);
  const escolhaDoVinculo = vinculo.value;
  vinculo.replaceChildren(new Option('Jogador novo', ''), ...semEmail.map(j => new Option(j.apelido, j.id)));
  vinculo.value = semEmail.some(j => j.id === escolhaDoVinculo) ? escolhaDoVinculo : '';
  vinculo.hidden = !semEmail.length;
  document.getElementById('rodape-liberar').hidden = !semEmail.length;
  document.querySelector('label[data-liberar]').htmlFor = semEmail.length ? 'campo-vinculo' : 'campo-email';

  const semEmailAqui = jogadoresSemEmail(dono ? servidor : null);
  const opcoesDeVinculo = () => [new Option('Jogador novo', ''), ...semEmailAqui.map(j => new Option(j.apelido, j.id))];
  const pedidos = estado.pedidos || [];
  document.getElementById('caixa-pedidos').hidden = !pedidos.length;
  document.getElementById('rodape-pedidos').hidden = !semEmailAqui.length;
  document.getElementById('lista-pedidos').replaceChildren(...pedidos.map(pedido => {
    const item = criar('li');
    const escolha = criar('select', 'campo campo-texto');
    const aprovar = criar('button', 'botao', 'Aprovar');
    const recusar = criar('button', 'botao-menu voltar', 'Recusar pedido');
    const aviso = criar('p', 'aviso');
    const linhaCampo = criar('div', 'linha-campo');
    escolha.setAttribute('aria-label', `De quem é a conta ${pedido.email}`);
    escolha.append(...opcoesDeVinculo());
    escolha.hidden = !semEmailAqui.length;
    aprovar.addEventListener('click', () => enviar(aprovar, aviso, 'aprovarPedido', { pedido: pedido.id, jogador: escolha.value || undefined }));
    recusar.addEventListener('click', () => enviar(recusar, aviso, 'recusarPedido', { pedido: pedido.id }));
    linhaCampo.append(escolha, aprovar);
    item.append(criar('span', '', pedido.nome || pedido.email), criar('span', 'detalhe email', pedido.email), linhaCampo, recusar, aviso);
    return item;
  }));

  document.getElementById('topo-acessos').hidden = !dono;
  document.getElementById('lista-acessos').hidden = !dono;
  if (!dono) return;
  const campoServidor = document.getElementById('servidor-dos-acessos');
  campoServidor.replaceChildren(...SERVIDORES.filter(cada => cada.doDono).map(cada => new Option(cada.nome, cada.id)));
  campoServidor.value = alvo.id;
  mostrarAcessosDoDono();
}

function servidorDosAcessos() {
  return SERVIDORES.find(cada => cada.id === servidorNosAcessos && cada.doDono) || servidor;
}

function mostrarAcessosDoDono() {
  const alvo = servidorDosAcessos();
  const { acessos, jogadores, ultimosAcessos } = alvo.doDono || { acessos: [], jogadores: [], ultimosAcessos: [] };
  const pessoas = acessos.map(acesso => ({
    acesso,
    apelido: jogadores.find(j => j.id === acesso.jogador)?.apelido || '',
    ultimo: ultimosAcessos.find(u => u.id === acesso.jogador)?.em?.toDate?.() || null,
  })).sort((a, b) => (b.ultimo || 0) - (a.ultimo || 0) || (a.apelido || a.acesso.id).localeCompare(b.apelido || b.acesso.id, 'pt-BR'));
  if (!pessoas.some(p => p.acesso.id === acessoAberto)) acessoAberto = '';
  document.getElementById('lista-acessos').replaceChildren(...pessoas.map(pessoa => linhaDeAcesso(alvo, pessoa)));
}

function linhaDeAcesso(alvo, { acesso, apelido, ultimo }) {
  const fixa = acesso.id === email || acesso.dono;
  const item = criar('li');
  const linha = criar(fixa ? 'div' : 'button', 'linha-acesso');
  const nome = criar('span', 'acesso-nome');
  nome.append(criar('span', apelido ? '' : 'detalhe', apelido || (acesso.jogador ? 'ainda não entrou' : 'sem jogador')));
  if (acesso.dono || acesso.admin) nome.append(criar('span', 'etiqueta-escura', acesso.dono ? 'Dono' : 'Admin'));
  linha.append(nome, criar('span', 'detalhe acesso-quando', apelido ? quandoFoiOAcesso(ultimo) : ''), criar('span', 'detalhe email', acesso.id));
  item.append(linha);
  if (fixa) return item;
  const aberta = acesso.id === acessoAberto;
  linha.type = 'button';
  linha.setAttribute('aria-expanded', aberta);
  linha.addEventListener('click', () => {
    acessoAberto = aberta ? '' : acesso.id;
    mostrarAcessosDoDono();
  });
  if (aberta) item.append(...acoesDoAcesso(alvo, acesso));
  return item;
}

function acoesDoAcesso(alvo, acesso) {
  const aviso = criar('p', 'aviso');
  const trocar = criar('button', 'botao botao-claro', acesso.admin ? 'Tornar jogador' : 'Tornar admin');
  trocar.type = 'button';
  trocar.addEventListener('click', () => enviar(trocar, aviso, 'mudarAcesso', { servidor: alvo.id, email: acesso.id, papel: acesso.admin ? 'jogador' : 'admin' }));
  const tirar = criar('button', 'botao botao-claro', 'Tirar deste servidor');
  tirar.type = 'button';
  let confirmando = null;
  tirar.addEventListener('click', async () => {
    if (!confirmando) {
      tirar.textContent = 'Toque de novo para tirar';
      tirar.classList.replace('botao-claro', 'botao-perigo');
      confirmando = setTimeout(() => {
        confirmando = null;
        tirar.textContent = 'Tirar deste servidor';
        tirar.classList.replace('botao-perigo', 'botao-claro');
      }, 4000);
      return;
    }
    clearTimeout(confirmando);
    confirmando = null;
    if (await enviar(tirar, aviso, 'mudarAcesso', { servidor: alvo.id, email: acesso.id, papel: '' })) acessoAberto = '';
  });
  const botoes = criar('div', 'linha-botoes acoes-do-acesso');
  botoes.append(trocar, tirar);
  return [botoes, aviso];
}

function quandoFoiOAcesso(momento) {
  if (!momento) return 'sem registro';
  const dias = Math.round((Date.parse(formatoDataDoDia.format(new Date())) - Date.parse(formatoDataDoDia.format(momento))) / 864e5);
  if (dias <= 0) return `hoje, ${formatoHora.format(momento)}`;
  if (dias === 1) return `ontem, ${formatoHora.format(momento)}`;
  return `há ${dias} dias`;
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
  const campoEmail = document.getElementById('campo-email');
  const avisoLiberar = document.getElementById('aviso-liberar');
  campoEmail.addEventListener('input', validarEmail);
  formLiberar.addEventListener('submit', async evento => {
    evento.preventDefault();
    const dados = { email: campoEmail.value.trim(), jogador: document.getElementById('campo-vinculo').value || undefined, servidor: servidorDosAcessos().id };
    if (await enviar(formLiberar.querySelector('button'), avisoLiberar, 'liberarEmail', dados)) campoEmail.value = '';
    validarEmail();
  });
  document.getElementById('servidor-dos-acessos').addEventListener('change', evento => {
    servidorNosAcessos = evento.target.value;
    acessoAberto = '';
    avisoLiberar.textContent = '';
    evento.target.blur();
    mostrarAdministracao();
  });

  const fecharMes = document.getElementById('fechar-mes');
  let confirmando = null;
  fecharMes.addEventListener('click', async () => {
    if (!confirmando) {
      fecharMes.textContent = 'Toque de novo para fechar';
      fecharMes.classList.add('botao-perigo');
      confirmando = setTimeout(() => {
        confirmando = null;
        mostrarAdministracao();
      }, 4000);
      return;
    }
    clearTimeout(confirmando);
    confirmando = null;
    await enviar(fecharMes, document.getElementById('aviso-fechar-mes'), 'fecharMes', {});
    mostrarAdministracao();
  });
}

function esquecerAdministracao() {
  servidorNosAcessos = '';
  acessoAberto = '';
}

export { mostrarAdministracao, ligarAdministracao, esquecerAdministracao };
