const express = require('express');
const http = require('http');
const tls = require('tls');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const contasAtivas = {};

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

app.post('/api/conectar', (req, res) => {
  const { usuario, senha, mundo } = req.body;

  if (!usuario || !senha || !mundo) {
    return res.status(400).json({ erro: 'Preencha o utilizador, a senha e selecione o mundo.' });
  }

  const infoMundo = MUNDOS_MAP[mundo] || MUNDOS_MAP['cn1'];
  const senhaMd5 = crypto.createHash('md5').update(senha).digest('hex');

  console.log(`[AUDITORIA TLS] A iniciar diagnóstico completo para ${usuario} no mundo ${mundo}...`);

  if (contasAtivas[usuario]) {
    if (contasAtivas[usuario].socket) {
      try { contasAtivas[usuario].socket.destroy(); } catch (e) {}
    }
    delete contasAtivas[usuario];
  }

  const targetIP = infoMundo.ip || infoMundo.host;

  // Ligação TLS direta ao IP com SNI
  const client = tls.connect({
    host: targetIP,
    port: 443,
    servername: infoMundo.host,
    rejectUnauthorized: false
  }, () => {
    console.log(`[TLS CONECTADO] Canal seguro aberto com ${targetIP}:443. A aguardar dados do servidor...`);
    contasAtivas[usuario] = { usuario, mundo, conectado: true, socket: client };

    // Aguardar 1 segundo após a conexão segura para ver se o servidor envia algo espontaneamente
    setTimeout(() => {
      console.log(`[PASSO 1] A enviar handshake verChk...`);
      const xmlHandshake = '<msg t="sys"><body action="verChk" r="0"><ver v="166" /></body></msg>\x00';
      client.write(xmlHandshake);
    }, 1000);
  });

  client.on('data', (data) => {
    // Imprimir o formato bruto (Hexadecimal e Texto) de tudo o que o servidor envia
    console.log(`[DADOS RECEBIDOS - ${usuario}] Bytes (${data.length}):`, data.toString('hex'));
    console.log(`[DADOS RECEBIDOS - ${usuario}] Texto:`, data.toString('utf-8'));

    const respostaTexto = data.toString('utf-8');

    // Se o servidor responder com apiOK, enviamos o login de forma controlada
    if (respostaTexto.includes('apiOK')) {
      console.log(`[PASSO 2] apiOK detetado! A aguardar 1 segundo para enviar credenciais...`);
      setTimeout(() => {
        const xmlLogin = `<msg t="sys"><body action="login" r="0"><login z="${infoMundo.zona}"><body u="${usuario}" p="${senhaMd5}" /></login></body></msg>\x00`;
        client.write(xmlLogin);
        console.log(`[PASSO 2.1] Login XML enviado.`);
      }, 1000);

      setTimeout(() => {
        const xtLogin = `%xt%${infoMundo.zona}%login%1%${usuario}%${senhaMd5}%\x00`;
        client.write(xtLogin);
        console.log(`[PASSO 2.2] Pacote XT enviado.`);
      }, 1800);
    }
  });

  client.on('error', (err) => {
    console.error(`[ERRO TLS - ${usuario}]:`, err.message);
  });

  client.on('close', () => {
    console.log(`[SOCKET FECHADO - ${usuario}] O servidor encerrou a ligação.`);
    if (contasAtivas[usuario]) contasAtivas[usuario].conectado = false;
  });

  res.json({ mensagem: `Diagnóstico TLS iniciado para ${usuario}.` });
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
