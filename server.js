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

// Rota de Health-Check / Ping para manter o Render acordado
app.get('/ping', (req, res) => {
  res.status(200).send('Bot Empire Online & Active');
});

app.get('/', (req, res) => {
  res.status(200).send('Servidor do Bot Empire Four Kingdoms a funcionar corretamente.');
});

function processarMensagem(resposta, socket, user, pass, faseState) {
  console.log(`[RESPOSTA RECEBIDA - ${user}]:`, resposta);

  // Passo 1 -> Passo 2: Confirmar apiOK e enviar credenciais (XML + XT)
  if (faseState.fase === 1 && resposta.includes('apiOK')) {
    faseState.fase = 2;
    console.log(`[PASSO 2] apiOK confirmado! Enviando credenciais de login para ${user}...`);
    
    // 1. Enviar login XML do SmartFoxServer
    const xmlLogin = `<msg t="sys"><body action="login" r="0"><login z="e4k-live-mz-cn1-hant1"><body u="${user}" p="${pass}" /></login></body></msg>\x00`;
    socket.write(xmlLogin);

    // 2. Enviar o pacote de extensão XT exigido pelo Goodgame Studios
    setTimeout(() => {
      const xtLogin = `%xt%e4k-live-mz-cn1-hant1%login%1%${user}%${pass}%\x00`;
      socket.write(xtLogin);
      console.log(`[PASSO 2.1] Pacote de extensão XT de login enviado.`);
    }, 500);

    return;
  }

  // Passo 2 -> Passo 3: Tratar resposta de confirmação de login
  if (faseState.fase === 2) {
    if (resposta.includes('action="logOK"') || resposta.includes('logOK') || resposta.includes('%xt%login')) {
      faseState.fase = 3;
      console.log(`[PASSO 3] Login aceito pelo servidor para ${user}! Entrando no mundo do jogo...`);
      
      // Enviar comando de sincronização inicial após 1 segundo
      setTimeout(() => {
        const joinGame = `%xt%e4k-live-mz-cn1-hant1%cmd%1%{"cmd":"k","param":{}}%\x00`;
        socket.write(joinGame);
        console.log(`[PASSO 3.1] Comando de sincronização inicial enviado.`);
      }, 1000);

    } else if (resposta.includes('action="logKO"') || resposta.includes('error')) {
      console.error(`[ERRO DE LOGIN] Falha de autenticação para ${user}. Verifique o utilizador e a palavra-passe.`);
    }
  }

  // Passo 4: Monitorar pacotes de dados do jogo (%xt%) após o login completo
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

  console.log(`[TCP SOCK] Disparando conexão para ${usuario}...`);

  if (contasAtivas[usuario] && contasAtivas[usuario].socket) {
    contasAtivas[usuario].socket.destroy();
  }

  const client = new net.Socket();
  const faseState = { fase: 0 };
  let bufferAcumulado = '';

  client.setKeepAlive(true, 10000);

  client.connect(TARGET_PORT, TARGET_HOST, () => {
    console.log(`[TCP CONECTADO] Socket ativo com ${TARGET_HOST}:${TARGET_PORT}`);
    contasAtivas[usuario] = { usuario, mundo, conectado: true, socket: client };

    // Passo 1: Handshake verChk
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
        processarMensagem(mensagem, client, usuario, senha, faseState);
      }
      index = bufferAcumulado.indexOf('\x00');
    }
  });

  client.on('error', (err) => {
    console.error(`[ERRO TCP - ${usuario}]:`, err.message);
  });

  client.on('close', () => {
    console.log(`[SOCKET FECHADO - ${usuario}] Conexão encerrada.`);
    if (contasAtivas[usuario]) contasAtivas[usuario].conectado = false;
  });

  res.json({ mensagem: `Processo iniciado para ${usuario}. Acompanhe os logs no Render.` });
});

const PORT = process.env.PORT || 10000;
http.createServer(app).listen(PORT, () => {
  console.log(`[SERVIDOR] Ativo na porta ${PORT}`);
});
