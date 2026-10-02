const express = require('express');
const http = require('http');
const net = require('net');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const contasAtivas = {};

// Dados exatos do servidor HANT1 extraídos do PCAPdroid
const TARGET_HOST = 'e4k-live-mz-cn1-hant1-game.goodgamestudios.com';
const TARGET_PORT = 443;

app.post('/api/conectar', (req, res) => {
  const { usuario, senha, mundo } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ erro: 'Nome do jogador e Senha são obrigatórios.' });
  }

  console.log(`[TCP SOCK] Abrindo Socket TCP Nativo com ${TARGET_HOST}:${TARGET_PORT}...`);

  // Conexão TCP pura (Layer 4) em vez de WebSocket
  const client = new net.Socket();

  client.connect(TARGET_PORT, TARGET_HOST, () => {
    console.log(`[TCP CONECTADO] Sucesso! Socket TCP aberto com ${TARGET_HOST}:${TARGET_PORT}`);
    contasAtivas[usuario] = { usuario, mundo, conectado: true, socket: client };

    // Handshake XML inicial do SmartFoxServer com terminação NUL (\x00)
    const xmlHandshake = '<msg t="sys"><body action="verChk" r="0"><ver v="166" /></body></msg>\x00';
    client.write(xmlHandshake);
    console.log(`[TCP ENVIADO] Handshake XML enviado com sucesso.`);
  });

  client.on('data', (data) => {
    console.log(`[RESPOSTA CRUA TCP - ${usuario}]:`, data.toString());
  });

  client.on('error', (err) => {
    console.error(`[ERRO TCP - ${usuario}]:`, err.message);
  });

  client.on('close', () => {
    console.log(`[SOCKET TCP FECHADO - ${usuario}]`);
    if (contasAtivas[usuario]) contasAtivas[usuario].conectado = false;
  });

  res.json({ mensagem: `Conexão TCP Nativa iniciada no servidor HANT1. Acompanhe os logs no Render.` });
});

const PORT = process.env.PORT || 10000;
http.createServer(app).listen(PORT, () => {
  console.log(`[SERVIDOR] Ativo na porta ${PORT}`);
});
