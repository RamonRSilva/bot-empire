const WebSocket = require('ws');

// Endereço do servidor capturado no PCAPdroid
const SERVER_URL = 'wss://52.77.8.40:443';

class CloudEmpireBot {
  constructor() {
    this.ws = null;
    this.pingInterval = null;
  }

  start() {
    console.log('[NUVEM] Conectando aos servidores do jogo...');
    this.ws = new WebSocket(SERVER_URL);

    this.ws.on('open', () => {
      console.log('[NUVEM] Conexão estabelecida. Enviando verChk...');
      // Passo 1: Verificação de versão do cliente
      this.send("<msg t='sys'><body action='verChk' r='0'><ver v='166' /></body></msg>");
    });

    this.ws.on('message', (data) => {
      this.handleMessage(data.toString());
    });

    this.ws.on('close', () => {
      console.log('[NUVEM] Conexão encerrada. Reconectando em 15 segundos...');
      clearInterval(this.pingInterval);
      setTimeout(() => this.start(), 15000);
    });

    this.ws.on('error', (err) => {
      console.error('[NUVEM] Erro de conexão:', err.message);
    });
  }

  handleMessage(msg) {
    // Passo 2: Resposta de confirmação de versão aceita
    if (msg.includes("action='apiOK'")) {
      console.log('[NUVEM] Versão aceita. Enviando pacote de login...');
      
      // Cole aqui o seu pacote de login capturado se precisar atualizar
      const loginPacket = "<msg t='sys'><body action='login' r='0'><login z='EmpirefourkingdomsExGG_30'><nick><![CDATA[]]></nick><pword><![CDATA[1789054010648%pt%0]]></pword></login></body></msg>";
      this.send(loginPacket);
    }

    // Passo 3: Dados de entrada no mundo recebidos
    if (msg.includes("XML_E4K")) {
      console.log('[NUVEM] Login aprovado! Entrando na sala (autoJoin)...');
      this.send("<msg t='sys'><body action='autoJoin' r='-1'></body></msg>");
    }

    // Passo 4: Confirmação de entrada na sala principal
    if (msg.includes("action='joinOK'")) {
      console.log('[NUVEM] Bot online e sincronizado com sucesso!');
      this.startHeartbeat();
    }
  }

  // Envia ping periódico para manter a conexão ativa (Keep-Alive)
  startHeartbeat() {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send("<msg t='sys'><body action='roundTrip' r='1'></body></msg>");
      }
    }, 30000);
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }
}

// Inicia a execução do bot
const bot = new CloudEmpireBot();
bot.start();
