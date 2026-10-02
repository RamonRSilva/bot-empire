const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.json());

// Serve o painel HTML estático a partir da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Estrutura para armazenar as conexões ativas de cada conta
const contasAtivas = {};

// Rota de API para conectar uma nova conta ao WebSocket do jogo
app.post('/api/conectar', (req, res) => {
  const { id, token } = req.body;

  if (!id) {
    return res.status(400).json({ erro: 'ID da conta é obrigatório.' });
  }

  if (contasAtivas[id] && contasAtivas[id].ws) {
    contasAtivas[id].ws.close();
  }

  console.log(`[PAINEL] Iniciando conexão para a conta: ${id}`);
  
  const wsUrl = 'wss://52.77.8.40:443';
  const ws = new WebSocket(wsUrl);

  contasAtivas[id] = {
    id: id,
    conectado: false,
    ws: ws
  };

  ws.on('open', () => {
    console.log(`[WS - ${id}] Conectado com sucesso ao servidor do jogo!`);
    contasAtivas[id].conectado = true;
    if (token) {
      ws.send(JSON.stringify({ acao: 'login', payload: token }));
    }
  });

  ws.on('message', (data) => {
    console.log(`[WS - ${id}]:`, data.toString());
  });

  ws.on('error', (err) => {
    console.error(`[WS - ${id} ERRO]:`, err.message);
  });

  ws.on('close', () => {
    console.log(`[WS - ${id}] Conexão encerrada.`);
    if (contasAtivas[id]) {
      contasAtivas[id].conectado = false;
    }
  });

  res.json({ mensagem: `Processo de conexão iniciado para ${id}` });
});

// Rota de API para listar o status das contas
app.get('/api/contas', (req, res) => {
  const lista = {};
  for (let id in contasAtivas) {
    lista[id] = {
      id: id,
      conectado: contasAtivas[id].conectado
    };
  }
  res.json(lista);
});

// Criar o servidor HTTP unificado (Satisfaz o Health Check do Render e serve o Painel Web)
const PORT = process.env.PORT || 10000;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`[SISTEMA] Servidor e Painel Web rodando na porta ${PORT}`);
});
