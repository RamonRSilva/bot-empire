const express = require('express');
const http = require('http');
const net = require('net');
const path = require('path');
const crypto = require('crypto'); // Biblioteca nativa do Node.js para MD5

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const contasAtivas = {};

const TARGET_HOST = 'e4k-live-mz-cn1-hant1-game.goodgamestudios.com';
const TARGET_PORT = 443;

app.get('/ping', (req, res) => {
  res.status(200).send('Bot Empire Online & Active');
});

app.get('/', (req, res) => {
  res.status(200).send('Servidor do Bot Empire Four Kingdoms a funcionar corretamente.');
});

function processarMensagem(resposta, socket, user, passMd5, faseState) {
  console.log(`[RESPOSTA BRUTA - ${user}]:`, resposta);

  if (faseState.fase === 1 && resposta.includes('apiOK')) {
    faseState.fase = 2;
    console.log(`[PASSO 2] apiOK confirmado! Enviando credenciais com hash MD5 para ${user}...`);
    
    // 1. Enviar login XML com a senha em MD5
    const xmlLogin = `<msg t="sys"><body action="login" r="0"><login z="e4k-live-mz-cn1-hant1"><body u="${user}" p="${passMd5}" /></login></body></msg>\x00`;
    socket.write(xmlLogin);

    // 2. Enviar extensão XT de autenticação com a senha em MD5
    setTimeout(() => {
      const xtLogin = `%xt%e4k-live-mz-cn1-hant1%login%1%${user}%${passMd5}%\x00`;
      socket.write(xtLogin);
      console.log(`[PASSO 2.1] Pacote XT de login MD5 enviado. Aguardando validação...`);
    }, 500);

    return;
  }

  if (faseState.fase === 2) {
    if (resposta.includes('logOK') || resposta.includes('loginOK') || resposta.includes('action="logOK"')) {
      faseState.fase = 3;
      console.log(`[SUCESSO] Login autenticado com êxito para ${user}!`);
      
      setTimeout(() => {
        const joinGame = `%xt%e4k-live-mz-cn1-hant1%cmd%1%{"cmd":"k","param":{}}%\x00`;
        socket.write(joinGame);
        console.log(`[PASSO 3] Comando de sincronização enviado.`);
      }, 1000);

    } else if (resposta.includes('logKO') || resposta.includes('error') || resposta.includes('ko') || resposta.includes('action="logKO"')) {
      console.error(`[FALHA DE AUTENTICAÇÃO] O servidor rejeitou as credenciais para ${user}. Resposta:`, resposta);
    }
  }

  if (faseState.fase === 3) {
    if (resposta.includes('%xt%')) {
      console.log(`[DADOS DO JOGO - ${user}] Pacote XT capturado com sucesso.`);
    }
  }
}

app.post('/api/conectar', (req, res) => {
  const { usuario, senha, mundo } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ erro: 'Nome do jogador e Senha são obrigatórios.' });
  }

  // Converter a senha para hash MD5 (padrão exigido por muitos servidores SFS)
  const senhaMd5 = crypto.createHash('md5').update(senha).digest('hex');

  console.log(`[TCP SOCK] A preparar nova conexão para ${usuario}...`);

  if (contasAtivas[usuario]) {
    if (contasAtivas[usuario].socket) {
      try {
        contasAtivas[usuario].socket.destroy();
      } catch (e) {}
    }
    delete contasAtivas[usuario];
  }

  const client = new net.Socket();
  const faseState = { fase: 0 };
  let bufferAcumulado = '';

  client.setKeepAlive(true, 10000);

  client.connect(TARGET_PORT, TARGET_HOST, () => {
    console.log(`[TCP CONECTADO] Socket limpo e ativo com ${TARGET_HOST}:${TARGET_PORT}`);
    contasAtivas[usuario] = { usuario, mundo, conectado: true, socket: client };

    faseState.fase = 1;
    const xmlHandshake = '<msg t="sys"><body action="verChk" r="0"><ver v="166" /></body></msg>\x00';
    client.write(xmlHandshake);
    console.log(`[PASSO 1] Handshake verChk enviado.`);
  });

  client.on('data', (data) => {
    bufferAcumulado += data.toString('utf-8');

    let index = bufferAcumulado.indexOf('\x00');
    while (index !== -1) {
      const mensagem = bufferAcumulado.substring(0, index);
      bufferAcumulado = bufferAcumulado.substring(index + 1);

      if (mensagem.trim().length > 0) {
        processarMensagem(mensagem, client, usuario, senhaMd5, faseState);
      }
      index = bufferAcumulado.indexOf('\x00');
    }
  });

  client.on('error', (err) => {
    console.error(`[ERRO TCP - ${usuario}]:`, err.message);
  });

  client.on('close', () => {
    console.log(`[SOCKET FECHADO - ${usuario}] Conexão limpa e encerrada.`);
    if (contasAtivas[usuario]) contasAtivas[usuario].conectado = false;
  });

  res.json({ mensagem: `Conexão iniciada com sucesso para ${usuario}.` });
});

app.post('/api/desconectar', (req, res) => {
  const { usuario } = req.body;

  if (!usuario || !contasAtivas[usuario]) {
    return res.status(404).json({ erro: 'Nenhuma conexão ativa encontrada para este utilizador.' });
  }

  console.log(`[TCP SOCK] A encerrar conexão a pedido do painel para ${usuario}...`);

  if (contasAtivas[usuario].socket) {
    try {
      contasAtivas[usuario].socket.destroy();
    } catch (e) {}
  }
  delete contasAtivas[usuario];

  res.json({ mensagem: `Bot desconectado com sucesso para ${usuario}.` });
});

const PORT = process.env.PORT || 10000;
http.createServer(app).listen(PORT, () => {
  console.log(`[SERVIDOR] Ativo na porta ${PORT}`);
});
