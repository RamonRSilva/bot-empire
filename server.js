const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const contasAtivas = {};

// Domínio exato extraído da captura PCAPdroid para o servidor HANT1
const ENDPOINT_HANT1 = 'wss://e4k-live-mz-cn1-hant1-game.goodgamestudios.com:443';

app.post('/api/conectar', (req, res) => {
  const { usuario, senha, mundo } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ erro: 'Nome do jogador e Senha são obrigatórios.' });
  }

  console.log(`[LOGIN EXATO] Conectando ${usuario} em ${ENDPOINT_HANT1}...`);

  const ws = new WebSocket(ENDPOINT_HANT1, {
    rejectUnauthorized: false,
    handshakeTimeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Android; Mobile)',
      'Origin': 'https://empire.goodgamestudios.com'
    }
  });

  contasAtivas[usuario] = { usuario, mundo, conectado: false, ws };

  ws.on('open', () => {
    console.log(`[WS CONECTADO] Sucesso! Conexão estabelecida com ${ENDPOINT_HANT1}`);
    contasAtivas[usuario].conectado = true;

    // Handshake inicial do SmartFoxServer
    const xmlHandshake = '<msg t="sys"><body action="verChk" r="0"><ver v="166" /></body></msg>';
    ws.send(xmlHandshake);
    console.log(`[ENVIADO] Handshake XML enviado com sucesso.`);
  });

  ws.on('message', (data) => {
    console.log(`[RESPOSTA JOGO - ${usuario}]:`, data.toString());
  });

  ws.on('error', (err) => {
    console.error(`[ERRO WS - ${usuario}]:`, err.message);
  });

  ws.on('close', (code, reason) => {
    console.log(`[SOCKET FECHADO - ${usuario}] Código: ${code} | Razão: ${reason.toString() || 'Nenhuma'}`);
    if (contasAtivas[usuario]) contasAtivas[usuario].conectado = false;
  });

  res.json({ mensagem: `Tentativa iniciada no domínio oficial HANT1. Acompanhe os logs no Render.` });
});

const PORT = process.env.PORT || 10000;
http.createServer(app).listen(PORT, () => {
  console.log(`[SERVIDOR] Ativo na porta ${PORT}`);
});
