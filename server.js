const express = require('express');
const http = require('http');
const net = require('net');
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

  console.log(`[TCP SOCK] Disparando conexão para ${usuario}...`);

  if (contasAtivas[usuario] && contasAtivas[usuario].socket) {
    contasAtivas[usuario].socket.destroy();
  }

  const client = new net.Socket();
  let faseLogin = 0;
  let bufferAcumulado = '';

  // Ativa Keep-Alive TCP para evitar que a conexão seja derrubada por inatividade
  client.setKeepAlive(true, 10000);

  client.connect(TARGET_PORT, TARGET_HOST, () => {
    console.log(`[TCP CONECTADO] Socket ativo com ${TARGET_HOST}:${TARGET_PORT}`);
    contasAtivas[usuario] = { usuario, mundo, conectado: true, socket: client };

    // Passo 1: Handshake verChk
    faseLogin = 1;
    const xmlHandshake = '<msg t="sys"><body action="verChk" r="0"><ver v="166" /></body></msg>\x00';
    client.write(xmlHandshake);
    console.log(`[PASSO 1] Handshake verChk enviado.`);
  });

  client.on('data', (data) => {
    bufferAcumulado += data.toString('utf-8');

    // Processa pacotes delimitados pelo Byte 0 (\x00)
    let index = bufferAcumulado.indexOf('\x00');
    while (index !== -1) {
      const mensagem = bufferAcumulado.substring(0, index);
      bufferAcumulado = bufferAcumulado.substring(index + 1);

      if (mensagem.trim().length > 0) {
        console.log(`[RESPOSTA CRUA - ${usuario}]:`, mensagem);

        // Passo 2: apiOK confirmado -> Enviar login em XML
        if (faseLogin === 1 && mensagem.includes('apiOK')) {
          faseLogin = 2;
          console.log(`[PASSO 2] apiOK confirmado! Enviando pacote de login XML...`);
          
          const xmlLogin = `<msg t="sys"><body action="login" r="0"><login z="e4k-live-mz-cn1-hant1"><body u="${usuario}" p="${senha}" /></login></body></msg>\x00`;
          client.write(xmlLogin);
        }
      }
      index = bufferAcumulado.indexOf('\x00');
    }
  });

  client.on('error', (err) => {
    console.error(`[ERRO TCP - ${usuario}]:`, err.message);
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
