const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const contasAtivas = {};

// Lista de endpoints conhecidos do E4K (com fallback automático se o principal der timeout)
const ENDPOINTS = [
  'wss://52.77.8.40:443',
  'ws://52.77.8.40:8080',
  'ws://52.77.8.40:9300'
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
      handshakeTimeout: 7000, // Timeout de 7 segundos
      headers: {
        'User-Agent': 'Mozilla/5.0 (Android; Mobile)',
        'Origin': 'https://empire.goodgamestudios.com'
      }
    });

    const timerTimeout = setTimeout(() => {
      console.log(`[TIMEOUT - 7s] O servidor ${url} não respondeu ao handshake.`);
      ws.terminate();
    }, 8000);

    ws.on('open', () => {
      clearTimeout(timerTimeout);
      console.log(`[WS SUCESSO] Conectado em ${url}! Enviando comando login...`);
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

    ws.on('close', (code, reason) => {
      clearTimeout(timerTimeout);
      console.log(`[SOCKET FECHADO - ${url}] Código: ${code}`);

      // Tenta o próximo endpoint se o atual falhou
      endpointIndex++;
      if (endpointIndex < ENDPOINTS.length) {
        console.log(`[FALLBACK] Tentando próximo endpoint...`);
        tentarConectar(ENDPOINTS[endpointIndex]);
      } else {
        console.log(`[FIM] Todos os endpoints do jogo falharam. O IP pode estar alterado ou inacessível via IP direto.`);
      }
    });
  }

  tentarConectar(ENDPOINTS[0]);
  res.json({ mensagem: `Tentativa iniciada. Acompanhe as respostas em tempo real nos logs do Render.` });
});

const PORT = process.env.PORT || 10000;
http.createServer(app).listen(PORT, () => {
  console.log(`[SERVIDOR] Ativo na porta ${PORT}`);
});
