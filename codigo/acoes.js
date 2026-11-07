import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { LIMITE_FOTO, EMAIL_VALIDO, tocar, jogoDe, jogador, mesDeHoje, podeFecharOMes } from './base.js?v=101';
import { titulosGanhos } from './titulos.js?v=101';
import { duelosDoGinasio, motivoParaNaoDesafiar } from './duelos.js?v=101';
import { ordemDeChegadaValida } from './partidas.js?v=101';
import { SERVIDORES, PRINCIPAL, email, servidor, banco, lidos, estado, aplicarEstadoEmEspera } from './app.js?v=101';

function limparApelido(texto) {
  return texto.toUpperCase().replace(/[^\p{L}\p{N}]/gu, '').slice(0, 8);
}

function recusa(mensagem) {
  return Object.assign(new Error(mensagem), { codigo: 'recusa' });
}

function novoId(colecao) {
  return doc(collection(banco, colecao)).id;
}

function novoIdDeJogador() {
  return `J${[...crypto.getRandomValues(new Uint8Array(4))].map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

function textoLivre(valor, minimo, maximo, rotulo) {
  const texto = String(valor || '').trim().replace(/\s+/g, ' ');
  if (texto.length < minimo || texto.length > maximo) throw recusa(`${rotulo} tem de ${minimo} a ${maximo} caracteres.`);
  return texto;
}

function linkDeFoto(texto) {
  return /^https:\/\/[^\s"'<>]{4,500}$/.test(texto);
}

function fotoDoGoogle() {
  const foto = PRINCIPAL.auth.currentUser?.photoURL || '';
  return linkDeFoto(foto) ? foto : '';
}

function fotoValida(foto) {
  if (foto === 'google') return fotoDoGoogle();
  if (foto.length <= LIMITE_FOTO && /^data:image\/(jpeg|png|webp);base64,[\w+/=]+$/.test(foto)) return foto;
  if (linkDeFoto(foto)) return foto;
  throw recusa('Foto inválida ou grande demais.');
}

function capaValida(capa) {
  const texto = String(capa).trim();
  if (texto.length <= LIMITE_FOTO && /^data:image\/(jpeg|png|webp);base64,[\w+/=]+$/.test(texto)) return texto;
  if (linkDeFoto(texto)) return texto;
  throw recusa('Foto do jogo inválida. Use uma foto ou um link que abra direto a imagem.');
}

function servidorDoDono(id) {
  const alvo = SERVIDORES.find(cada => cada.id === id && cada.doDono);
  if (!alvo) throw recusa('Você não é dono desse servidor.');
  return alvo;
}

async function emailJaLiberado(endereco, alvo) {
  if (estado.eu.dono) return alvo.doDono.acessos.some(a => a.id === endereco);
  return getDoc(doc(alvo.banco, 'acessos', endereco)).then(retrato => retrato.exists(), () => true);
}

function jogadoresSemEmail(alvo) {
  if (!alvo?.doDono) return [];
  const { jogadores, acessos } = alvo.doDono;
  return jogadores.filter(j => j.apelido && !acessos.some(a => a.jogador === j.id)).sort((a, b) => a.apelido.localeCompare(b.apelido, 'pt-BR'));
}

function exigirJogadorSemEmail(id, alvo) {
  if (!estado.eu.dono) throw recusa('Só o dono liga um e-mail a um jogador que já existe.');
  if (!jogadoresSemEmail(alvo).some(j => j.id === id)) throw recusa('Esse jogador já tem e-mail.');
}

function partidaAbertaNoMes(id) {
  const partida = estado.partidas.find(p => p.id === id);
  if (!partida || partida.estado !== 'aberta') throw recusa('Essa partida não está mais aberta.');
  return partida;
}

const ACOES = {
  definirPerfil({ apelido, foto }) {
    const { eu } = estado;
    let nome = eu.apelido;
    if (apelido !== undefined) {
      nome = String(apelido).trim().toUpperCase();
      if (!/^[\p{L}\p{N}]{1,8}$/u.test(nome)) throw recusa('O apelido tem de 1 a 8 letras ou números, sem espaço.');
      if (estado.jogadores.some(j => j.id !== eu.id && j.apelido === nome)) throw recusa('Esse apelido já é de outro jogador.');
    }
    const novaFoto = foto === undefined ? eu.foto || fotoDoGoogle() : fotoValida(foto);
    return setDoc(doc(banco, 'jogadores', eu.id), { apelido: nome, foto: novaFoto }, { merge: true });
  },

  definirTitulo({ titulo }) {
    if (titulo && titulo !== 'nenhum' && !titulosGanhos(estado.eu.id).some(s => s.titulo.id === titulo)) throw recusa('Você ainda não ganhou esse título.');
    return updateDoc(doc(banco, 'jogadores', estado.eu.id), { titulo });
  },

  definirMoldura({ moldura }) {
    return updateDoc(doc(banco, 'jogadores', estado.eu.id), { moldura: Boolean(moldura) });
  },

  cadastrarJogo({ id, nome, menorVence, semPlacar, capa }) {
    const titulo = textoLivre(nome, 2, 40, 'O nome do jogo');
    if (estado.jogos.some(j => j.nome.toLowerCase() === titulo.toLowerCase())) throw recusa('Esse jogo já está cadastrado.');
    return setDoc(doc(banco, 'jogos', id), {
      nome: titulo, menorVence: Boolean(menorVence && !semPlacar), semPlacar: Boolean(semPlacar), criadoPor: estado.eu.id, criadoEm: serverTimestamp(),
      capa: capa ? capaValida(capa) : '',
    });
  },

  definirCapa({ jogo, capa }) {
    if (!estado.jogos.some(j => j.id === jogo)) throw recusa('Jogo não encontrado.');
    return updateDoc(doc(banco, 'jogos', jogo), { capa: capaValida(capa) });
  },

  abrirPartida({ id, jogo, participantes }) {
    const registro = estado.jogos.find(j => j.id === jogo);
    if (!registro) throw recusa('Jogo não encontrado.');
    const lista = [...new Set(participantes)];
    if (lista.length < 3 || lista.length > 10) throw recusa('Uma partida tem de 3 a 10 jogadores.');
    if (lista.some(j => !jogador(j))) throw recusa('Tem jogador na lista que não está no ranking.');
    const placares = Object.fromEntries(lista.map((j, i) => [j, registro.semPlacar ? i + 1 : null]));
    return setDoc(doc(banco, 'partidas', id), { mes: mesDeHoje(), jogo, abertaPor: estado.eu.id, abertaEm: serverTimestamp(), participantes: lista, placares });
  },

  lancarPlacar({ partida, valor }) {
    const registro = partidaAbertaNoMes(partida);
    if (registro.mes !== mesDeHoje()) throw recusa('Essa partida é de um mês que já fechou e não conta mais.');
    if (!Number.isFinite(valor) || valor < 0 || valor > 1e9) throw recusa('Placar inválido.');
    const meu = registro.placares.find(s => s.jogador === estado.eu.id);
    if (!meu) throw recusa('Você não está nessa partida.');
    const campos = { [`placares.${estado.eu.id}`]: valor };
    if (meu.valor === null) campos[`lancadoEm.${estado.eu.id}`] = serverTimestamp();
    return updateDoc(doc(banco, 'partidas', partida), campos);
  },

  corrigirPlacares({ partida, mudancas }) {
    if (!estado.eu.admin) throw recusa('Só o administrador corrige placares.');
    const registro = estado.partidas.find(p => p.id === partida);
    if (!registro) throw recusa('Partida não encontrada.');
    if (Object.values(mudancas).some(v => !Number.isFinite(v) || v < 0 || v > 1e9)) throw recusa('Placar inválido.');
    if (jogoDe(registro).semPlacar && !ordemDeChegadaValida(registro, mudancas)) throw recusa(`Use cada colocação de 1 a ${registro.placares.length} uma vez.`);
    return updateDoc(doc(banco, 'partidas', partida), Object.fromEntries(Object.entries(mudancas).map(([id, v]) => [`placares.${id}`, v])));
  },

  incluirPlacares({ partida, mudancas }) {
    if (!estado.eu.admin) throw recusa('Só o administrador inclui placares.');
    const registro = partidaAbertaNoMes(partida);
    if (registro.mes !== mesDeHoje()) throw recusa('Essa partida é de um mês que já fechou e não conta mais.');
    if (Object.keys(mudancas).some(id => registro.placares.find(s => s.jogador === id)?.valor !== null)) throw recusa('Esse placar já foi lançado.');
    return this.corrigirPlacares({ partida, mudancas });
  },

  cancelarPartida({ partida }) {
    const registro = partidaAbertaNoMes(partida);
    if (registro.abertaPor !== estado.eu.id && !estado.eu.admin) throw recusa('Só quem abriu a partida pode cancelar.');
    return deleteDoc(doc(banco, 'partidas', partida));
  },

  fecharMes() {
    if (!podeFecharOMes()) throw recusa('O mês só pode ser fechado na última semana.');
    if (estado.partidas.some(p => p.mes === estado.mesAtual && p.estado === 'aberta')) throw recusa('Feche ou cancele a partida aberta antes.');
    return setDoc(doc(banco, 'fechamentos', estado.mesAtual), { fechadoEm: serverTimestamp() });
  },

  definirPremio({ mes, texto }) {
    return setDoc(doc(banco, 'premios', mes), { texto: textoLivre(texto, 2, 80, 'O prêmio') });
  },

  async liberarEmail({ email: endereco, jogador: id, servidor: alvoId }) {
    endereco = String(endereco || '').trim().toLowerCase();
    if (!EMAIL_VALIDO.test(endereco)) throw recusa('E-mail inválido.');
    const alvo = estado.eu.dono ? servidorDoDono(alvoId) : servidor;
    if (await emailJaLiberado(endereco, alvo)) throw recusa('Esse e-mail já está liberado.');
    if (id) exigirJogadorSemEmail(id, alvo);
    const pedidos = estado.eu.dono ? alvo.doDono.pedidos : lidos.pedidos;
    const lote = writeBatch(alvo.banco);
    lote.set(doc(alvo.banco, 'acessos', endereco), { jogador: id || novoIdDeJogador(), admin: false, dono: false });
    if (pedidos.some(p => p.id === endereco)) lote.delete(doc(alvo.banco, 'pedidos', endereco));
    return lote.commit();
  },

  aprovarPedido({ pedido, jogador: id }) {
    if (!lidos.pedidos.some(p => p.id === pedido)) throw recusa('Esse pedido não existe mais.');
    if (id) exigirJogadorSemEmail(id, servidor);
    const lote = writeBatch(banco);
    lote.set(doc(banco, 'acessos', pedido), { jogador: id || novoIdDeJogador(), admin: false, dono: false });
    lote.delete(doc(banco, 'pedidos', pedido));
    return lote.commit();
  },

  mudarAcesso({ servidor: alvoId, email: endereco, papel }) {
    if (!estado.eu.dono) throw recusa('Só o dono muda os acessos.');
    if (endereco === email) throw recusa('O seu próprio acesso não muda por aqui.');
    const alvo = servidorDoDono(alvoId);
    const atual = alvo.doDono.acessos.find(a => a.id === endereco);
    if (!atual) throw recusa('Esse acesso não existe mais.');
    if (atual.dono) throw recusa('O acesso de outro dono não muda por aqui.');
    const lugar = doc(alvo.banco, 'acessos', endereco);
    if (!papel) return deleteDoc(lugar);
    return setDoc(lugar, { jogador: atual.jogador, admin: papel === 'admin', dono: false });
  },

  recusarPedido({ pedido }) {
    return deleteDoc(doc(banco, 'pedidos', pedido));
  },

  salvarFrase({ mes, texto }) {
    if (!/^\d{4}-\d{2}$/.test(mes) || mes >= mesDeHoje()) throw recusa('Só dá para escrever a frase de um mês que já fechou.');
    return setDoc(doc(banco, 'frases', `${mes}_${estado.eu.id}`), { mes, jogador: estado.eu.id, texto: textoLivre(texto, 2, 120, 'A frase') });
  },

  desafiar({ desafiado, jogo, provocacao }) {
    if (!jogador(desafiado) || desafiado === estado.eu.id) throw recusa('Escolha quem você quer desafiar.');
    if (!estado.jogos.some(j => j.id === jogo)) throw recusa('Escolha o jogo do duelo.');
    const motivo = motivoParaNaoDesafiar(desafiado);
    if (motivo) throw recusa(motivo);
    return setDoc(doc(banco, 'duelos', novoId('duelos')), {
      desafiante: estado.eu.id, desafiado, jogo, provocacao: textoLivre(provocacao, 0, 60, 'A provocação'),
      criadoEm: serverTimestamp(), situacao: 'convite', respondidoEm: null,
    });
  },

  responderDuelo({ duelo, aceitar }) {
    const registro = duelosDoGinasio().find(d => d.id === duelo);
    if (registro?.fase !== 'convite') throw recusa('Esse convite não está mais valendo.');
    if (registro.desafiado !== estado.eu.id) throw recusa('Só quem foi desafiado responde.');
    return updateDoc(doc(banco, 'duelos', duelo), { situacao: aceitar ? 'aceito' : 'recusado', respondidoEm: serverTimestamp() });
  },

  cancelarDuelo({ duelo }) {
    const registro = duelosDoGinasio().find(d => d.id === duelo);
    if (registro?.fase !== 'convite') throw recusa('Esse convite não está mais valendo.');
    if (registro.desafiante !== estado.eu.id) throw recusa('Só quem desafiou cancela.');
    return updateDoc(doc(banco, 'duelos', duelo), { situacao: 'cancelado', respondidoEm: serverTimestamp() });
  },
};

function mensagemDeErro(erro) {
  if (erro.codigo === 'recusa') return erro.message;
  if (erro.code === 'permission-denied') return 'O banco recusou essa alteração.';
  return 'Não consegui salvar. Tente de novo.';
}

async function enviar(botao, aviso, acao, valores, somDoSucesso = 'confirmar') {
  const texto = botao.textContent;
  botao.disabled = true;
  botao.textContent = 'Salvando…';
  aviso.textContent = '';
  try {
    await ACOES[acao](valores);
    aplicarEstadoEmEspera();
    tocar(typeof somDoSucesso === 'function' ? somDoSucesso() : somDoSucesso);
    return true;
  } catch (erro) {
    tocar('erro');
    aviso.textContent = mensagemDeErro(erro);
    return false;
  } finally {
    if (botao.textContent === 'Salvando…') {
      botao.textContent = texto;
      botao.disabled = false;
    }
  }
}

export { limparApelido, novoId, linkDeFoto, fotoDoGoogle, jogadoresSemEmail, ACOES, mensagemDeErro, enviar };
