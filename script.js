// Conexão Socket.IO com o servidor local/remoto
const socket = io();

// Elementos do DOM
const tabuleiroEl = document.getElementById('tabuleiro');
const mensagemEl = document.getElementById('mensagem');
const btnCriarSala = document.getElementById('btn-criar-sala');
const btnEntrarSala = document.getElementById('btn-entrar-sala');
const inputSala = document.getElementById('input-sala');
const btnReiniciar = document.getElementById('btn-reiniciar');

const controlesInicioEl = document.getElementById('controles-inicio');
const infoSalaAtivaEl = document.getElementById('info-sala-ativa');
const textoCodigoSalaEl = document.getElementById('texto-codigo-sala');

// Mapeamento dos 24 pontos do tabuleiro de Trilha
const posicoesPontos = {
  // Quadrado Externo
  'A0': { top: '5%', left: '5%' },   'A1': { top: '5%', left: '50%' },  'A2': { top: '5%', left: '95%' },
  'A3': { top: '50%', left: '95%' }, 'A4': { top: '95%', left: '95%' }, 'A5': { top: '95%', left: '50%' },
  'A6': { top: '95%', left: '5%' },  'A7': { top: '50%', left: '5%' },

  // Quadrado Médio
  'B0': { top: '20%', left: '20%' }, 'B1': { top: '20%', left: '50%' }, 'B2': { top: '20%', left: '80%' },
  'B3': { top: '50%', left: '80%' }, 'B4': { top: '80%', left: '80%' }, 'B5': { top: '80%', left: '50%' },
  'B6': { top: '80%', left: '20%' }, 'B7': { top: '50%', left: '20%' },

  // Quadrado Interno
  'C0': { top: '35%', left: '35%' }, 'C1': { top: '35%', left: '50%' }, 'C2': { top: '35%', left: '65%' },
  'C3': { top: '50%', left: '65%' }, 'C4': { top: '65%', left: '65%' }, 'C5': { top: '65%', left: '50%' },
  'C6': { top: '65%', left: '35%' }, 'C7': { top: '50%', left: '35%' }
};

let codigoSalaAtual = null;
let meuJogador = null; // 'brancas' ou 'pretas'

// Desenhar Linhas e Pontos do Tabuleiro
function desenharTabuleiro() {
  tabuleiroEl.innerHTML = '';

  // SVG para desenhar as linhas conectando as casas
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.style.position = "absolute";
  svg.style.top = "0";
  svg.style.left = "0";

  // Linhas dos três quadrados e conexões
  const linhas = [
    // Quadrados (A, B, C)
    ['A0', 'A2'], ['A2', 'A4'], ['A4', 'A6'], ['A6', 'A0'],
    ['B0', 'B2'], ['B2', 'B4'], ['B4', 'B6'], ['B6', 'B0'],
    ['C0', 'C2'], ['C2', 'C4'], ['C4', 'C6'], ['C6', 'C0'],
    // Linhas transversais de conexão
    ['A1', 'C1'], ['A3', 'C3'], ['A5', 'C5'], ['A7', 'C7']
  ];

  linhas.forEach(([p1, p2]) => {
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", posicoesPontos[p1].left);
    line.setAttribute("y1", posicoesPontos[p1].top);
    line.setAttribute("x2", posicoesPontos[p2].left);
    line.setAttribute("y2", posicoesPontos[p2].top);
    line.setAttribute("stroke", "#475569");
    line.setAttribute("stroke-width", "4");
    svg.appendChild(line);
  });

  tabuleiroEl.appendChild(svg);

  // Criar os 24 pontos clicáveis
  Object.keys(posicoesPontos).forEach(id => {
    const ponto = document.createElement('div');
    ponto.classList.add('ponto');
    ponto.dataset.id = id;
    ponto.style.top = posicoesPontos[id].top;
    ponto.style.left = posicoesPontos[id].left;

    ponto.addEventListener('click', () => clicarPonto(id));
    tabuleiroEl.appendChild(ponto);
  });
}

// Clique no Ponto do Tabuleiro
function clicarPonto(pontoId) {
  if (!codigoSalaAtual) {
    mensagemEl.textContent = "Crie ou entre em uma sala primeiro!";
    return;
  }
  socket.emit('jogada', { salaId: codigoSalaAtual, pontoId: pontoId, jogador: meuJogador });
}

// --- EVENTOS DO PAINEL E SOCKET.IO ---

btnCriarSala.addEventListener('click', () => {
  socket.emit('criarSala');
});

btnEntrarSala.addEventListener('click', () => {
  const sala = inputSala.value.trim().toUpperCase();
  if (sala.length === 4) {
    socket.emit('entrarSala', sala);
  } else {
    mensagemEl.textContent = "Digite um código de 4 dígitos válido.";
  }
});

btnReiniciar.addEventListener('click', () => {
  if (codigoSalaAtual) {
    socket.emit('reiniciarPartida', codigoSalaAtual);
  }
});

// Respostas do Servidor
socket.on('salaCriada', (dados) => {
  codigoSalaAtual = dados.salaId || dados.codigo;
  meuJogador = dados.jogador || 'brancas';
  exibirSalaAtiva(codigoSalaAtual, meuJogador);
  mensagemEl.textContent = `Sala criada! Compartilhe o código ${codigoSalaAtual} com seu oponente.`;
});

socket.on('salaEntrou', (dados) => {
  codigoSalaAtual = dados.salaId || dados.codigo;
  meuJogador = dados.jogador || 'pretas';
  exibirSalaAtiva(codigoSalaAtual, meuJogador);
  mensagemEl.textContent = `Você entrou na sala ${codigoSalaAtual}. Bom jogo!`;
});

socket.on('atualizarTabuleiro', (estado) => {
  // Limpa o tabuleiro
  document.querySelectorAll('.ponto').forEach(ponto => {
    ponto.className = 'ponto';
  });

  // Desenha as peças
  Object.keys(estado.tabuleiro).forEach(id => {
    const pontoEl = document.querySelector(`[data-id="${id}"]`);
    if (pontoEl && estado.tabuleiro[id]) {
      pontoEl.classList.add(`peca-${estado.tabuleiro[id]}`);
    }
  });

  // Peça selecionada
  if (estado.pecaSelecionada) {
    const selecionadaEl = document.querySelector(`[data-id="${estado.pecaSelecionada}"]`);
    if (selecionadaEl) {
      selecionadaEl.classList.add('selecionada');
    }
  }

  // Se houver vencedor, aplica destaque e toca a musiquinha!
  if (estado.vencedor) {
    mensagemEl.className = 'mensagem vitoria';
    tocarMusicaVitoria(); // <--- TOCA A VINHETA TRIUNFAL AQUI!
  } else {
    mensagemEl.className = 'mensagem';
  }

  if (estado.mensagem) {
    mensagemEl.textContent = estado.mensagem;
  }
});

// Inicialização imediata do desenho
desenharTabuleiro();

// Função para tocar a vinheta triunfal de vitória via Web Audio API
function tocarMusicaVitoria() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  
  const ctx = new AudioContext();
  
  // Notas da vinheta triunfal (Frequência em Hz e Duração em segundos)
  const notas = [
    { freq: 523.25, dur: 0.15 }, // Dó (C5)
    { freq: 659.25, dur: 0.15 }, // Mi (E5)
    { freq: 783.99, dur: 0.15 }, // Sol (G5)
    { freq: 1046.50, dur: 0.45 } // Dó agudo (C6) - Nota longa de vitória
  ];

  let tempoInicio = ctx.currentTime;

  notas.forEach((nota) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle'; // Som suave e aveludado
    osc.frequency.setValueAtTime(nota.freq, tempoInicio);

    // Envelope de volume para evitar estalos
    gain.gain.setValueAtTime(0.3, tempoInicio);
    gain.gain.exponentialRampToValueAtTime(0.001, tempoInicio + nota.dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(tempoInicio);
    osc.stop(tempoInicio + nota.dur);

    tempoInicio += nota.dur; // Encadeia as notas em sequência
  });
}

function exibirSalaAtiva(codigo, jogador) {
  if (controlesInicioEl && infoSalaAtivaEl && textoCodigoSalaEl) {
    controlesInicioEl.classList.add('escondido');
    infoSalaAtivaEl.classList.remove('escondido');
    textoCodigoSalaEl.textContent = `SALA: ${codigo} | SUAS PEÇAS: ${jogador.toUpperCase()}`;
  }
}