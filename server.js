const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const contasAtivas = {};

// Domínios oficiais do jogo Empire: Four Kingdoms (evita bloqueio por IP direto)
const ENDPOINTS = [
  'wss://hant1.goodgamestudios.com:443',
  'wss://hant1-live.goodgamestudios.com:443',
  'wss://e4k-hant1.goodgamestudios.com:443',
  'ws://hant1.goodgamestudios.com:8080'
];

app.post('/api/conectar', (req, res) => {
  const { usuario, senha, mundo } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ erro: 'Nome do jogador e Senha são obrigatórios.' });
  }

  let endpointIndex = 0;

  function tentarConectar(url) {
    console.log(`[TENTATIVA ${endpointIndex + 1}] Conectando ${usuario} em ${url}...`);

    const ws = new WebSocket(url, {
      rejectUnauthorized: false,
      handshakeTimeout: 7000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Android; Mobile; rv:109.0) Gecko/109.0 Firefox/115.0',
        'Origin': 'https://empire.goodgamestudios.com'
      }
    });

    const timerTimeout = setTimeout(() => {
      console.log(`[TIMEOUT - 7s] Servidor ${url} não respondeu.`);
      ws.terminate();
    }, 8000);

    ws.on('open', () => {
      clearTimeout(timerTimeout);
      console.log(`[WS SUCESSO] Conectado com êxito em ${url}! Enviando autenticação...`);
      contasAtivas[usuario] = { usuario, mundo, conectado: true, ws };

      const payload = { cmd: 'login', user: usuario, pass: senha, world: mundo || 'HANT1' };
      ws.send(JSON.stringify(payload));
    });

    ws.on('message', (data) => {
      console.log(`[RESPOSTA JOGO - ${usuario}]:`, data.toString());
    });

    ws.on('error', (err) => {
      clearTimeout(timerTimeout);
      console.error(`[ERRO WS - ${url}]:`, err.message);
    });

    ws.on('close', (code) => {
      clearTimeout(timerTimeout);
      console.log(`[SOCKET FECHADO - ${url}] Código: ${code}`);

      endpointIndex++;
      if (endpointIndex < ENDPOINTS.length) {
        console.log(`[FALLBACK DOMÍNIO] Tentando próximo host oficial...`);
        tentarConectar(ENDPOINTS[endpointIndex]);
      } else {
        console.log(`[FIM] Todos os domínios falharam. Necessária captura de pacotes (HTTP/HTTPS Auth API) para o HANT1.`);
      }
    });
  }

  tentarConectar(ENDPOINTS[0]);
  res.json({ mensagem: `Tentativa iniciada nos domínios oficiais. Acompanhe os logs no Render.` });
});

const PORT = process.env.PORT || 10000;
http.createServer(app).listen(PORT, () => {
  console.log(`[SERVIDOR] Ativo na porta ${PORT}`);
});
