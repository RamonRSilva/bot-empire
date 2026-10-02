const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const contasAtivas = {};

// Mapeamento de endpoints por Mundo
const ENDPOINTS_MUNDO = {
  'HANT1': 'wss://52.77.8.40:443',
  'BR1': 'wss://52.77.8.40:443'
};

app.post('/api/conectar', (req, res) => {
  const { id, usuario, senha, mundo, automacoes } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ erro: 'Nome do jogador e Senha são obrigatórios.' });
  }

  const endpoint = ENDPOINTS_MUNDO[mundo] || ENDPOINTS_MUNDO['HANT1'];
  console.log(`[LOGIN] Conectando ${usuario} no mundo ${mundo}...`);

  const ws = new WebSocket(endpoint);

  contasAtivas[usuario] = { usuario, mundo, conectado: false, ws };

  ws.on('open', () => {
    console.log(`[WS] Conectado ao servidor do mundo ${mundo}`);
    
    // Pacote de Login formatado com Nome do Jogador e Senha
    const payloadLogin = {
      cmd: 'login',
      user: usuario,
      pass: senha,
      world: mundo
    };

    ws.send(JSON.stringify(payloadLogin));
  });

  ws.on('message', (data) => {
    console.log(`[JOGO - ${usuario}]:`, data.toString());
  });

  ws.on('error', (err) => {
    console.error(`[ERRO - ${usuario}]:`, err.message);
  });

  res.json({ mensagem: `Dados de login enviados para o mundo ${mundo}. Verifique os logs.` });
});

const PORT = process.env.PORT || 10000;
http.createServer(app).listen(PORT, () => {
  console.log(`[SERVIDOR] Executando na porta ${PORT}`);
});
