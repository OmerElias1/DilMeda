import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, PanResponder
} from 'react-native';
import { Zap, Trophy, ChevronRight, Heart } from 'lucide-react-native';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';

const { width: SW, height: SH } = Dimensions.get('window');
const PLAYER_Y = SH - 160;
const ROCKET_WIDTH = 32;
const ROCKET_HEIGHT = 56;
const ASTEROID_SIZE = 42;

// ── Rocket Visual Component ──────────────────────────────────────────
function RocketVisual({ thrusting }: { thrusting: boolean }) {
  return (
    <View style={rv.wrap}>
      {/* Nose cone */}
      <View style={rv.nose} />
      {/* Body */}
      <View style={rv.body}>
        {/* Cockpit window */}
        <View style={rv.window} />
        {/* Body stripe */}
        <View style={rv.stripe} />
      </View>
      {/* Fins row */}
      <View style={rv.finsRow}>
        <View style={rv.finLeft} />
        <View style={rv.finRight} />
      </View>
      {/* Engine nozzle */}
      <View style={rv.nozzle} />
      {/* Exhaust flame */}
      <View style={[rv.flame, !thrusting && { opacity: 0.4 }]}>
        <View style={rv.flameInner} />
      </View>
    </View>
  );
}

const rv = StyleSheet.create({
  wrap: { alignItems: 'center', width: ROCKET_WIDTH },
  nose: {
    width: 0, height: 0,
    borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 18,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: '#00CCFF',
  },
  body: {
    width: 22, height: 22,
    backgroundColor: '#1A2A4A',
    borderWidth: 1.5, borderColor: '#00CCFF',
    borderRadius: 3, alignItems: 'center', overflow: 'hidden',
  },
  window: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#00FFFF', opacity: 0.8,
    marginTop: 4, borderWidth: 1, borderColor: '#fff',
  },
  stripe: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 4, backgroundColor: '#00CCFF', opacity: 0.5,
  },
  finsRow: {
    flexDirection: 'row', width: ROCKET_WIDTH, justifyContent: 'space-between',
    height: 10,
  },
  finLeft: {
    width: 0, height: 0,
    borderRightWidth: 8, borderTopWidth: 10,
    borderRightColor: '#0088BB', borderTopColor: 'transparent',
  },
  finRight: {
    width: 0, height: 0,
    borderLeftWidth: 8, borderTopWidth: 10,
    borderLeftColor: '#0088BB', borderTopColor: 'transparent',
  },
  nozzle: {
    width: 14, height: 5, backgroundColor: '#444',
    borderRadius: 2, borderWidth: 1, borderColor: '#666',
  },
  flame: {
    alignItems: 'center', marginTop: 1,
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 12,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: '#FF6600',
  },
  flameInner: {
    position: 'absolute', top: -10,
    width: 0, height: 0,
    borderLeftWidth: 3, borderRightWidth: 3, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: '#FFDD00',
  },
});

// ── Asteroid Visual Component ─────────────────────────────────────────
function AsteroidVisual({ seed }: { seed: number }) {
  const rot = (seed * 37) % 360;
  const size1 = ASTEROID_SIZE;
  const size2 = size1 * 0.65;
  const craterSize = size1 * 0.22;
  return (
    <View style={[av.outer, { transform: [{ rotate: `${rot}deg` }] }]}>
      <View style={[av.rock, { width: size1, height: size1, borderRadius: size1 * 0.42 }]}>
        {/* texture layers */}
        <View style={[av.blob, { width: size2, height: size2, borderRadius: size2 * 0.5, top: 4, left: 2, backgroundColor: '#5A5055' }]} />
        {/* craters */}
        <View style={[av.crater, { width: craterSize, height: craterSize, borderRadius: craterSize, top: 8, left: 10 }]} />
        <View style={[av.crater, { width: craterSize * 0.7, height: craterSize * 0.7, borderRadius: craterSize, top: 18, left: 22 }]} />
        {/* highlight */}
        <View style={av.highlight} />
      </View>
    </View>
  );
}

const av = StyleSheet.create({
  outer: { width: ASTEROID_SIZE, height: ASTEROID_SIZE },
  rock: {
    position: 'absolute', backgroundColor: '#6B6070',
    borderWidth: 1.5, borderColor: '#888', overflow: 'hidden',
  },
  blob: { position: 'absolute' },
  crater: {
    position: 'absolute', backgroundColor: '#4A3D4A',
    borderWidth: 1, borderColor: '#3A2D3A',
  },
  highlight: {
    position: 'absolute', top: 4, right: 5,
    width: 8, height: 5, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    transform: [{ rotate: '-20deg' }],
  },
});

type Obstacle = {
  id: number;
  x: number;
  y: number;
  passed: boolean;
};

type Props = {
  onClose: () => void;
  onPlayAgain?: () => void;
};

export default function AstroDrift({ onClose, onPlayAgain }: Props) {
  const { endGameSession } = useAuth();
  const { isExpired } = useTournament();

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);

  // Physics states
  const playerX = useRef(SW / 2);
  const [playerXState, setPlayerXState] = useState(SW / 2);
  const velocity = useRef(0);
  const isPressing = useRef(false);

  const loopRef = useRef<number | null>(null);
  const nextId = useRef(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);

  // PanResponder to track screen presses/holds
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        isPressing.current = true;
      },
      onPanResponderRelease: () => {
        isPressing.current = false;
      },
    })
  ).current;

  const startGame = () => {
    scoreRef.current = 0;
    livesRef.current = 3;
    playerX.current = SW / 2;
    velocity.current = 0;
    isPressing.current = false;
    setScore(0);
    setLives(3);
    setPlayerXState(SW / 2);
    setObstacles([]);
    nextId.current = 0;
    setPhase('playing');
  };

  const finishGame = async () => {
    setPhase('done');
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    await endGameSession(scoreRef.current);
  };

  // Game Loop
  useEffect(() => {
    if (phase !== 'playing') return;

    let lastSpawn = Date.now();
    let spawnInterval = 1500; // ms between obstacle spawns

    const update = () => {
      const now = Date.now();

      // --- 1. Physics: Update Player position (Drifting) ---
      // If pressing, accelerate right. Otherwise, accelerate left.
      const accel = isPressing.current ? 0.6 : -0.6;
      velocity.current += accel;

      // Friction/Cap speed
      velocity.current *= 0.95;
      velocity.current = Math.max(-10, Math.min(10, velocity.current));

      playerX.current += velocity.current;

      // Screen boundary checks
      if (playerX.current < ROCKET_WIDTH / 2) {
        playerX.current = ROCKET_WIDTH / 2;
        velocity.current = 0;
      }
      if (playerX.current > SW - ROCKET_WIDTH / 2) {
        playerX.current = SW - ROCKET_WIDTH / 2;
        velocity.current = 0;
      }

      setPlayerXState(playerX.current);

      // --- 2. Obstacles: Spawn and Move ---
      const scrollSpeed = Math.min(12, 5 + scoreRef.current * 0.05);

      if (now - lastSpawn > spawnInterval) {
        lastSpawn = now;
        // Spawn an obstacle row with a gap
        // We'll place one asteroid at a random X coordinate
        const obsX = Math.random() * (SW - ASTEROID_SIZE);
        setObstacles((prev) => [
          ...prev,
          {
            id: nextId.current++,
            x: obsX,
            y: -50,
            passed: false,
          },
        ]);
      }

      // Move and check collisions
      setObstacles((prev) => {
        const nextList: Obstacle[] = [];
        prev.forEach((o) => {
          const ny = o.y + scrollSpeed;

          // Out of screen check
          if (ny > SH) {
            return; // destroy
          }

          // Collision Check (Bounding Box overlap)
          // Rocket is at (playerX - ROCKET_WIDTH/2, PLAYER_Y)
          const rx = playerX.current - ROCKET_WIDTH / 2;
          const ry = PLAYER_Y;

          const collides =
            rx < o.x + ASTEROID_SIZE &&
            rx + ROCKET_WIDTH > o.x &&
            ry < o.y + ASTEROID_SIZE &&
            ry + ROCKET_HEIGHT > o.y;

          if (collides) {
            livesRef.current -= 1;
            setLives(livesRef.current);
            if (livesRef.current <= 0) {
              finishGame();
            }
            return; // destroy
          }

          // Score check (if rocket passes the obstacle Y coordinate)
          let passed = o.passed;
          if (!passed && ny > PLAYER_Y + ROCKET_HEIGHT) {
            passed = true;
            scoreRef.current += 10;
            setScore(scoreRef.current);
          }

          nextList.push({ ...o, y: ny, passed });
        });
        return nextList;
      });

      loopRef.current = requestAnimationFrame(update);
    };

    loopRef.current = requestAnimationFrame(update);

    return () => {
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
    };
  }, [phase]);

  if (phase === 'done') {
    return (
      <View style={s.container}>
        <View style={s.resultCard}>
          <View style={s.trophyRing}>
            <Trophy color={colors.gold} size={40} fill={colors.gold} />
          </View>
          <Text style={s.resultTitle}>CRASHED!</Text>
          <Text style={s.resultScore}>{score}</Text>
          <Text style={s.resultLabel}>POINTS EARNED</Text>
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
          <Text style={s.gameTitle}>ASTRO DRIFT</Text>
          <Zap color={colors.gold} size={24} fill={colors.gold} />
        </View>

        <View style={s.infoCard}>
          <Text style={s.infoHeading}>How to Play</Text>
          <Text style={s.infoText}>Press and hold screen to drift right. Release to drift left.</Text>
          <Text style={s.infoText}>Avoid colliding with the falling asteroids.</Text>
          <Text style={s.infoText}>You have 3 lives. Survival speed increases over time!</Text>
          <Text style={[s.infoText, { color: colors.neon, marginTop: 6 }]}>⚡ Pilot carefully through the asteroid belt!</Text>
        </View>

        <TouchableOpacity style={s.startBtn} onPress={startGame}>
          <Text style={s.startBtnText}>START GAME</Text>
          <ChevronRight color={colors.bgDeep} size={20} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.playContainer} {...panResponder.panHandlers}>
      {/* HUD */}
      <View style={s.hud}>
        <View style={s.hudLeft}>
          <Text style={s.hudTapNum}>{score}</Text>
          <Text style={s.hudTapLabel}>SCORE</Text>
        </View>

        <View style={s.livesRow}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Heart
              key={i}
              size={18}
              color={colors.error}
              fill={i < lives ? colors.error : 'transparent'}
              style={{ marginLeft: 4 }}
            />
          ))}
        </View>
      </View>

      {/* Asteroid Obstacles */}
      {obstacles.map((o) => (
        <View
          key={o.id}
          style={[
            s.asteroid,
            { left: o.x, top: o.y },
          ]}
        >
          <AsteroidVisual seed={o.id} />
        </View>
      ))}

      {/* Player Rocket */}
      <View
        style={[
          s.rocket,
          {
            left: playerXState - ROCKET_WIDTH / 2,
            top: PLAYER_Y,
          },
        ]}
      >
        <RocketVisual thrusting={isPressing.current} />
      </View>

      <Text style={s.hintText}>Hold to drift right • Release to drift left</Text>
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
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  hudLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  hudTapNum: { color: colors.gold, fontSize: 36, fontWeight: '900' },
  hudTapLabel: { color: colors.goldDim, fontSize: 12, fontWeight: '700' },
  livesRow: { flexDirection: 'row', alignItems: 'center' },
  asteroid: {
    position: 'absolute',
    width: ASTEROID_SIZE,
    height: ASTEROID_SIZE,
  },
  rocket: {
    position: 'absolute',
    width: ROCKET_WIDTH,
    height: ROCKET_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  hintText: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
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
