const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const salas = {};

// As 16 combinações de Trilha
const COMBINACOES_TRILHA = [
  ['A0', 'A1', 'A2'], ['A2', 'A3', 'A4'], ['A4', 'A5', 'A6'], ['A6', 'A7', 'A0'],
  ['B0', 'B1', 'B2'], ['B2', 'B3', 'B4'], ['B4', 'B5', 'B6'], ['B6', 'B7', 'B0'],
  ['C0', 'C1', 'C2'], ['C2', 'C3', 'C4'], ['C4', 'C5', 'C6'], ['C6', 'C7', 'C0'],
  ['A1', 'B1', 'C1'], ['A3', 'B3', 'C3'], ['A5', 'B5', 'C5'], ['A7', 'B7', 'C7']
];

// Conexões pelas linhas
const VIZINHOS = {
  'A0': ['A1', 'A7'],         'A1': ['A0', 'A2', 'B1'],   'A2': ['A1', 'A3'],
  'A3': ['A2', 'A4', 'B3'],   'A4': ['A3', 'A5'],         'A5': ['A4', 'A6', 'B5'],
  'A6': ['A5', 'A7'],         'A7': ['A6', 'A0', 'B7'],

  'B0': ['B1', 'B7'],         'B1': ['B0', 'B2', 'A1', 'C1'], 'B2': ['B1', 'B3'],
  'B3': ['B2', 'B4', 'A3', 'C3'], 'B4': ['B3', 'B5'],     'B5': ['B4', 'B6', 'A5', 'C5'],
  'B6': ['B5', 'B7'],         'B7': ['B6', 'B0', 'A7', 'C7'],

  'C0': ['C1', 'C7'],         'C1': ['C0', 'C2', 'B1'],   'C2': ['C1', 'C3'],
  'C3': ['C2', 'C4', 'B3'],   'C4': ['C3', 'C5'],         'C5': ['C4', 'C6', 'B5'],
  'C6': ['C5', 'C7'],         'C7': ['C6', 'C0', 'B7']
};

function gerarCodigoSala() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function formouTrilha(tabuleiro, pontoId, jogador) {
  return COMBINACOES_TRILHA.some(comb => {
    if (comb.includes(pontoId)) {
      return comb.every(p => tabuleiro[p] === jogador);
    }
    return false;
  });
}

// Conta quantas peças um jogador tem no tabuleiro
function contarPecas(tabuleiro, jogador) {
  return Object.values(tabuleiro).filter(p => p === jogador).length;
}

io.on('connection', (socket) => {
  socket.on('criarSala', () => {
    const salaId = gerarCodigoSala();
    salas[salaId] = {
      jogadores: [socket.id],
      tabuleiro: {},
      turno: 'brancas',
      pecasParaColocar: { brancas: 9, pretas: 9 },
      pecaSelecionada: null,
      aguardandoRemocao: false,
      vencedor: null
    };
    socket.join(salaId);
    socket.emit('salaCriada', { salaId, jogador: 'brancas' });
  });

  socket.on('entrarSala', (salaId) => {
    const sala = salas[salaId];
    if (!sala) return socket.emit('erro', 'Sala não encontrada!');
    if (sala.jogadores.length >= 2) return socket.emit('erro', 'Sala cheia!');

    sala.jogadores.push(socket.id);
    socket.join(salaId);
    socket.emit('salaEntrou', { salaId, jogador: 'pretas' });

    io.to(salaId).emit('atualizarTabuleiro', {
      tabuleiro: sala.tabuleiro,
      turno: sala.turno,
      fase: 'COLOCACAO',
      pecaSelecionada: null,
      mensagem: `Partida iniciada! Fase de Colocação (Brancas: 9 | Pretas: 9)`
    });
  });

  socket.on('jogada', ({ salaId, pontoId, jogador }) => {
    const sala = salas[salaId];
    if (!sala || sala.vencedor) return;

    if (sala.turno !== jogador) {
      return socket.emit('erro', 'Aguarde a sua vez de jogar!');
    }

    // --- FASE DE REMOÇÃO DE PEÇA ---
    if (sala.aguardandoRemocao) {
      const oponente = jogador === 'brancas' ? 'pretas' : 'brancas';
      if (sala.tabuleiro[pontoId] === oponente) {
        delete sala.tabuleiro[pontoId];
        sala.aguardandoRemocao = false;

        const pecasOponente = contarPecas(sala.tabuleiro, oponente);
        const emColocacao = sala.pecasParaColocar.brancas > 0 || sala.pecasParaColocar.pretas > 0;

        // VERIFICAÇÃO DE VITÓRIA (Oponente ficou com menos de 3 peças após a fase de colocação)
        if (!emColocacao && pecasOponente < 3) {
          sala.vencedor = jogador;
          io.to(salaId).emit('atualizarTabuleiro', {
            tabuleiro: sala.tabuleiro,
            vencedor: jogador,
            mensagem: `🏆 FIM DE JOGO! O Jogador (${jogador.toUpperCase()}) VENCEU A PARTIDA! 🎉`
          });
          return;
        }

        sala.turno = oponente;
        const faseAtual = emColocacao ? 'COLOCACAO' : 'MOVIMENTACAO';
        
        io.to(salaId).emit('atualizarTabuleiro', {
          tabuleiro: sala.tabuleiro,
          turno: sala.turno,
          fase: faseAtual,
          pecaSelecionada: null,
          mensagem: `Peça removida! Vez das: ${sala.turno.toUpperCase()}`
        });
      } else {
        socket.emit('erro', 'Clique em uma peça do adversário para removê-la!');
      }
      return;
    }

    // --- FASE 1: COLOCAÇÃO DE PEÇAS ---
    if (sala.pecasParaColocar[jogador] > 0) {
      if (!sala.tabuleiro[pontoId]) {
        sala.tabuleiro[pontoId] = jogador;
        sala.pecasParaColocar[jogador]--;

        if (formouTrilha(sala.tabuleiro, pontoId, jogador)) {
          sala.aguardandoRemocao = true;
          io.to(salaId).emit('atualizarTabuleiro', {
            tabuleiro: sala.tabuleiro,
            turno: sala.turno,
            fase: 'COLOCACAO',
            pecaSelecionada: null,
            mensagem: `TRILHA FORMADA! Escolha uma peça do adversário para remover!`
          });
        } else {
          sala.turno = jogador === 'brancas' ? 'pretas' : 'brancas';
          const proximaFase = (sala.pecasParaColocar.brancas > 0 || sala.pecasParaColocar.pretas > 0) ? 'COLOCACAO' : 'MOVIMENTACAO';
          io.to(salaId).emit('atualizarTabuleiro', {
            tabuleiro: sala.tabuleiro,
            turno: sala.turno,
            fase: proximaFase,
            pecaSelecionada: null,
            mensagem: proximaFase === 'MOVIMENTACAO' 
              ? `Todas as peças foram colocadas! FASE DE MOVIMENTAÇÃO. Vez das: ${sala.turno.toUpperCase()}`
              : `Vez das: ${sala.turno.toUpperCase()} (Restantes - B:${sala.pecasParaColocar.brancas} P:${sala.pecasParaColocar.pretas})`
          });
        }
      }
      return;
    }

    // --- FASES 2 E 3: MOVIMENTAÇÃO E VOO ---
    const pecasJogador = contarPecas(sala.tabuleiro, jogador);
    const podeVoar = pecasJogador === 3;

    // Seleção de Peça Própria
    if (sala.tabuleiro[pontoId] === jogador) {
      sala.pecaSelecionada = pontoId;
      const modoTexto = podeVoar ? "🕊️ MODO VOO ATIVO! Pule para QUALQUER casa vaga.";
      io.to(salaId).emit('atualizarTabuleiro', {
        tabuleiro: sala.tabuleiro,
        turno: sala.turno,
        fase: 'MOVIMENTACAO',
        pecaSelecionada: sala.pecaSelecionada,
        mensagem: `Peça em ${pontoId} selecionada. ${modoTexto}`
      });
      return;
    }

    // Execução da Jogada
    if (sala.pecaSelecionada && !sala.tabuleiro[pontoId]) {
      const orig = sala.pecaSelecionada;
      const movimentoValido = podeVoar || VIZINHOS[orig].includes(pontoId);

      if (movimentoValido) {
        delete sala.tabuleiro[orig];
        sala.tabuleiro[pontoId] = jogador;
        sala.pecaSelecionada = null;

        if (formouTrilha(sala.tabuleiro, pontoId, jogador)) {
          sala.aguardandoRemocao = true;
          io.to(salaId).emit('atualizarTabuleiro', {
            tabuleiro: sala.tabuleiro,
            turno: sala.turno,
            fase: 'MOVIMENTACAO',
            pecaSelecionada: null,
            mensagem: `TRILHA FORMADA! Remova uma peça do adversário!`
          });
        } else {
          sala.turno = jogador === 'brancas' ? 'pretas' : 'brancas';
          io.to(salaId).emit('atualizarTabuleiro', {
            tabuleiro: sala.tabuleiro,
            turno: sala.turno,
            fase: 'MOVIMENTACAO',
            pecaSelecionada: null,
            mensagem: `Peça movida de ${orig} para ${pontoId}. Vez das: ${sala.turno.toUpperCase()}`
          });
        }
      } else {
        socket.emit('erro', 'Movimento inválido!');
      }
    }
  });

  socket.on('reiniciarPartida', (salaId) => {
    const sala = salas[salaId];
    if (sala) {
      sala.tabuleiro = {};
      sala.turno = 'brancas';
      sala.pecasParaColocar = { brancas: 9, pretas: 9 };
      sala.pecaSelecionada = null;
      sala.aguardandoRemocao = false;
      sala.vencedor = null;
      io.to(salaId).emit('atualizarTabuleiro', {
        tabuleiro: sala.tabuleiro,
        turno: sala.turno,
        fase: 'COLOCACAO',
        pecaSelecionada: null,
        mensagem: 'Iniciado! Fase de Colocação (Vez das BRANCAS).'
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
