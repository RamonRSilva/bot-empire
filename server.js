const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const contasAtivas = {};

// Host exato do HANT1 extraído do PCAPdroid
const HOST_HANT1 = 'e4k-live-mz-cn1-hant1-game.goodgamestudios.com';

app.post('/api/conectar', (req, res) => {
  const { usuario, senha, mundo } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ erro: 'Nome do jogador e Senha são obrigatórios.' });
  }

  // Tentar conexão com Host header explícito
  const targetUrl = `wss://${HOST_HANT1}:443`;
  console.log(`[LOGIN EXATO v11] Conectando ${usuario} em ${targetUrl}...`);

  const ws = new WebSocket(targetUrl, {
    rejectUnauthorized: false,
    handshakeTimeout: 12000,
    headers: {
      'Host': HOST_HANT1,
      'User-Agent': 'Mozilla/5.0 (Android; Mobile)',
      'Origin': 'https://empire.goodgamestudios.com'
    }
  });

  contasAtivas[usuario] = { usuario, mundo, conectado: false, ws };

  ws.on('open', () => {
    console.log(`[WS CONECTADO] Conexão aberta com ${HOST_HANT1}! Enviando Handshake XML...`);
    contasAtivas[usuario].conectado = true;

    // Handshake XML do SmartFoxServer
    const xmlHandshake = '<msg t="sys"><body action="verChk" r="0"><ver v="166" /></body></msg>';
    ws.send(xmlHandshake);
    console.log(`[ENVIADO] ${xmlHandshake}`);
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

  res.json({ mensagem: `Tentativa com Host header explícito iniciada. Verifique os logs no Render.` });
});

const PORT = process.env.PORT || 10000;
http.createServer(app).listen(PORT, () => {
  console.log(`[SERVIDOR] Ativo na porta ${PORT}`);
});
