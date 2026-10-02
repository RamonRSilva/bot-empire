const express = require('express');
const http = require('http');
const net = require('net');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const contasAtivas = {};

const TARGET_HOST = 'e4k-live-mz-cn1-hant1-game.goodgamestudios.com';
const TARGET_PORT = 443;

app.get('/ping', (req, res) => {
  res.status(200).send('Bot Empire Online & Active');
});

app.get('/', (req, res) => {
  res.status(200).send('Servidor do Bot Empire Four Kingdoms a funcionar corretamente.');
});

function processarMensagem(resposta, socket, user, passMd5, faseState) {
  console.log(`[RESPOSTA GLOBAL DO SERVIDOR - ${user}]:`, resposta);

  // Passo 1: Recebeu o apiOK inicial do SFS
  if (faseState.fase === 1 && (resposta.includes('apiOK') || resposta.includes('action="apiOK"'))) {
    faseState.fase = 2;
    console.log(`[PASSO 2] apiOK confirmado! A enviar login XML e XT para ${user}...`);
    
    // 1. Login XML Padrão
    const xmlLogin = `<msg t="sys"><body action="login" r="0"><login z="e4k-live-mz-cn1-hant1"><body u="${user}" p="${passMd5}" /></login></body></msg>\x00`;
    socket.write(xmlLogin);

    // 2. Pacote XT de Extensão de Login com parâmetros expandidos (Zona, Versão e Credenciais)
    setTimeout(() => {
      // Formato expandido: %xt%zona%login%id%usuario%senha%idioma%versao%
      const xtLogin = `%xt%e4k-live-mz-cn1-hant1%login%1%${user}%${passMd5}%en%166%\x00`;
      socket.write(xtLogin);
      console.log(`[PASSO 2.1] Pacote XT expandido enviado. A monitorizar resposta...`);
    }, 500);

    return;
  }

  // Passo 2: Analisar qualquer resposta após o envio do login
  if (faseState.fase === 2) {
    if (resposta.includes('logOK') || resposta.includes('loginOK') || resposta.includes('action="logOK"') || resposta.includes('%xt%login%0%')) {
      faseState.fase = 3;
      console.log(`[SUCESSO] Login autenticado com êxito para ${user}!`);
      
      setTimeout(() => {
        const joinGame = `%xt%e4k-live-mz-cn1-hant1%cmd%1%{"cmd":"k","param":{}}%\x00`;
        socket.write(joinGame);
        console.log(`[PASSO 3] Comando de sincronização inicial enviado.`);
      }, 1000);
    } else if (resposta.includes('logKO') || resposta.includes('error') || resposta.includes('ko')) {
      console.error(`[REJEITADO] O servidor recusou o login para ${user}:`, resposta);
    }
  }
}

app.post('/api/conectar', (req, res) => {
  const { usuario, senha, mundo } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ erro: 'Nome do jogador e Senha são obrigatórios.' });
  }

  const senhaMd5 = crypto.createHash('md5').update(senha).digest('hex');

  console.log(`[TCP SOCK] A iniciar ligação socket para ${usuario}...`);

  if (contasAtivas[usuario]) {
    if (contasAtivas[usuario].socket) {
      try { contasAtivas[usuario].socket.destroy(); } catch (e) {}
    }
    delete contasAtivas[usuario];
  }

  const client = new net.Socket();
  const faseState = { fase: 0 };
  let bufferAcumulado = '';

  client.setKeepAlive(true, 10000);

  client.connect(TARGET_PORT, TARGET_HOST, () => {
    console.log(`[TCP CONECTADO] Ligado a ${TARGET_HOST}:${TARGET_PORT}`);
    contasAtivas[usuario] = { usuario, mundo, conectado: true, socket: client };

    faseState.fase = 1;
    const xmlHandshake = '<msg t="sys"><body action="verChk" r="0"><ver v="166" /></body></msg>\x00';
    client.write(xmlHandshake);
    console.log(`[PASSO 1] Handshake verChk enviado.`);
  });

  client.on('data', (data) => {
    bufferAcumulado += data.toString('utf-8');

    let index = bufferAcumulado.indexOf('\x00');
    while (index !== -1) {
      const mensagem = bufferAcumulado.substring(0, index);
      bufferAcumulado = bufferAcumulado.substring(index + 1);

      if (mensagem.trim().length > 0) {
        processarMensagem(mensagem, client, usuario, senhaMd5, faseState);
      }
      index = bufferAcumulado.indexOf('\x00');
    }
  });

  client.on('error', (err) => {
    console.error(`[ERRO TCP - ${usuario}]:`, err.message);
  });

  client.on('close', () => {
    console.log(`[SOCKET FECHADO - ${usuario}] Ligação encerrada.`);
    if (contasAtivas[usuario]) contasAtivas[usuario].conectado = false;
  });

  res.json({ mensagem: `Ligação iniciada para ${usuario}.` });
});

app.post('/api/desconectar', (req, res) => {
  const { usuario } = req.body;
  if (contasAtivas[usuario]?.socket) {
    try { contasAtivas[usuario].socket.destroy(); } catch (e) {}
    delete contasAtivas[usuario];
  }
  res.json({ mensagem: `Desconectado com sucesso.` });
});

const PORT = process.env.PORT || 10000;
http.createServer(app).listen(PORT, () => {
  console.log(`[SERVIDOR] Ativo na porta ${PORT}`);
});
