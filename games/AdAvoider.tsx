import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, PanResponder, Dimensions, Easing,
  Animated as RNAnimated,
} from 'react-native';
import { Shield, AlertCircle, Star, Zap, Heart, Trophy, ChevronRight } from 'lucide-react-native';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';

const { width: W } = Dimensions.get('window');
const GAME_W = Math.min(W - 32, 380);
const GAME_H = 500;
const PLAYER_W = 48;
const PLAYER_H = 48;
const BLOCK_SIZE = 34;

type Block = {
  id: number;
  x: number;
  yAnim: RNAnimated.Value;
  yRef: { current: number };
  type: 'bad' | 'good';
  active: boolean;
};

type Props = { onClose: () => void; onPlayAgain?: () => void };

// Difficulty tiers
const TIERS = [
  { name: 'EASY', color: '#00FF88', minScore: 0, spawnRate: 18, spawnCount: 1, baseSpeed: 4.5 },
  { name: 'MEDIUM', color: '#FFD700', minScore: 12, spawnRate: 14, spawnCount: 2, baseSpeed: 5.5 },
  { name: 'HARD', color: '#FF8C00', minScore: 30, spawnRate: 10, spawnCount: 3, baseSpeed: 7 },
  { name: 'INSANE', color: '#FF4444', minScore: 60, spawnRate: 7, spawnCount: 4, baseSpeed: 9 },
  { name: 'CHAOS', color: '#FF00FF', minScore: 100, spawnRate: 5, spawnCount: 5, baseSpeed: 11 },
];

function getTier(score: number) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (score >= TIERS[i].minScore) return TIERS[i];
  }
  return TIERS[0];
}

export default function AdAvoider({ onClose, onPlayAgain }: Props) {
  const { endGameSession } = useAuth();
  const { isExpired } = useTournament();
  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [flashRed, setFlashRed] = useState(false);
  const [tierName, setTierName] = useState(TIERS[0].name);
  const [tierColor, setTierColor] = useState(TIERS[0].color);

  const playerXRef = useRef(GAME_W / 2 - PLAYER_W / 2);
  const activeBlocksRef = useRef<Block[]>([]);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const idRef = useRef(0);
  const tickRef = useRef(0);
  const loopRef = useRef<number | null>(null);
  const gameActiveRef = useRef(false);
  const startXRef = useRef(playerXRef.current);

  // Animations
  const titleGlow = useRef(new RNAnimated.Value(0)).current;
  const shieldPulse = useRef(new RNAnimated.Value(1)).current;
  const resultScale = useRef(new RNAnimated.Value(0)).current;
  const playerXAnim = useRef(new RNAnimated.Value(GAME_W / 2 - PLAYER_W / 2)).current;

  useEffect(() => {
    if (phase !== 'ready') return;
    const anim = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(titleGlow, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        RNAnimated.timing(titleGlow, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [phase]);

  // Shield pulse removed (was continuous animation wasting GPU during play)

  useEffect(() => {
    if (phase === 'done') {
      RNAnimated.spring(resultScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }).start();
    } else {
      resultScale.setValue(0);
    }
  }, [phase]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { startXRef.current = playerXRef.current; },
      onPanResponderMove: (_, gs) => {
        const newX = Math.max(0, Math.min(GAME_W - PLAYER_W, startXRef.current + gs.dx));
        playerXRef.current = newX;
        playerXAnim.setValue(newX);
      },
    })
  ).current;

  const removeBlock = useCallback((id: number) => {
    activeBlocksRef.current = activeBlocksRef.current.filter(b => b.id !== id);
    setBlocks(prev => prev.filter(b => b.id !== id));
  }, []);

  const spawnBlock = useCallback((x: number, type: 'bad' | 'good', duration: number) => {
    const id = idRef.current++;
    const yAnim = new RNAnimated.Value(-BLOCK_SIZE);
    const yRef = { current: -BLOCK_SIZE };

    const listenerId = yAnim.addListener(({ value }) => {
      yRef.current = value;
    });

    const newBlock: Block = {
      id,
      x,
      yAnim,
      yRef,
      type,
      active: true,
    };

    activeBlocksRef.current.push(newBlock);
    setBlocks(prev => [...prev, newBlock]);

    RNAnimated.timing(yAnim, {
      toValue: GAME_H + 50,
      duration: duration,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(({ finished }) => {
      yAnim.removeListener(listenerId);
      if (finished) {
        removeBlock(id);
      }
    });
  }, [removeBlock]);

  const endGame = useCallback(() => {
    gameActiveRef.current = false;
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }
    // Clean up all block animations
    activeBlocksRef.current.forEach(b => {
      b.yAnim.stopAnimation();
      b.yAnim.removeAllListeners();
    });
    activeBlocksRef.current = [];
    setPhase('done');

    endGameSession(scoreRef.current);
  }, [endGameSession]);

  const frameSkipAA = useRef(0);
  const gameLoop = useCallback(() => {
    if (!gameActiveRef.current) return;

    // Throttle to ~30fps
    frameSkipAA.current = (frameSkipAA.current + 1) % 2;
    if (frameSkipAA.current !== 0) {
      loopRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    tickRef.current++;

    const tier = getTier(scoreRef.current);
    if (tickRef.current % tier.spawnRate === 0) {
      for (let i = 0; i < tier.spawnCount; i++) {
        const x = Math.random() * (GAME_W - BLOCK_SIZE);
        const type = Math.random() > 0.6 ? 'good' : 'bad';
        const speed = tier.baseSpeed + scoreRef.current * 0.02;
        const distance = GAME_H + 50 + BLOCK_SIZE;
        const duration = (distance / speed) * 16.67;
        spawnBlock(x, type, duration);
      }
    }

    const pX = playerXRef.current;
    const pY = GAME_H - PLAYER_H - 12;

    activeBlocksRef.current.forEach(b => {
      if (!b.active) return;

      const currY = b.yRef.current;
      const hit = b.x < pX + PLAYER_W && b.x + BLOCK_SIZE > pX &&
                  currY + BLOCK_SIZE > pY && currY < pY + PLAYER_H;

      if (hit) {
        b.active = false;
        b.yAnim.stopAnimation();
        b.yAnim.removeAllListeners();
        activeBlocksRef.current = activeBlocksRef.current.filter(bl => bl.id !== b.id);
        setBlocks(prev => prev.filter(bl => bl.id !== b.id));

        if (b.type === 'bad') {
          const newLives = Math.max(0, livesRef.current - 1);
          livesRef.current = newLives;
          setLives(newLives);
          setFlashRed(true);
          setTimeout(() => setFlashRed(false), 200);
          if (newLives <= 0) { endGame(); }
        } else {
          const newScore = scoreRef.current + 2;
          scoreRef.current = newScore;
          setScore(newScore);
          const t = getTier(newScore);
          setTierName(t.name);
          setTierColor(t.color);
        }
      }
    });

    if (gameActiveRef.current) {
      loopRef.current = requestAnimationFrame(gameLoop);
    }
  }, [spawnBlock, removeBlock, endGame]);

  const startGame = () => {
    gameActiveRef.current = true;
    const initialPlayerX = GAME_W / 2 - PLAYER_W / 2;
    playerXRef.current = initialPlayerX;
    playerXAnim.setValue(initialPlayerX);

    activeBlocksRef.current.forEach(b => {
      b.yAnim.stopAnimation();
      b.yAnim.removeAllListeners();
    });
    activeBlocksRef.current = [];
    setBlocks([]);

    scoreRef.current = 0;
    setScore(0);
    livesRef.current = 3;
    setLives(3);
    setFlashRed(false);
    setTierName(TIERS[0].name);
    setTierColor(TIERS[0].color);
    setPhase('playing');
    tickRef.current = 0;

    loopRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    return () => {
      gameActiveRef.current = false;
      if (loopRef.current) {
        cancelAnimationFrame(loopRef.current);
      }
      activeBlocksRef.current.forEach(b => {
        b.yAnim.stopAnimation();
        b.yAnim.removeAllListeners();
      });
    };
  }, []);

  const glowOpacity = titleGlow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  // ── EXPIRED ──
  if (isExpired) {
    return (
      <View style={s.container}>
        <Text style={s.expiredText}>Tournament ended!</Text>
        <TouchableOpacity style={s.btnOutline} onPress={onClose}>
          <Text style={s.btnOutlineText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── READY ──
  if (phase === 'ready') {
    return (
      <View style={s.container}>
        <RNAnimated.View style={{ opacity: glowOpacity }}>
          <View style={s.titleBadge}>
            <Zap color={colors.gold} size={22} fill={colors.gold} />
            <Text style={s.gameTitle}>AD-AVOIDER</Text>
            <Zap color={colors.gold} size={22} fill={colors.gold} />
          </View>
        </RNAnimated.View>

        <View style={s.infoCard}>
          <Text style={s.infoHeading}>How to Play</Text>
          <Text style={s.infoText}>Drag your shield to dodge <Text style={{ color: colors.error, fontWeight: '800' }}>red ads</Text></Text>
          <Text style={s.infoText}>Catch <Text style={{ color: colors.gold, fontWeight: '800' }}>gold stars</Text> for +2 pts</Text>
          <Text style={[s.infoText, { color: colors.neon, marginTop: 8 }]}>⚡ Difficulty increases as you score!</Text>
        </View>

        <View style={s.legendRow}>
          <View style={[s.legendBlock, { backgroundColor: 'rgba(255,68,68,0.2)', borderColor: colors.error }]}>
            <AlertCircle color={colors.error} size={16} />
            <Text style={[s.legendLabel, { color: colors.error }]}>BAD AD</Text>
          </View>
          <View style={[s.legendBlock, { backgroundColor: 'rgba(255,215,0,0.15)', borderColor: colors.gold }]}>
            <Star color={colors.gold} size={16} fill={colors.gold} />
            <Text style={[s.legendLabel, { color: colors.gold }]}>GOLD</Text>
          </View>
        </View>

        <TouchableOpacity style={s.startBtn} onPress={startGame} activeOpacity={0.8}>
          <Text style={s.startBtnText}>START GAME</Text>
          <ChevronRight color={colors.bgDeep} size={20} />
        </TouchableOpacity>
      </View>
    );
  }

  // ── DONE ──
  if (phase === 'done') {
    return (
      <View style={s.container}>
        <RNAnimated.View style={[s.resultCard, { transform: [{ scale: resultScale }] }]}>
          <View style={s.trophyRing}>
            <Trophy color={colors.gold} size={44} fill={colors.gold} />
          </View>
          <Text style={s.resultTitle}>GAME OVER</Text>
          <Text style={s.resultScore}>{score}</Text>
          <Text style={s.resultLabel}>POINTS EARNED</Text>
          <View style={[s.tierBadge, { backgroundColor: tierColor + '30', borderColor: tierColor }]}>
            <Text style={[s.tierBadgeText, { color: tierColor }]}>MAX TIER: {tierName}</Text>
          </View>
        </RNAnimated.View>

        <TouchableOpacity style={s.startBtn} onPress={onPlayAgain || startGame} activeOpacity={0.8}>
          <Text style={s.startBtnText}>PLAY AGAIN</Text>
          <ChevronRight color={colors.bgDeep} size={20} />
        </TouchableOpacity>
        <TouchableOpacity style={s.btnOutline} onPress={onClose}>
          <Text style={s.btnOutlineText}>Exit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── PLAYING ──
  return (
    <View style={s.container}>
      {/* HUD */}
      <View style={s.hud}>
        <View style={s.hudLeft}>
          <Text style={s.hudScoreNum}>{score}</Text>
          <Text style={s.hudScoreLabel}>PTS</Text>
        </View>
        <View style={[s.tierPill, { backgroundColor: tierColor + '25', borderColor: tierColor }]}>
          <Zap color={tierColor} size={12} fill={tierColor} />
          <Text style={[s.tierPillText, { color: tierColor }]}>{tierName}</Text>
        </View>
        <View style={s.hudRight}>
          {[...Array(3)].map((_, i) => (
            <Heart
              key={i}
              color={i < lives ? '#FF4444' : '#3D1F6E'}
              size={20}
              fill={i < lives ? '#FF4444' : 'transparent'}
            />
          ))}
        </View>
      </View>

      {/* Game Area */}
      <View
        style={[s.gameArea, flashRed && s.gameAreaFlash]}
        {...panResponder.panHandlers}
      >
        {/* Grid lines */}
        {[1, 2, 3].map(i => (
          <View key={`gl${i}`} style={[s.gridLine, { left: (GAME_W / 4) * i }]} />
        ))}

        {blocks.map(b => (
          <RNAnimated.View
            key={b.id}
            style={[
              s.block,
              {
                transform: [
                  { translateX: b.x },
                  { translateY: b.yAnim }
                ],
                backgroundColor: b.type === 'bad' ? 'rgba(255,68,68,0.95)' : 'rgba(255,215,0,0.95)',
                borderColor: b.type === 'bad' ? '#FF6666' : '#FFE44D',
              },
            ]}
          >
            {b.type === 'bad' ? (
              <AlertCircle color="#fff" size={18} />
            ) : (
              <Star color={colors.bgDeep} size={18} fill={colors.bgDeep} />
            )}
          </RNAnimated.View>
        ))}

        {/* Player */}
        <RNAnimated.View
          style={[
            s.player,
            {
              transform: [{ translateX: playerXAnim }],
              bottom: 12,
            }
          ]}
        >
          <View style={s.playerGlow} />
          <Shield color={colors.gold} size={34} fill="rgba(255,215,0,0.2)" />
        </RNAnimated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
    gap: 14, padding: spacing.md,
  },
  expiredText: { color: colors.error, fontSize: 16, textAlign: 'center', fontWeight: '600' },

  // ── Ready Screen ──
  titleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  gameTitle: {
    color: colors.gold, fontSize: 30, fontWeight: '900', letterSpacing: 4,
  },
  infoCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: 20,
    borderWidth: 1, borderColor: colors.border, width: GAME_W, alignItems: 'center', gap: 6,
  },
  infoHeading: { color: colors.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  infoText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  legendRow: { flexDirection: 'row', gap: 12 },
  legendBlock: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: radius.full, borderWidth: 1,
  },
  legendLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.gold, paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: radius.full, ...shadow.gold,
  },
  startBtnText: { color: colors.bgDeep, fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  // ── HUD ──
  hud: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: GAME_W, marginBottom: 6,
  },
  hudLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  hudScoreNum: { color: colors.gold, fontSize: 28, fontWeight: '900' },
  hudScoreLabel: { color: colors.goldDim, fontSize: 12, fontWeight: '700' },
  hudRight: { flexDirection: 'row', gap: 4 },
  tierPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1,
  },
  tierPillText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  // ── Game Area ──
  gameArea: {
    width: GAME_W, height: GAME_H,
    backgroundColor: '#0D0618',
    borderRadius: radius.lg, borderWidth: 2, borderColor: '#3D1F6E',
    overflow: 'hidden', position: 'relative',
  },
  gameAreaFlash: { borderColor: '#FF4444', backgroundColor: 'rgba(255,68,68,0.05)' },
  gridLine: {
    position: 'absolute', top: 0, bottom: 0, width: 1,
    backgroundColor: 'rgba(61,31,110,0.3)',
  },
  block: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BLOCK_SIZE,
    height: BLOCK_SIZE,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  player: {
    position: 'absolute',
    left: 0,
    width: PLAYER_W,
    height: PLAYER_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerGlow: {
    position: 'absolute', width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,215,0,0.12)',
  },

  // ── Result ──
  resultCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 28,
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border,
    width: GAME_W, ...shadow.card,
  },
  trophyRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 2, borderColor: colors.gold,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  resultTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  resultScore: { color: colors.gold, fontSize: 52, fontWeight: '900' },
  resultLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  tierBadge: {
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: radius.full, borderWidth: 1, marginTop: 4,
  },
  tierBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  btnOutline: {
    borderWidth: 1.5, borderColor: colors.border, paddingVertical: 12,
    paddingHorizontal: spacing.xl, borderRadius: radius.full,
  },
  btnOutlineText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
});
