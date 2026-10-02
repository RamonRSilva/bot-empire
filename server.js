const express = require('express');
const http = require('http');
const net = require('net');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const contasAtivas = {};

const TARGET_HOST = 'e4k-live-mz-cn1-hant1-game.goodgamestudios.com';
const TARGET_PORT = 443;

app.post('/api/conectar', (req, res) => {
  const { usuario, senha, mundo } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ erro: 'Nome do jogador e Senha são obrigatórios.' });
  }

  console.log(`[LOGIN TCP] Abrindo socket com ${TARGET_HOST}:${TARGET_PORT} para ${usuario}...`);

  const client = new net.Socket();

  client.connect(TARGET_PORT, TARGET_HOST, () => {
    console.log(`[TCP CONECTADO] Socket aberto com sucesso com o servidor HANT1!`);
    contasAtivas[usuario] = { usuario, mundo, conectado: true, socket: client };

    // Passo 1: Enviar Handshake XML inicial
    const xmlHandshake = '<msg t="sys"><body action="verChk" r="0"><ver v="166" /></body></msg>\x00';
    client.write(xmlHandshake);
    console.log(`[PASSO 1 ENVIADO] Handshake XML enviado.`);
  });

  client.on('data', (data) => {
    const resposta = data.toString();
    console.log(`[RESPOSTA JOGO - ${usuario}]:`, resposta);

    // Passo 2: Quando o servidor responder "apiOK", enviar os dados de autenticação do utilizador
    if (resposta.includes('apiOK')) {
      console.log(`[PASSO 2] Servidor confirmou apiOK! Enviando credenciais de login...`);
      
      // Pacote de login no protocolo do SmartFoxServer
      const xmlLogin = `<msg t="sys"><body action="login" r="0"><login z="empire" u="${usuario}" p="${senha}" /></body></msg>\x00`;
      client.write(xmlLogin);
      console.log(`[PASSO 2 ENVIADO] Credenciais enviadas para o jogador ${usuario}.`);
    }
  });

  client.on('error', (err) => {
    console.error(`[ERRO TCP - ${usuario}]:`, err.message);
  });

  client.on('close', () => {
    console.log(`[SOCKET FECHADO - ${usuario}]`);
    if (contasAtivas[usuario]) contasAtivas[usuario].conectado = false;
  });

  res.json({ mensagem: `Handshake TCP estabelecido. Acompanhe a autenticação nos logs do Render.` });
});

const PORT = process.env.PORT || 10000;
http.createServer(app).listen(PORT, () => {
  console.log(`[SERVIDOR] Ativo na porta ${PORT}`);
});
