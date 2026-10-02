const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Estado das contas conectadas
const contasAtivas = {};

// Endpoint WebSocket do servidor HANT1 (Chinês Tradicional)
const ENDPOINT_HANT1 = 'wss://52.77.8.40:443'; 

app.post('/api/conectar', (req, res) => {
  const { id, usuario, token, automacoes } = req.body;

  if (!id || !usuario) {
    return res.status(400).json({ erro: 'ID e Usuário são obrigatórios.' });
  }

  // Desconectar sessão anterior se já existir
  if (contasAtivas[id] && contasAtivas[id].ws) {
    clearInterval(contasAtivas[id].timerLoop);
    contasAtivas[id].ws.close();
  }

  console.log(`[HANT1] Iniciando conexão para a conta: ${id} (${usuario})`);

  const ws = new WebSocket(ENDPOINT_HANT1);

  contasAtivas[id] = {
    id,
    servidor: 'HANT1',
    usuario,
    conectado: false,
    ws,
    automacoes: automacoes || { recrutamento: true, baroes: true, producao: true },
    timerLoop: null
  };

  ws.on('open', () => {
    console.log(`[WS - HANT1 - ${id}] Conectado ao servidor HANT1!`);
    contasAtivas[id].conectado = true;

    // Payload de login padrão para o servidor HANT1
    const payloadLogin = {
      cmd: 'login',
      zone: 'HANT1',
      lang: 'zh_TW',
      user: usuario,
      sessionKey: token
    };

    ws.send(JSON.stringify(payloadLogin));

    // Loop de Automação (Executa as tarefas a cada 5 minutos)
    contasAtivas[id].timerLoop = setInterval(() => {
      executarAutomacaoHANT1(contasAtivas[id]);
    }, 5 * 60 * 1000);
  });

  ws.on('message', (data) => {
    console.log(`[JOGO HANT1 - ${id}]:`, data.toString());
  });

  ws.on('error', (err) => {
    console.error(`[WS HANT1 ERRO - ${id}]:`, err.message);
  });

  ws.on('close', () => {
    console.log(`[WS HANT1 - ${id}] Conexão fechada.`);
    if (contasAtivas[id]) {
      contasAtivas[id].conectado = false;
      clearInterval(contasAtivas[id].timerLoop);
    }
  });

  res.json({ mensagem: `Conexão iniciada no servidor HANT1 para ${id}` });
});

function executarAutomacaoHANT1(conta) {
  if (!conta.conectado || !conta.ws) return;

  console.log(`[AUTOMAÇÃO HANT1 - ${conta.id}] Executando rotinas...`);

  if (conta.automacoes.recrutamento) {
    conta.ws.send(JSON.stringify({ cmd: 'recrutar', zone: 'HANT1' }));
  }
  if (conta.automacoes.baroes) {
    conta.ws.send(JSON.stringify({ cmd: 'atacar_barao', zone: 'HANT1' }));
  }
  if (conta.automacoes.producao) {
    conta.ws.send(JSON.stringify({ cmd: 'produzir', zone: 'HANT1' }));
  }
}

app.get('/api/contas', (req, res) => {
  const lista = {};
  for (let id in contasAtivas) {
    lista[id] = {
      id: contasAtivas[id].id,
      servidor: 'HANT1',
      conectado: contasAtivas[id].conectado,
      automacoes: contasAtivas[id].automacoes
    };
  }
  res.json(lista);
});

const PORT = process.env.PORT || 10000;
http.createServer(app).listen(PORT, () => {
  console.log(`[SISTEMA] Servidor E4K HANT1 rodando na porta ${PORT}`);
});
