const express = require('express');
const http = require('http');
const net = require('net');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const contasAtivas = {};

// Mapeamento dos mundos e os seus respetivos hosts oficiais
const MUNDOS_MAP = {
  'cn1': { host: 'e4k-live-mz-cn1-hant1-game.goodgamestudios.com', ip: '52.77.8.40', zona: 'e4k-live-mz-cn1-hant1' },
  'int1': { host: 'e4k-live-int1-game.goodgamestudios.com', ip: null, zona: 'e4k-live-int1' },
  'us1': { host: 'e4k-live-us1-game.goodgamestudios.com', ip: null, zona: 'e4k-live-us1' }
};

app.get('/ping', (req, res) => {
  res.status(200).send('Bot Empire Online & Active');
});

app.get('/', (req, res) => {
  res.status(200).send('Servidor do Bot Empire Four Kingdoms a funcionar corretamente.');
});

function processarMensagem(resposta, socket, user, passMd5, zona, faseState) {
  console.log(`[RESPOSTA TCP - ${user}]:`, resposta);

  if (faseState.fase === 1 && (resposta.includes('apiOK') || resposta.includes('action="apiOK"'))) {
    faseState.fase = 2;
    console.log(`[PASSO 2] apiOK confirmado para ${zona}! A enviar credenciais MD5...`);
    
    // 1. Login XML com a zona dinâmica
    const xmlLogin = `<msg t="sys"><body action="login" r="0"><login z="${zona}"><body u="${user}" p="${passMd5}" /></login></body></msg>\x00`;
    socket.write(xmlLogin);

    // 2. Pacote de extensão XT de login
    setTimeout(() => {
      const xtLogin = `%xt%${zona}%login%1%${user}%${passMd5}%en%166%\x00`;
      socket.write(xtLogin);
      console.log(`[PASSO 2.1] Pacote XT enviado para a zona ${zona}.`);
    }, 600);

    return;
  }

  if (faseState.fase === 2) {
    if (resposta.includes('logOK') || resposta.includes('loginOK') || resposta.includes('%xt%login%0%') || resposta.includes('action="logOK"')) {
      faseState.fase = 3;
      console.log(`[SUCESSO] Login autenticado com êxito para ${user}!`);
      
      setTimeout(() => {
        const joinGame = `%xt%${zona}%cmd%1%{"cmd":"k","param":{}}%\x00`;
        socket.write(joinGame);
        console.log(`[PASSO 3] Comando de sincronização enviado.`);
      }, 1000);
    } else if (resposta.includes('logKO') || resposta.includes('error') || resposta.includes('ko')) {
      console.error(`[FALHA] O servidor rejeitou as credenciais para ${user}:`, resposta);
    }
  }
}

app.post('/api/conectar', (req, res) => {
  const { usuario, senha, mundo } = req.body;

  if (!usuario || !senha || !mundo) {
    return res.status(400).json({ erro: 'Preencha o utilizador, a senha e selecione o mundo.' });
  }

  const infoMundo = MUNDOS_MAP[mundo] || MUNDOS_MAP['cn1'];
  const senhaMd5 = crypto.createHash('md5').update(senha).digest('hex');

  console.log(`[TCP SOCK] A ligar ${usuario} ao mundo ${mundo} (${infoMundo.host})...`);

  if (contasAtivas[usuario]) {
    if (contasAtivas[usuario].socket) {
      try { contasAtivas[usuario].socket.destroy(); } catch (e) {}
    }
    delete contasAtivas[usuario];
  }

  const client = new net.Socket();
  const faseState = { fase: 0 };
  let bufferAcumulado = '';

  client.setKeepAlive(true, 10000);

  // Usa o IP direto se houver, senão resolve o hostname
  const targetDest = infoMundo.ip || infoMundo.host;

  client.connect(443, targetDest, () => {
    console.log(`[TCP CONECTADO] Ligado a ${targetDest}:443`);
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
        processarMensagem(mensagem, client, usuario, senhaMd5, infoMundo.zona, faseState);
      }
      index = bufferAcumulado.indexOf('\x00');
    }
  });

  client.on('error', (err) => {
    console.error(`[ERRO TCP - ${usuario}]:`, err.message);
  });

  client.on('close', () => {
    console.log(`[SOCKET FECHADO - ${usuario}] Ligação encerrada.`);
    if (contasAtivas[usuario]) contasAtivas[usuario].conectado = false;
  });

  res.json({ mensagem: `Ligação iniciada para ${usuario} no mundo ${mundo}.` });
});

app.post('/api/desconectar', (req, res) => {
  const { usuario } = req.body;
  if (contasAtivas[usuario]?.socket) {
    try { contasAtivas[usuario].socket.destroy(); } catch (e) {}
    delete contasAtivas[usuario];
  }
  res.json({ mensagem: `Desconectado com sucesso.` });
});

const PORT = process.env.PORT || 10000;
http.createServer(app).listen(PORT, () => {
  console.log(`[SERVIDOR] Ativo na porta ${PORT}`);
});
