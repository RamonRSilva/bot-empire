const express = require('express');
const http = require('http');
const net = require('net');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const contasAtivas = {};

// Host e Porta identificados na captura PCAPdroid para o servidor HANT1
const TARGET_HOST = 'e4k-live-mz-cn1-hant1-game.goodgamestudios.com';
const TARGET_PORT = 443;

app.post('/api/conectar', (req, res) => {
  const { usuario, senha, mundo } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ erro: 'Nome do jogador e Senha são obrigatórios.' });
  }

  console.log(`[SISTEMA] Iniciando fluxo de conexão TCP para ${usuario} no servidor ${mundo || 'HANT1'}...`);

  // Encerrar conexão anterior se existir
  if (contasAtivas[usuario] && contasAtivas[usuario].socket) {
    contasAtivas[usuario].socket.destroy();
  }

  const client = new net.Socket();
  let faseLogin = 0; // 0: Inicial, 1: Handshake enviado, 2: Login enviado

  client.connect(TARGET_PORT, TARGET_HOST, () => {
    console.log(`[TCP CONECTADO] Socket estabelecido com ${TARGET_HOST}:${TARGET_PORT}`);
    contasAtivas[usuario] = { usuario, mundo, conectado: true, socket: client };

    // Passo 1: Enviar Handshake XML do SmartFoxServer com delimitador NUL
    faseLogin = 1;
    const xmlHandshake = '<msg t="sys"><body action="verChk" r="0"><ver v="166" /></body></msg>\x00';
    client.write(xmlHandshake);
    console.log(`[PASSO 1] Handshake verChk enviado com sucesso.`);
  });

  client.on('data', (data) => {
    const resposta = data.toString();
    console.log(`[RESPOSTA JOGO - ${usuario}]:`, resposta);

    // Passo 2: Servidor respondeu apiOK -> Enviar payload de login
    if (faseLogin === 1 && resposta.includes('apiOK')) {
      faseLogin = 2;
      console.log(`[PASSO 2] Servidor retornou apiOK! Enviando credenciais de autenticação...`);
      
      // Estrutura de login em formato XML com zone do servidor
      const xmlLogin = `<msg t="sys"><body action="login" r="0"><login z="e4k-live-mz-cn1-hant1"><body u="${usuario}" p="${senha}" /></login></body></msg>\x00`;
      client.write(xmlLogin);
      console.log(`[PASSO 2] Payload de login enviado para ${usuario}.`);
    } else if (faseLogin === 2) {
      console.log(`[PASSO 3] Resposta de autenticação recebida para ${usuario}.`);
    }
  });

  client.on('error', (err) => {
    console.error(`[ERRO TCP - ${usuario}]:`, err.message);
  });

  client.on('close', () => {
    console.log(`[SOCKET FECHADO - ${usuario}] Conexão com o servidor do jogo encerrada.`);
    if (contasAtivas[usuario]) contasAtivas[usuario].conectado = false;
  });

  res.json({ mensagem: `Fluxo de autenticação TCP iniciado. Acompanhe as respostas detalhadas nos logs do Render.` });
});

const PORT = process.env.PORT || 10000;
http.createServer(app).listen(PORT, () => {
  console.log(`[SERVIDOR] Ativo na porta ${PORT}`);
});
