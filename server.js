const http = require('http');
const WebSocket = require('ws');

// 1. Servidor HTTP para satisfazer a verificação de saúde do Render
const PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot ativo na nuvem!\n');
}).listen(PORT, () => {
  console.log(`[HTTP] Servidor de verificação ativo na porta ${PORT}`);
});

// 2. Conexão do Bot WebSocket
const wsUrl = 'wss://52.77.8.40:443';

function iniciarBot() {
  console.log('[NUVEM] Conectando aos servidores do jogo...');
  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    console.log('[NUVEM] Conexão WebSocket estabelecida com sucesso!');
  });

  ws.on('message', (data) => {
    console.log('[JOGO]:', data.toString());
  });

  ws.on('error', (err) => {
    console.error('[ERRO WS]:', err.message);
  });

  ws.on('close', () => {
    console.log('[NUVEM] Conexão encerrada. Reconectando em 10s...');
    setTimeout(iniciarBot, 10000);
  });
}

iniciarBot();
