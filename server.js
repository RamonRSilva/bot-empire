const express = require('express');
const http = require('http');
const tls = require('tls');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const contasAtivas = {};

const TARGET_HOST = 'e4k-live-mz-cn1-hant1-game.goodgamestudios.com';
const TARGET_PORT = 443;

app.post('/api/conectar', (req, res) => {
  const { usuario, senha, mundo } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ erro: 'Nome do jogador e Senha são obrigatórios.' });
  }

  console.log(`[TLS SOCK] Iniciando conexão segura para ${usuario}...`);

  if (contasAtivas[usuario] && contasAtivas[usuario].socket) {
    contasAtivas[usuario].socket.destroy();
  }

  let bufferAcumulado = '';
  let faseLogin = 0;

  // Uso do TLS para porta 443
  const client = tls.connect(TARGET_PORT, TARGET_HOST, { rejectUnauthorized: false }, () => {
    console.log(`[TLS CONECTADO] Conexão segura estabelecida com ${TARGET_HOST}:${TARGET_PORT}`);
    contasAtivas[usuario] = { usuario, mundo, conectado: true, socket: client };

    // Passo 1: Handshake verChk
    faseLogin = 1;
    const xmlHandshake = '<msg t="sys"><body action="verChk" r="0"><ver v="166" /></body></msg>\x00';
    client.write(xmlHandshake);
    console.log(`[PASSO 1] Handshake verChk enviado.`);
  });

  client.on('data', (data) => {
    bufferAcumulado += data.toString('utf-8');

    // Processa mensagens delimitadas por \x00 (Byte 0)
    let index = bufferAcumulado.indexOf('\x00');
    while (index !== -1) {
      const mensagem = bufferAcumulado.substring(0, index);
      bufferAcumulado = bufferAcumulado.substring(index + 1);

      if (mensagem.trim().length > 0) {
        processarMensagem(mensagem, client, usuario, senha);
      }
      index = bufferAcumulado.indexOf('\x00');
    }
  });

  function processarMensagem(resposta, socket, user, pass) {
    console.log(`[RESPOSTA RECEBIDA - ${user}]:`, resposta);

    // Passo 2: Confirmar apiOK e enviar requisição de Login em XML
    if (faseLogin === 1 && resposta.includes('apiOK')) {
      faseLogin = 2;
      console.log(`[PASSO 2] apiOK recebido. Enviando pacote de Login XML...`);
      
      const xmlLogin = `<msg t="sys"><body action="login" r="0"><login z="e4k-live-mz-cn1-hant1"><body u="${user}" p="${pass}" /></login></body></msg>\x00`;
      socket.write(xmlLogin);
    }
  }

  client.on('error', (err) => {
    console.error(`[ERRO TLS - ${usuario}]:`, err.message);
  });

  client.on('close', () => {
    console.log(`[SOCKET FECHADO - ${usuario}] Conexão encerrada.`);
    if (contasAtivas[usuario]) contasAtivas[usuario].conectado = false;
  });

  res.json({ mensagem: `Processo iniciado para ${usuario}. Acompanhe os logs no Render.` });
});

const PORT = process.env.PORT || 10000;
http.createServer(app).listen(PORT, () => {
  console.log(`[SERVIDOR] Ativo na porta ${PORT}`);
});
