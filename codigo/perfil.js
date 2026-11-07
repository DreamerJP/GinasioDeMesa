import { LIMITE_FOTO, MESES, INSIGNIAS, tocar, jogador, indiceDoMes, criar, imagemDaCapa, mostrarFoto } from './base.js?v=101';
import { limparApelido, ACOES, mensagemDeErro, enviar } from './acoes.js?v=101';
import { rankingDe, colecaoDe } from './ranking.js?v=101';
import {
  METAS_DE_MESTRE, TITULOS, titulosDoGinasio, situacaoNoTitulo, situacaoDe, titulosGanhos, tituloExibido, quantidade, faixaDoTitulo, linhaDoTitulo, cartaoDoTitulo,
} from './titulos.js?v=101';
import { desafio, motivoParaNaoDesafiar, placarDeDuelos, textoDoPlacar } from './duelos.js?v=101';
import { trilhaDeInsignias } from './campeoes.js?v=101';
import { estado, telaVisivel, aplicarEstadoEmEspera, irPara } from './app.js?v=101';

const QUADRO_DO_PERFIL = [104, 144];
const LADO_FOTO = 320;
const MAXIMO_DE_MESTRES_NO_PERFIL = 3;
const TITULOS_A_VISTA_NO_PERFIL = 3;
let faixaAbertaNoPerfil = '';

function mostrarPerfil(id) {
  const alguem = jogador(id || estado.eu.id);
  if (!alguem) {
    irPara('inicio');
    return;
  }
  const { mesAtual, eu } = estado;
  const indice = indiceDoMes(mesAtual);
  mostrarFoto(document.getElementById('perfil-foto'), alguem);
  document.getElementById('perfil-apelido').textContent = alguem.apelido;

  const { linhas, total } = rankingDe(mesAtual);
  const linha = linhas.find(l => l.id === alguem.id);
  const nomeMes = MESES[indice][0].toUpperCase() + MESES[indice].slice(1);
  document.getElementById('perfil-mes').textContent = total
    ? `${nomeMes}: ${linha.posicao}º lugar, ${linha.partidas} de ${total} ${total === 1 ? 'partida' : 'partidas'}`
    : `Nenhuma partida em ${MESES[indice]} ainda.`;

  const ganhas = colecaoDe(alguem.id).length;
  document.getElementById('perfil-insignias-conta').textContent = `${ganhas} de ${INSIGNIAS.length}`;
  document.getElementById('perfil-insignias').replaceChildren(...trilhaDeInsignias(ganhas, alguem.id === eu.id));

  const proprio = alguem.id === eu.id;
  document.getElementById('perfil-duelos-placar').textContent = textoDoPlacar(placarDeDuelos(alguem.id));
  const entreNos = placarDeDuelos(eu.id, alguem.id);
  const contra = document.getElementById('perfil-duelos-contra');
  contra.hidden = proprio || !textoDoPlacar(entreNos);
  const empates = entreNos.empates ? `, ${quantidade(entreNos.empates, ['empate', 'empates'])}` : '';
  contra.textContent = `Entre vocês: você ${entreNos.vitorias} x ${entreNos.derrotas} ${alguem.apelido}${empates}`;
  const desafiar = document.getElementById('perfil-desafiar');
  const motivo = proprio || eu.observador ? '' : motivoParaNaoDesafiar(alguem.id);
  desafiar.hidden = eu.observador;
  desafiar.textContent = proprio ? 'Desafiar alguém' : `Desafiar ${alguem.apelido}`;
  desafiar.disabled = Boolean(motivo);
  desafiar.onclick = () => {
    if (!proprio) desafio.jogador = alguem.id;
    irPara('duelos', 'desafiar');
  };
  document.getElementById('perfil-desafiar-motivo').hidden = !motivo;
  document.getElementById('perfil-desafiar-motivo').textContent = motivo;
  const exibido = tituloExibido(alguem);
  document.getElementById('perfil-titulo').replaceChildren(...(exibido ? [faixaDoTitulo(exibido)] : []));
  const comMoldura = Boolean(exibido) && alguem.moldura;
  const moldura = document.getElementById('perfil-moldura');
  document.getElementById('perfil-quadro').classList.toggle('com-moldura', comMoldura);
  moldura.hidden = !comMoldura;
  if (comMoldura) moldura.src = `midia/titulos/moldura-${exibido.nivel}.png`;
  document.fonts.ready.then(encaixarTopoDoPerfil);
  mostrarTitulosDoPerfil(alguem, exibido);
  document.getElementById('trocar-foto').hidden = !proprio;
  if (!proprio) document.getElementById('menu-foto').hidden = true;
  if (proprio) {
    document.getElementById('campo-novo-apelido').placeholder = alguem.apelido;
    mostrarEscolhaDeTitulo();
  }
}

function encaixarTopoDoPerfil() {
  const caixa = document.querySelector('.perfil');
  const faixa = caixa.querySelector('#perfil-titulo .faixa');
  caixa.style.removeProperty('--quadro');
  if (!faixa || !caixa.offsetWidth) return;
  faixa.style.removeProperty('--e');
  faixa.style.maxWidth = 'none';
  const largura = faixa.getBoundingClientRect().width;
  faixa.style.removeProperty('max-width');
  const estilo = getComputedStyle(caixa);
  const livre = caixa.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight) - parseFloat(estilo.columnGap);
  const quadro = Math.min(QUADRO_DO_PERFIL[1], livre - largura);
  caixa.style.setProperty('--quadro', `${Math.max(QUADRO_DO_PERFIL[0], Math.floor(quadro))}px`);
  if (quadro < QUADRO_DO_PERFIL[0]) faixa.style.setProperty('--e', Math.floor((livre - QUADRO_DO_PERFIL[0]) / largura * 100) / 100);
}

function cartaoDosMestres(comVitoria) {
  const [meta] = METAS_DE_MESTRE;
  const qualquerMestre = situacaoNoTitulo({
    nome: 'Mestre de um jogo', jogo: comVitoria[0].titulo.jogo, metas: METAS_DE_MESTRE, medida: 'Vitórias num mesmo jogo.', unidade: ['vitória', 'vitórias'],
  }, { atual: comVitoria[0].atual, niveis: [] });
  const cartao = cartaoDoTitulo(qualquerMestre, { aoTocar: () => irPara('titulos', 'mestres') });
  const jogos = criar('span', 'mestres-perto');
  jogos.append(...comVitoria.slice(0, MAXIMO_DE_MESTRES_NO_PERFIL).map(s => {
    const linha = criar('span', 'mestre-perto');
    linha.append(imagemDaCapa(s.titulo.jogo, 'capa-titulo'), criar('span', 'mestre-perto-nome', s.titulo.jogo.nome), criar('span', 'detalhe', `${s.atual} de ${meta}`));
    return linha;
  }));
  const restantes = comVitoria.length - MAXIMO_DE_MESTRES_NO_PERFIL;
  if (restantes > 0) jogos.append(criar('span', 'detalhe', `e mais ${quantidade(restantes, ['jogo', 'jogos'])}`));
  cartao.querySelector('.progresso').replaceWith(jogos);
  return cartao;
}

function mostrarTitulosDoPerfil(alguem, exibido) {
  const { catalogo } = titulosDoGinasio();
  const ganhos = titulosGanhos(alguem.id);
  const parte = s => s.atual / s.proxima;
  const andamento = TITULOS.map(t => situacaoDe(alguem.id, t.id)).filter(s => !s.alcancados && s.atual > 0)
    .map(s => ({ parte: parte(s), cartao: cartaoDoTitulo(s) }));
  const mestresComVitoria = catalogo.filter(t => t.jogo).map(t => situacaoDe(alguem.id, t.id)).filter(s => !s.alcancados && s.atual > 0)
    .sort((a, b) => b.atual - a.atual || a.titulo.jogo.nome.localeCompare(b.titulo.jogo.nome));
  if (mestresComVitoria.length) andamento.push({ parte: parte(mestresComVitoria[0]), cartao: cartaoDosMestres(mestresComVitoria) });
  andamento.sort((a, b) => b.parte - a.parte);

  document.getElementById('perfil-titulos-conta').textContent = quantidade(ganhos.length, ['título', 'títulos']);
  const cartoes = ganhos.map(s => cartaoDoTitulo(s, { emUso: exibido?.titulo.id === s.titulo.id }));
  const recolhidos = ganhos.length > TITULOS_A_VISTA_NO_PERFIL + 1 ? cartoes.slice(TITULOS_A_VISTA_NO_PERFIL) : [];
  document.getElementById('perfil-titulos').replaceChildren(...(ganhos.length ? cartoes : [criar('p', 'detalhe', 'Nenhum título ainda.')]));

  const emAndamento = criar('div', 'colecao-titulos');
  emAndamento.append(...andamento.map(a => a.cartao));
  const vizinhas = [];
  const faixaDosGanhos = faixaQueRecolhe([`Mais ${quantidade(recolhidos.length, ['título', 'títulos'])}`, 'Mostrar menos'], '', recolhidos, `ganhos:${alguem.id}`, vizinhas);
  faixaDosGanhos.classList.add('faixa-no-fim');
  const faixaDoAndamento = faixaQueRecolhe(['A conquistar', 'A conquistar'], quantidade(andamento.length, ['título', 'títulos']), [emAndamento], `andamento:${alguem.id}`, vizinhas);
  document.getElementById('perfil-andamento').replaceChildren(
    ...(recolhidos.length ? [faixaDosGanhos] : []),
    ...(andamento.length ? [faixaDoAndamento, emAndamento] : []));
}

function faixaQueRecolhe(rotulos, detalhe, recolhiveis, chave, vizinhas) {
  const faixa = criar('button', 'faixa-recolhivel');
  faixa.type = 'button';
  const rotulo = criar('span', 'rotulo');
  faixa.append(rotulo, criar('span', 'detalhe', detalhe), criar('span', 'seta-redonda'));
  const mostrar = () => {
    const aberto = faixaAbertaNoPerfil === chave;
    recolhiveis.forEach(r => { r.hidden = !aberto; });
    rotulo.textContent = rotulos[aberto ? 1 : 0];
    faixa.setAttribute('aria-expanded', aberto);
  };
  vizinhas.push(mostrar);
  mostrar();
  faixa.addEventListener('click', () => {
    faixaAbertaNoPerfil = faixaAbertaNoPerfil === chave ? '' : chave;
    vizinhas.forEach(atualizar => atualizar());
  });
  return faixa;
}

function mostrarEscolhaDeTitulo() {
  const ganhos = titulosGanhos(estado.eu.id);
  const lista = document.getElementById('escolha-titulo');
  document.getElementById('sem-titulo').hidden = ganhos.length > 0;
  lista.hidden = !ganhos.length;
  const automatico = criar('span', 'opcao-automatica');
  automatico.append(criar('span', '', 'Automático'), criar('span', 'detalhe', 'o seu título mais raro'));
  const opcoes = [['', automatico], ...ganhos.map(s => [s.titulo.id, linhaDoTitulo(s)]), ['nenhum', criar('span', '', 'Nenhum')]];
  const marcado = escolhaAtual();
  const usarMoldura = document.getElementById('usar-moldura');
  usarMoldura.hidden = !ganhos.length;
  usarMoldura.disabled = marcado === 'nenhum';
  usarMoldura.setAttribute('aria-checked', estado.eu.moldura);
  lista.replaceChildren(...opcoes.map(([valor, conteudo]) => {
    const opcao = criar('button', 'opcao-titulo');
    opcao.type = 'button';
    opcao.setAttribute('role', 'radio');
    opcao.setAttribute('aria-checked', valor === marcado);
    opcao.append(criar('span', 'marcador'), conteudo);
    opcao.addEventListener('click', () => escolherTitulo(valor));
    return opcao;
  }));
}

function escolhaAtual() {
  const { titulo, id } = estado.eu;
  return titulo === 'nenhum' || titulosGanhos(id).some(s => s.titulo.id === titulo) ? titulo : '';
}

async function escolherTitulo(valor) {
  if (escolhaAtual() === valor) return;
  const aviso = document.getElementById('aviso-titulo');
  document.querySelectorAll('#escolha-titulo button').forEach(b => { b.disabled = true; });
  aviso.textContent = '';
  try {
    await ACOES.definirTitulo({ titulo: valor });
    aplicarEstadoEmEspera();
    tocar('confirmar');
  } catch (erro) {
    tocar('erro');
    aviso.textContent = mensagemDeErro(erro);
  } finally {
    if (telaVisivel === 'perfil') mostrarEscolhaDeTitulo();
  }
}

async function alternarMoldura() {
  const botao = document.getElementById('usar-moldura');
  const aviso = document.getElementById('aviso-moldura');
  botao.disabled = true;
  aviso.textContent = '';
  try {
    await ACOES.definirMoldura({ moldura: !estado.eu.moldura });
    aplicarEstadoEmEspera();
    tocar('confirmar');
  } catch (erro) {
    tocar('erro');
    aviso.textContent = mensagemDeErro(erro);
  } finally {
    if (telaVisivel === 'perfil') mostrarEscolhaDeTitulo();
  }
}

async function fotoReduzida(arquivo, { inteira = false } = {}) {
  let imagem;
  try {
    imagem = await createImageBitmap(arquivo);
  } catch {
    throw new Error('Não consegui abrir essa imagem. Tente uma foto JPG ou PNG.');
  }
  const quadro = document.createElement('canvas');
  if (inteira) {
    const escala = Math.min(1, LADO_FOTO / Math.max(imagem.width, imagem.height));
    quadro.width = Math.round(imagem.width * escala);
    quadro.height = Math.round(imagem.height * escala);
    quadro.getContext('2d').drawImage(imagem, 0, 0, quadro.width, quadro.height);
  } else {
    const lado = Math.min(imagem.width, imagem.height);
    quadro.width = LADO_FOTO;
    quadro.height = LADO_FOTO;
    quadro.getContext('2d').drawImage(imagem, (imagem.width - lado) / 2, (imagem.height - lado) / 2, lado, lado, 0, 0, LADO_FOTO, LADO_FOTO);
  }
  for (const qualidade of [0.85, 0.75, 0.65, 0.55, 0.45]) {
    for (const formato of ['image/webp', 'image/jpeg']) {
      const dados = quadro.toDataURL(formato, qualidade);
      if (dados.startsWith(`data:${formato}`) && dados.length <= LIMITE_FOTO) return dados;
    }
  }
  throw new Error('Essa foto ficou grande demais. Tente outra.');
}

function ligarPerfil() {
  const formulario = document.getElementById('form-novo-apelido');
  const campo = document.getElementById('campo-novo-apelido');
  const salvar = formulario.querySelector('button');
  const aviso = document.getElementById('aviso-perfil');
  document.getElementById('usar-moldura').addEventListener('click', alternarMoldura);

  campo.addEventListener('input', () => {
    campo.value = limparApelido(campo.value);
    salvar.disabled = !campo.value || campo.value === estado.eu.apelido;
    aviso.textContent = '';
  });

  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    if (await enviar(salvar, aviso, 'definirPerfil', { apelido: campo.value })) {
      campo.value = '';
      abrirMenuFoto(false);
    }
    salvar.disabled = !campo.value;
  });

  const trocar = document.getElementById('trocar-foto');
  const menuFoto = document.getElementById('menu-foto');
  const avisoFoto = document.getElementById('aviso-foto');
  const formLink = document.getElementById('form-foto-link');
  const dicaLink = document.getElementById('dica-foto-link');
  const campoLink = document.getElementById('campo-foto-link');
  const usarLink = formLink.querySelector('button');

  const abrirMenuFoto = aberto => {
    menuFoto.hidden = !aberto;
    trocar.setAttribute('aria-expanded', aberto);
    formLink.hidden = true;
    dicaLink.hidden = true;
    avisoFoto.textContent = '';
    aviso.textContent = '';
  };
  const trocou = sucesso => { if (sucesso) abrirMenuFoto(false); };
  trocar.addEventListener('click', () => abrirMenuFoto(menuFoto.hidden));

  const google = document.getElementById('foto-google');
  google.addEventListener('click', async () => trocou(await enviar(google, avisoFoto, 'definirPerfil', { foto: 'google' })));

  document.getElementById('abrir-foto-link').addEventListener('click', () => {
    formLink.hidden = false;
    dicaLink.hidden = false;
    campoLink.focus();
  });
  const linkValido = () => /^https:\/\/[^\s"'<>]{4,500}$/.test(campoLink.value.trim());
  campoLink.addEventListener('input', () => { usarLink.disabled = !linkValido(); });
  formLink.addEventListener('submit', async evento => {
    evento.preventDefault();
    if (!linkValido()) return;
    const sucesso = await enviar(usarLink, avisoFoto, 'definirPerfil', { foto: campoLink.value.trim() });
    if (sucesso) campoLink.value = '';
    usarLink.disabled = !linkValido();
    trocou(sucesso);
  });

  const arquivo = document.getElementById('foto-arquivo');
  const rotulo = document.querySelector('label[for="foto-arquivo"]');
  arquivo.addEventListener('change', async () => {
    const [escolhido] = arquivo.files;
    arquivo.value = '';
    if (!escolhido) return;
    rotulo.textContent = 'Enviando…';
    try {
      trocou(await enviar(google, avisoFoto, 'definirPerfil', { foto: await fotoReduzida(escolhido) }));
    } catch (erro) {
      avisoFoto.textContent = erro.message;
    } finally {
      rotulo.textContent = 'Do celular';
    }
  });
}

function esquecerPerfil() {
  faixaAbertaNoPerfil = '';
}

export { mostrarPerfil, encaixarTopoDoPerfil, fotoReduzida, ligarPerfil, esquecerPerfil };
