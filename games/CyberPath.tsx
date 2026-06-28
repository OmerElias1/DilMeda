import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, PanResponder
} from 'react-native';
import { Zap, Trophy, ChevronRight, Clock } from 'lucide-react-native';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';

const { width: SW } = Dimensions.get('window');
const GRID_SIZE = 300;
const NODE_RADIUS = 24;
const PADDING = (SW - GRID_SIZE) / 2;

// 3x3 Grid Centers
const NODES = [
  { id: 0, x: 50, y: 50, label: '1' },
  { id: 1, x: 150, y: 50, label: '2' },
  { id: 2, x: 250, y: 50, label: '3' },
  { id: 3, x: 50, y: 150, label: '4' },
  { id: 4, x: 150, y: 150, label: '5' },
  { id: 5, x: 250, y: 150, label: '6' },
  { id: 6, x: 50, y: 250, label: '7' },
  { id: 7, x: 150, y: 250, label: '8' },
  { id: 8, x: 250, y: 250, label: '9' },
];

type Props = {
  onClose: () => void;
  onPlayAgain?: () => void;
};

export default function CyberPath({ onClose, onPlayAgain }: Props) {
  const { endGameSession } = useAuth();
  const { isExpired } = useTournament();

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);

  const [gameState, setGameState] = useState<'showing' | 'player'>('showing');
  const [targetPath, setTargetPath] = useState<number[]>([]);
  const [playerPath, setPlayerPath] = useState<number[]>([]);
  const [activeNode, setActiveNode] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoreRef = useRef(0);
  const pathLengthRef = useRef(3);

  // Generate a random path (no immediate back-tracks)
  const generatePath = (len: number) => {
    const path: number[] = [];
    let current = Math.floor(Math.random() * 9);
    path.push(current);

    for (let i = 1; i < len; i++) {
      const neighbors = getNeighbors(current);
      // Filter out immediate predecessor
      const valid = neighbors.filter((n) => n !== path[i - 2]);
      const nextNode = valid.length > 0 ? valid[Math.floor(Math.random() * valid.length)] : neighbors[Math.floor(Math.random() * neighbors.length)];
      path.push(nextNode);
      current = nextNode;
    }
    return path;
  };

  const getNeighbors = (id: number) => {
    const r = Math.floor(id / 3);
    const c = id % 3;
    const list = [];
    if (r > 0) list.push((r - 1) * 3 + c);
    if (r < 2) list.push((r + 1) * 3 + c);
    if (c > 0) list.push(r * 3 + (c - 1));
    if (c < 2) list.push(r * 3 + (c + 1));
    return list;
  };

  const playSequence = async (path: number[]) => {
    setGameState('showing');
    for (let i = 0; i < path.length; i++) {
      setActiveNode(path[i]);
      await sleep(400);
      setActiveNode(null);
      await sleep(150);
    }
    setGameState('player');
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const startNewRound = async (increaseDifficulty = false) => {
    if (increaseDifficulty) {
      pathLengthRef.current += 1;
    } else {
      pathLengthRef.current = 3;
    }
    const path = generatePath(pathLengthRef.current);
    setTargetPath(path);
    setPlayerPath([]);
    setActiveNode(null);
    await sleep(400);
    playSequence(path);
  };

  const startGame = () => {
    scoreRef.current = 0;
    setScore(0);
    setTimeLeft(30);
    pathLengthRef.current = 3;
    setPhase('playing');
    startNewRound(false);
  };

  // Game timer
  useEffect(() => {
    if (phase === 'playing') {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            finishGame();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  const finishGame = async () => {
    setPhase('done');
    await endGameSession(scoreRef.current);
  };

  // Touch tracking for grid tracing
  const handleTouch = (gridX: number, gridY: number) => {
    if (gameState !== 'player') return;

    // Find if touch is near any node (using container-relative coordinates)
    let closestNode: number | null = null;
    NODES.forEach((n) => {
      const dx = gridX - n.x;
      const dy = gridY - n.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < NODE_RADIUS + 25) { // Generous radius for easy tracing
        closestNode = n.id;
      }
    });

    if (closestNode !== null) {
      // Check if it's the next node in playerPath
      setPlayerPath((prev) => {
        // If it's already in the path, ignore unless it's the next step
        if (prev.includes(closestNode!)) {
          return prev;
        }

        const nextIndex = prev.length;
        if (targetPath[nextIndex] === closestNode) {
          const newPath = [...prev, closestNode!];
          setActiveNode(closestNode);

          if (newPath.length === targetPath.length) {
            // Path completely and correctly traced!
            scoreRef.current += targetPath.length * 15;
            setScore(scoreRef.current);
            setTimeout(() => {
              startNewRound(true);
            }, 300);
          }
          return newPath;
        } else {
          // Wrong node! Reset path.
          setActiveNode(null);
          return [];
        }
      });
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        handleTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
      },
      onPanResponderMove: (evt) => {
        handleTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
      },
      onPanResponderRelease: () => {
        setActiveNode(null);
      },
    })
  ).current;

  if (phase === 'done') {
    return (
      <View style={s.container}>
        <View style={s.resultCard}>
          <View style={s.trophyRing}>
            <Trophy color={colors.gold} size={40} fill={colors.gold} />
          </View>
          <Text style={s.resultTitle}>TIME'S UP!</Text>
          <Text style={s.resultScore}>{score}</Text>
          <Text style={s.resultLabel}>TOTAL SCORE</Text>
        </View>

        <TouchableOpacity style={s.startBtn} onPress={onPlayAgain || startGame}>
          <Text style={s.startBtnText}>PLAY AGAIN</Text>
          <ChevronRight color={colors.bgDeep} size={20} />
        </TouchableOpacity>
        <TouchableOpacity style={s.btnOutline} onPress={onClose}>
          <Text style={s.btnOutlineText}>Exit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'ready') {
    return (
      <View style={s.container}>
        <View style={s.titleRow}>
          <Zap color={colors.gold} size={24} fill={colors.gold} />
          <Text style={s.gameTitle}>CYBER PATH</Text>
          <Zap color={colors.gold} size={24} fill={colors.gold} />
        </View>

        <View style={s.infoCard}>
          <Text style={s.infoHeading}>How to Play</Text>
          <Text style={s.infoText}>Watch the path sequence flash on the grid.</Text>
          <Text style={s.infoText}>Swipe/drag over the nodes in the exact same order.</Text>
          <Text style={s.infoText}>Get points for correct traces. The paths get longer!</Text>
          <Text style={[s.infoText, { color: colors.neon, marginTop: 6 }]}>⚡ Train your memory and trace fast!</Text>
        </View>

        <TouchableOpacity style={s.startBtn} onPress={startGame}>
          <Text style={s.startBtnText}>START GAME</Text>
          <ChevronRight color={colors.bgDeep} size={20} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.playContainer}>
      {/* HUD */}
      <View style={s.hud}>
        <View style={s.hudLeft}>
          <Text style={s.hudTapNum}>{score}</Text>
          <Text style={s.hudTapLabel}>SCORE</Text>
        </View>

        <View style={s.timerPill}>
          <Clock color={colors.neon} size={14} />
          <Text style={s.timerText}>{timeLeft}s</Text>
        </View>
      </View>

      <Text style={s.statusText}>
        {gameState === 'showing' ? '👀 WATCH PATH...' : '👉 TRACE PATH!'}
      </Text>

      {/* Grid Container */}
      <View style={s.gridContainer} {...panResponder.panHandlers}>
        {NODES.map((node) => {
          const isActive = activeNode === node.id;
          const isTraced = playerPath.includes(node.id);

          return (
            <View
              key={node.id}
              pointerEvents="none"
              style={[
                s.node,
                {
                  left: node.x - NODE_RADIUS,
                  top: node.y - NODE_RADIUS,
                  backgroundColor: isActive
                    ? colors.neon
                    : isTraced
                    ? 'rgba(0, 255, 204, 0.4)'
                    : colors.bgCard,
                  borderColor: isActive || isTraced ? colors.neon : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  s.nodeText,
                  { color: isActive || isTraced ? colors.bgDeep : colors.textPrimary },
                ]}
              >
                {node.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: spacing.lg,
  },
  playContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gameTitle: { color: colors.gold, fontSize: 28, fontWeight: '900', letterSpacing: 4 },
  infoCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    alignItems: 'center',
    gap: 5,
  },
  infoHeading: { color: colors.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  infoText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gold,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: radius.full,
    ...shadow.gold,
  },
  startBtnText: { color: colors.bgDeep, fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
  },
  btnOutlineText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  hud: {
    marginTop: 40,
    width: '100%',
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hudLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  hudTapNum: { color: colors.gold, fontSize: 36, fontWeight: '900' },
  hudTapLabel: { color: colors.goldDim, fontSize: 12, fontWeight: '700' },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.neon,
    backgroundColor: 'rgba(0,255,204,0.08)',
  },
  timerText: { color: colors.neon, fontSize: 18, fontWeight: '900' },
  statusText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 30,
    letterSpacing: 2,
  },
  gridContainer: {
    width: GRID_SIZE,
    height: GRID_SIZE,
    marginTop: 30,
    backgroundColor: colors.bgCard + '30',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  node: {
    position: 'absolute',
    width: NODE_RADIUS * 2,
    height: NODE_RADIUS * 2,
    borderRadius: NODE_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  nodeText: {
    fontSize: 16,
    fontWeight: '900',
  },
  resultCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    ...shadow.card,
  },
  trophyRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  resultTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  resultScore: { color: colors.gold, fontSize: 56, fontWeight: '900' },
  resultLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
});
