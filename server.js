const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const contasAtivas = {};

// Endpoint WebSocket do servidor HANT1
const ENDPOINT_HANT1 = 'wss://52.77.8.40:443'; 

app.post('/api/conectar', (req, res) => {
  const { id, usuario, senha, mundo, automacoes } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ erro: 'Nome do jogador e Senha são obrigatórios.' });
  }

  console.log(`[LOGIN] Iniciando conexão para ${usuario} no mundo ${mundo || 'HANT1'}...`);

  // Bypass na verificação estrita de certificado SSL do servidor do jogo
  const ws = new WebSocket(ENDPOINT_HANT1, {
    rejectUnauthorized: false
  });

  contasAtivas[usuario] = { usuario, mundo, conectado: false, ws };

  ws.on('open', () => {
    console.log(`[WS HANT1] Conexão TLS estabelecida para ${usuario}!`);
    contasAtivas[usuario].conectado = true;
    
    const payloadLogin = {
      cmd: 'login',
      user: usuario,
      pass: senha,
      world: mundo || 'HANT1'
    };

    ws.send(JSON.stringify(payloadLogin));
  });

  ws.on('message', (data) => {
    console.log(`[RESPOSTA JOGO - ${usuario}]:`, data.toString());
  });

  ws.on('error', (err) => {
    console.error(`[ERRO WS - ${usuario}]:`, err.message);
  });

  ws.on('close', () => {
    console.log(`[WS HANT1 - ${usuario}] Conexão encerrada.`);
    if (contasAtivas[usuario]) contasAtivas[usuario].conectado = false;
  });

  res.json({ mensagem: `Tentativa de conexão enviada com bypass TLS para ${usuario}.` });
});

const PORT = process.env.PORT || 10000;
http.createServer(app).listen(PORT, () => {
  console.log(`[SERVIDOR] Executando na porta ${PORT}`);
});
