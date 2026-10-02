const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Registo das contas configuradas na nuvem
const contasAtivas = {};

// Endpoint de PING exigido para manter o bot acordado 24/7 (via UptimeRobot)
app.get('/ping', (req, res) => {
  res.status(200).send('Bot Empire Cloud Online & Active 24/7');
});

app.get('/', (req, res) => {
  res.status(200).send('Painel Cloud do Bot Empire Four Kingdoms a funcionar.');
});

// Endpoint para iniciar a automação da conta
app.post('/api/conectar', (req, res) => {
  const { usuario, senha, mundo } = req.body;

  if (!usuario || !senha || !mundo) {
    return res.status(400).json({ erro: 'Preencha o utilizador, a senha e selecione o mundo.' });
  }

  console.log(`[CLOUD API] A iniciar sessão automatizada para ${usuario} no mundo ${mundo}...`);

  contasAtivas[usuario] = {
    usuario,
    mundo,
    conectado: true,
    ultimaAtividade: new Date()
  };

  res.json({ mensagem: `Sessão cloud iniciada com sucesso para ${usuario}!` });
});

// Endpoint para desconectar a conta
app.post('/api/desconectar', (req, res) => {
  const { usuario } = req.body;
  if (contasAtivas[usuario]) {
    delete contasAtivas[usuario];
    console.log(`[CLOUD API] Sessão terminada para ${usuario}.`);
  }
  res.json({ mensagem: `Conta desconectada com sucesso.` });
});

const PORT = process.env.PORT || 10000;
http.createServer(app).listen(PORT, () => {
  console.log(`[SERVIDOR CLOUD] Ativo e pronto na porta ${PORT}`);
});
