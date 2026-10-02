const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const contasAtivas = {};
const ENDPOINT_HANT1 = 'wss://52.77.8.40:443'; 

app.post('/api/conectar', (req, res) => {
  const { usuario, senha, mundo } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ erro: 'Nome do jogador e Senha são obrigatórios.' });
  }

  console.log(`[LOGIN TRACE] Tentando conectar ${usuario} em ${ENDPOINT_HANT1}...`);

  const ws = new WebSocket(ENDPOINT_HANT1, {
    rejectUnauthorized: false,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Android; Mobile)',
      'Origin': 'https://empire.goodgamestudios.com'
    }
  });

  contasAtivas[usuario] = { usuario, mundo, conectado: false, ws };

  ws.on('open', () => {
    console.log(`[WS CONECTADO] Socket aberto com sucesso para ${usuario}! Enviando handshake...`);
    contasAtivas[usuario].conectado = true;
    
    // Pacote de teste primário
    const payloadTest = {
      cmd: 'login',
      user: usuario,
      pass: senha,
      world: mundo || 'HANT1'
    };

    console.log(`[PACOTE ENVIADO]:`, JSON.stringify(payloadTest));
    ws.send(JSON.stringify(payloadTest));
  });

  ws.on('message', (data) => {
    console.log(`[RESPOSTA CRUA DO JOGO - ${usuario}]:`, data.toString());
  });

  ws.on('error', (err) => {
    console.error(`[ERRO NO SOCKET - ${usuario}]:`, err.message);
  });

  ws.on('close', (code, reason) => {
    console.log(`[SOCKET FECHADO - ${usuario}] Código: ${code} | Razão: ${reason.toString() || 'Sem razão informada'}`);
    if (contasAtivas[usuario]) contasAtivas[usuario].conectado = false;
  });

  res.json({ mensagem: `Conexão iniciada. Acompanhe a resposta crua nos logs do Render.` });
});

const PORT = process.env.PORT || 10000;
http.createServer(app).listen(PORT, () => {
  console.log(`[SERVIDOR] Ativo na porta ${PORT}`);
});
