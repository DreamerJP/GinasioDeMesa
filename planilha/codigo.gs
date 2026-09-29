/**
 * @OnlyCurrentDoc
 */

const CLIENTE_GOOGLE = '777149850301-ht36a0eodiaqs0398l5qgoaoeglteajg.apps.googleusercontent.com';
const FUSO = 'America/Sao_Paulo';
const LIMITE_FOTO = 45000;

const ABAS = {
  Jogadores: ['id', 'email', 'apelido', 'foto', 'admin', 'criadoEm', 'nomeGoogle', 'situacao'],
  Jogos: ['id', 'nome', 'menorVence', 'semPlacar', 'criadoPor', 'criadoEm'],
  Partidas: ['id', 'mes', 'jogo', 'abertaPor', 'estado', 'abertaEm', 'fechadaEm'],
  Placares: ['partida', 'jogador', 'valor', 'lancadoEm'],
  Premios: ['mes', 'texto'],
  Frases: ['mes', 'jogador', 'texto'],
};

const ACOES_SEM_APELIDO = ['estado', 'definirPerfil'];
const AGUARDANDO = 'Seu pedido de entrada foi enviado. Assim que o administrador aprovar, é só entrar de novo.';

const ACOES = {
  estado() {},

  definirPerfil(eu, { apelido, foto }, conta) {
    const campos = {};
    if (apelido !== undefined) {
      const nome = String(apelido).trim().toUpperCase();
      if (!/^[\p{L}\p{N}]{1,8}$/u.test(nome)) throw recusa('O apelido tem de 1 a 8 letras ou números, sem espaço.');
      const dono = ler('Jogadores').find(j => j.id !== eu.id && j.apelido.toUpperCase() === nome);
      if (dono && !dono.email && !eu.apelido && ehSim(eu.admin)) {
        atualizar('Jogadores', dono, { email: eu.email, admin: 'sim', foto: fotoValida(foto, dono.foto, conta.foto) });
        apagarLinha('Jogadores', eu);
        return;
      }
      if (dono) throw recusa('Esse apelido já é de outro jogador.');
      campos.apelido = nome;
    }
    if (foto !== undefined || !eu.foto) campos.foto = fotoValida(foto, eu.foto, conta.foto);
    atualizar('Jogadores', eu, campos);
  },

  cadastrarJogo(eu, { nome, menorVence, semPlacar }) {
    const titulo = textoLivre(nome, 2, 40, 'O nome do jogo');
    if (ler('Jogos').some(j => j.nome.toLowerCase() === titulo.toLowerCase())) throw recusa('Esse jogo já está cadastrado.');
    acrescentar('Jogos', [{ id: novoId('G'), nome: titulo, menorVence: menorVence ? 'sim' : '', semPlacar: semPlacar ? 'sim' : '', criadoPor: eu.id, criadoEm: agora() }]);
  },

  abrirPartida(eu, { jogo, participantes, ordem }) {
    const registroJogo = ler('Jogos').find(j => j.id === jogo);
    if (!registroJogo) throw recusa('Jogo não encontrado.');
    const validos = new Set(ler('Jogadores').filter(j => j.apelido).map(j => j.id));
    const lista = [...new Set(participantes || [])];
    if (lista.length < 3 || lista.length > 10) throw recusa('Uma partida tem de 3 a 10 jogadores.');
    if (lista.some(id => !validos.has(id))) throw recusa('Tem jogador na lista que não está no ranking.');

    const semPlacar = ehSim(registroJogo.semPlacar);
    const ordemCompleta = Array.isArray(ordem) && ordem.length === lista.length && lista.every(id => ordem.includes(id));
    if (semPlacar && !ordemCompleta) throw recusa('Informe a ordem de chegada de todos os jogadores.');

    const id = novoId('P');
    const momento = agora();
    acrescentar('Partidas', [{
      id, mes: mesAtual(), jogo, abertaPor: eu.id,
      estado: semPlacar ? 'fechada' : 'aberta', abertaEm: momento, fechadaEm: semPlacar ? momento : '',
    }]);
    acrescentar('Placares', (semPlacar ? ordem : lista).map((jogador, i) => ({
      partida: id, jogador, valor: semPlacar ? String(i + 1) : '', lancadoEm: semPlacar ? momento : '',
    })));
  },

  lancarPlacar(eu, { partida, valor }) {
    const registro = ler('Partidas').find(p => p.id === partida);
    if (!registro || registro.estado !== 'aberta') throw recusa('Essa partida não está mais aberta.');
    if (registro.mes.slice(0, 7) !== mesAtual()) throw recusa('Essa partida é de um mês que já fechou e não conta mais.');
    const numero = Number(valor);
    if (valor === '' || valor === null || !Number.isFinite(numero) || numero < 0) throw recusa('Placar inválido.');

    const placares = ler('Placares').filter(s => s.partida === partida);
    const meu = placares.find(s => s.jogador === eu.id);
    if (!meu) throw recusa('Você não está nessa partida.');
    atualizar('Placares', meu, { valor: String(numero), lancadoEm: agora() });
    if (placares.every(s => s === meu || s.valor !== '')) atualizar('Partidas', registro, { estado: 'fechada', fechadaEm: agora() });
  },

  cancelarPartida(eu, { partida }) {
    const registro = ler('Partidas').find(p => p.id === partida);
    if (!registro || registro.estado !== 'aberta') throw recusa('Só dá para cancelar partida aberta.');
    if (registro.abertaPor !== eu.id && !ehSim(eu.admin)) throw recusa('Só quem abriu a partida pode cancelar.');
    atualizar('Partidas', registro, { estado: 'cancelada', fechadaEm: agora() });
  },

  definirPremio(eu, { mes, texto }) {
    exigirAdmin(eu);
    if (!/^\d{4}-\d{2}$/.test(mes)) throw recusa('Mês inválido.');
    const descricao = textoLivre(texto, 2, 80, 'O prêmio');
    const existente = ler('Premios').find(p => p.mes.slice(0, 7) === mes);
    if (existente) atualizar('Premios', existente, { texto: descricao });
    else acrescentar('Premios', [{ mes, texto: descricao }]);
  },

  liberarEmail(eu, { email, jogador }) {
    exigirAdmin(eu);
    const endereco = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(endereco)) throw recusa('E-mail inválido.');
    const jogadores = ler('Jogadores');
    const existente = jogadores.find(j => j.email === endereco);
    if (existente && existente.situacao === 'pendente') throw recusa('Esse e-mail já pediu entrada. Aprove na lista de pedidos.');
    if (existente) throw recusa('Esse e-mail já está liberado.');
    if (!jogador) {
      acrescentar('Jogadores', [{ id: novoId('J'), email: endereco, criadoEm: agora() }]);
      return;
    }
    const registro = jogadores.find(j => j.id === jogador);
    if (!registro || registro.email) throw recusa('Esse jogador já tem e-mail.');
    atualizar('Jogadores', registro, { email: endereco });
  },

  aprovarPedido(eu, { pedido, jogador }) {
    exigirAdmin(eu);
    const jogadores = ler('Jogadores');
    const registro = jogadores.find(j => j.id === pedido && j.situacao === 'pendente');
    if (!registro) throw recusa('Esse pedido não existe mais.');
    if (!jogador) {
      atualizar('Jogadores', registro, { situacao: '' });
      return;
    }
    const destino = jogadores.find(j => j.id === jogador);
    if (!destino || destino.email) throw recusa('Esse jogador já tem e-mail.');
    atualizar('Jogadores', destino, { email: registro.email, nomeGoogle: registro.nomeGoogle });
    apagarLinha('Jogadores', registro);
  },

  recusarPedido(eu, { pedido }) {
    exigirAdmin(eu);
    const registro = ler('Jogadores').find(j => j.id === pedido && j.situacao === 'pendente');
    if (!registro) throw recusa('Esse pedido não existe mais.');
    apagarLinha('Jogadores', registro);
  },

  salvarFrase(eu, { mes, texto }) {
    if (!/^\d{4}-\d{2}$/.test(mes) || mes >= mesAtual()) throw recusa('Só dá para escrever a frase de um mês que já fechou.');
    const frase = textoLivre(texto, 2, 120, 'A frase');
    const existente = ler('Frases').find(f => f.mes.slice(0, 7) === mes && f.jogador === eu.id);
    if (existente) atualizar('Frases', existente, { texto: frase });
    else acrescentar('Frases', [{ mes, jogador: eu.id, texto: frase }]);
  },
};

function doGet() {
  return ContentService.createTextOutput('Ginásio de Mesa: servidor no ar.');
}

function doPost(e) {
  let resposta;
  try {
    const pedido = JSON.parse(e.postData.contents);
    const acao = ACOES[pedido.acao];
    if (!acao) throw recusa('Ação desconhecida.');
    const conta = contaDoToken(pedido.token);

    const trava = LockService.getScriptLock();
    trava.waitLock(15000);
    try {
      const eu = ler('Jogadores').find(j => j.email === conta.email);
      if (!eu) {
        const nomeGoogle = String(conta.nome || '').replace(/^[=+\-@]+/, '').slice(0, 60);
        acrescentar('Jogadores', [{ id: novoId('J'), email: conta.email, nomeGoogle, situacao: 'pendente', criadoEm: agora() }]);
        throw recusa(AGUARDANDO, 'pendente');
      }
      if (eu.situacao === 'pendente') throw recusa(AGUARDANDO, 'pendente');
      if (!eu.apelido && !ACOES_SEM_APELIDO.includes(pedido.acao)) throw recusa('Escolha seu apelido primeiro.', 'sem-apelido');
      if (!eu.foto && conta.foto) {
        atualizar('Jogadores', eu, { foto: conta.foto });
        eu.foto = conta.foto;
      }
      acao(eu, pedido.dados || {}, conta);
      resposta = { ok: true, dados: montarEstado(conta.email) };
    } finally {
      trava.releaseLock();
    }
  } catch (erro) {
    resposta = { ok: false, erro: erro.message, codigo: erro.codigo || 'erro' };
  }
  return ContentService.createTextOutput(JSON.stringify(resposta)).setMimeType(ContentService.MimeType.JSON);
}

function prepararPlanilha() {
  const arquivo = SpreadsheetApp.getActiveSpreadsheet();
  for (const [nome, colunas] of Object.entries(ABAS)) {
    const aba = arquivo.getSheetByName(nome) || arquivo.insertSheet(nome);
    aba.getRange(1, 1, aba.getMaxRows(), colunas.length).setNumberFormat('@');
    aba.getRange(1, 1, 1, colunas.length).setValues([colunas]).setFontWeight('bold');
    aba.setFrozenRows(1);
  }
  for (const aba of arquivo.getSheets()) {
    if (!ABAS[aba.getName()] && aba.getLastRow() === 0) arquivo.deleteSheet(aba);
  }
  const dono = Session.getEffectiveUser().getEmail().toLowerCase();
  if (!ler('Jogadores').some(j => j.email === dono)) {
    acrescentar('Jogadores', [{ id: novoId('J'), email: dono, admin: 'sim', criadoEm: agora() }]);
  }
}

function montarEstado(email) {
  const jogadores = ler('Jogadores');
  const eu = jogadores.find(j => j.email === email);
  const admin = ehSim(eu.admin);

  const placaresPorPartida = {};
  for (const s of ler('Placares')) {
    if (!placaresPorPartida[s.partida]) placaresPorPartida[s.partida] = [];
    placaresPorPartida[s.partida].push({ jogador: s.jogador, valor: s.valor === '' ? null : Number(s.valor) });
  }

  return {
    mesAtual: mesAtual(),
    eu: { id: eu.id, apelido: eu.apelido, foto: eu.foto, admin },
    jogadores: jogadores.filter(j => j.apelido).map(j => ({ id: j.id, apelido: j.apelido, foto: j.foto })),
    jogos: ler('Jogos').map(j => ({ id: j.id, nome: j.nome, menorVence: ehSim(j.menorVence), semPlacar: ehSim(j.semPlacar) })),
    partidas: ler('Partidas')
      .filter(p => p.estado !== 'cancelada')
      .map(p => ({ id: p.id, mes: p.mes.slice(0, 7), jogo: p.jogo, abertaPor: p.abertaPor, estado: p.estado, abertaEm: p.abertaEm, placares: placaresPorPartida[p.id] || [] })),
    premios: Object.fromEntries(ler('Premios').map(p => [p.mes.slice(0, 7), p.texto])),
    frases: ler('Frases').map(f => ({ mes: f.mes.slice(0, 7), jogador: f.jogador, texto: f.texto })),
    liberados: admin ? jogadores.filter(j => j.situacao !== 'pendente').map(j => ({ id: j.id, email: j.email, apelido: j.apelido })) : [],
    pedidos: admin ? jogadores.filter(j => j.situacao === 'pendente').map(j => ({ id: j.id, email: j.email, nome: j.nomeGoogle })) : [],
  };
}

function contaDoToken(token) {
  if (!token) throw recusa('Entre com sua conta Google.', 'token');
  const cache = CacheService.getScriptCache();
  const chave = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  const guardada = cache.get(chave);
  if (guardada) return JSON.parse(guardada);

  const resposta = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (resposta.getResponseCode() !== 200) throw recusa('Sua entrada expirou. Entre de novo.', 'token');
  const info = JSON.parse(resposta.getContentText());
  const restante = Number(info.exp) - Math.floor(Date.now() / 1000);
  if (info.aud !== CLIENTE_GOOGLE || String(info.email_verified) !== 'true' || restante <= 0) throw recusa('Entrada inválida. Entre de novo.', 'token');

  const conta = { email: info.email.toLowerCase(), foto: info.picture || '', nome: info.name || '' };
  cache.put(chave, JSON.stringify(conta), Math.min(restante, 21600));
  return conta;
}

function ler(nome) {
  const [cabecalho, ...linhas] = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome).getDataRange().getValues();
  const registros = [];
  linhas.forEach((linha, i) => {
    if (linha.every(v => v === '')) return;
    const registro = { _linha: i + 2 };
    for (const coluna of ABAS[nome]) registro[coluna] = comoTexto(linha[cabecalho.indexOf(coluna)]);
    registros.push(registro);
  });
  return registros;
}

function acrescentar(nome, registros) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  const cabecalho = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  const valores = registros.map(r => cabecalho.map(c => (r[c] === undefined ? '' : r[c])));
  aba.getRange(aba.getLastRow() + 1, 1, valores.length, cabecalho.length).setNumberFormat('@').setValues(valores);
}

function atualizar(nome, registro, campos) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  const cabecalho = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  for (const [campo, valor] of Object.entries(campos)) {
    aba.getRange(registro._linha, cabecalho.indexOf(campo) + 1).setValue(valor);
  }
}

function apagarLinha(nome, registro) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome).deleteRow(registro._linha);
}

function fotoValida(foto, atual, fotoGoogle) {
  if (foto === undefined || foto === null) return atual || fotoGoogle;
  if (foto === 'google') return fotoGoogle;
  if (/^midia\/[\w-]+\.(png|jpe?g|webp)$/.test(foto)) return foto;
  if (foto.length <= LIMITE_FOTO && /^data:image\/(jpeg|png|webp);base64,[\w+/=]+$/.test(foto)) return foto;
  if (/^https:\/\/[^\s"'<>]{4,500}$/.test(foto)) return foto; throw recusa('Foto inválida ou grande demais.');
}

function textoLivre(valor, minimo, maximo, rotulo) {
  const texto = String(valor || '').trim().replace(/\s+/g, ' ').replace(/^[=+\-@]+/, '');
  if (texto.length < minimo || texto.length > maximo) throw recusa(`${rotulo} tem de ${minimo} a ${maximo} caracteres.`);
  return texto;
}

function exigirAdmin(eu) {
  if (!ehSim(eu.admin)) throw recusa('Só o administrador pode fazer isso.');
}

function recusa(mensagem, codigo) {
  const erro = new Error(mensagem);
  erro.codigo = codigo;
  return erro;
}

function comoTexto(valor) {
  if (valor instanceof Date) return Utilities.formatDate(valor, FUSO, "yyyy-MM-dd'T'HH:mm:ss");
  return String(valor === undefined ? '' : valor).trim();
}

function ehSim(valor) {
  return /^(sim|s|true|x|1)$/i.test(valor);
}

function novoId(prefixo) {
  return prefixo + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
}

function agora() {
  return Utilities.formatDate(new Date(), FUSO, "yyyy-MM-dd'T'HH:mm:ss");
}

function mesAtual() {
  return Utilities.formatDate(new Date(), FUSO, 'yyyy-MM');
}
