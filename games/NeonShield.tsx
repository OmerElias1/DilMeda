import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, PanResponder
} from 'react-native';
import { Zap, Trophy, ChevronRight, Heart } from 'lucide-react-native';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';

const { width: SW, height: SH } = Dimensions.get('window');
const CX = SW / 2;
const CY = SH / 2 - 40;
const CORE_RADIUS = 30;
const SHIELD_RADIUS = 60;
const SHIELD_ANGLE_WIDTH = 80; // degrees

type Projectile = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // angle from center in degrees
  speed: number;
};

type Props = {
  onClose: () => void;
  onPlayAgain?: () => void;
};

export default function NeonShield({ onClose, onPlayAgain }: Props) {
  const { endGameSession } = useAuth();
  const { isExpired } = useTournament();

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);

  const shieldAngle = useRef(0); // in degrees (0 - 360)
  const [shieldAngleState, setShieldAngleState] = useState(0);

  const loopRef = useRef<number | null>(null);
  const nextId = useRef(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);

  // PanResponder to track rotation around center using screen-relative pageX/pageY
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        const touchX = evt.nativeEvent.pageX;
        const touchY = evt.nativeEvent.pageY;
        const dx = touchX - CX;
        const dy = touchY - CY;
        let angleRad = Math.atan2(dy, dx);
        let angleDeg = (angleRad * 180) / Math.PI;
        if (angleDeg < 0) angleDeg += 360;
        shieldAngle.current = angleDeg;
        setShieldAngleState(angleDeg);
      },
    })
  ).current;

  const startGame = () => {
    scoreRef.current = 0;
    livesRef.current = 3;
    setScore(0);
    setLives(3);
    setProjectiles([]);
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
    let spawnInterval = 1800; // ms between spawns (decreases over time)

    const update = () => {
      const now = Date.now();

      // Decrease spawn interval over time (increase difficulty)
      spawnInterval = Math.max(700, 1800 - scoreRef.current * 40);

      // Spawn projectile
      if (now - lastSpawn > spawnInterval) {
        lastSpawn = now;
        const angleRad = Math.random() * Math.PI * 2;
        // Spawn outside screen
        const spawnDist = SW * 0.7;
        const px = CX + Math.cos(angleRad) * spawnDist;
        const py = CY + Math.sin(angleRad) * spawnDist;

        const speed = Math.min(6, 2.5 + scoreRef.current * 0.15);
        const vx = -Math.cos(angleRad) * speed;
        const vy = -Math.sin(angleRad) * speed;

        let projAngle = (angleRad * 180) / Math.PI + 180; // inward target angle
        projAngle = projAngle % 360;

        setProjectiles((prev) => [
          ...prev,
          {
            id: nextId.current++,
            x: px,
            y: py,
            vx,
            vy,
            angle: projAngle,
            speed,
          },
        ]);
      }

      // Move projectiles and check boundary crossing
      setProjectiles((prev) => {
        const nextList: Projectile[] = [];
        prev.forEach((p) => {
          const prevDx = p.x - CX;
          const prevDy = p.y - CY;
          const prevDist = Math.sqrt(prevDx * prevDx + prevDy * prevDy);

          const nx = p.x + p.vx;
          const ny = p.y + p.vy;
          const dx = nx - CX;
          const dy = ny - CY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Check if crossed the shield radius boundary
          if (prevDist >= SHIELD_RADIUS && dist < SHIELD_RADIUS) {
            let diff = Math.abs(p.angle - shieldAngle.current);
            if (diff > 180) diff = 360 - diff;

            if (diff <= SHIELD_ANGLE_WIDTH / 2) {
              // Blocked!
              scoreRef.current += 10;
              setScore(scoreRef.current);
              return; // destroy projectile
            }
          }

          if (dist <= CORE_RADIUS) {
            // Hits Core (damage)
            livesRef.current -= 1;
            setLives(livesRef.current);
            if (livesRef.current <= 0) {
              finishGame();
            }
            return; // destroy projectile
          }

          nextList.push({ ...p, x: nx, y: ny });
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
          <Text style={s.resultTitle}>GAME OVER</Text>
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
          <Text style={s.gameTitle}>NEON SHIELD</Text>
          <Zap color={colors.gold} size={24} fill={colors.gold} />
        </View>

        <View style={s.infoCard}>
          <Text style={s.infoHeading}>How to Play</Text>
          <Text style={s.infoText}>Drag your finger anywhere on screen to rotate the shield.</Text>
          <Text style={s.infoText}>Block the incoming neon projectiles from hitting the core.</Text>
          <Text style={s.infoText}>You have 3 lives. The game speeds up over time!</Text>
          <Text style={[s.infoText, { color: colors.neon, marginTop: 6 }]}>⚡ Spin fast and defend your core!</Text>
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

      {/* Target/Core */}
      <View style={[s.core, { left: CX - CORE_RADIUS, top: CY - CORE_RADIUS }]} />

      {/* Shield arc indicators */}
      <View
        style={[
          s.shield,
          {
            left: CX - SHIELD_RADIUS,
            top: CY - SHIELD_RADIUS,
            transform: [{ rotate: `${shieldAngleState}deg` }],
          },
        ]}
      >
        <View style={s.shieldIndicator} />
      </View>

      {/* Projectiles */}
      {projectiles.map((p) => (
        <View
          key={p.id}
          style={[
            s.projectile,
            {
              left: p.x - 6,
              top: p.y - 6,
            },
          ]}
        />
      ))}

      <Text style={s.hintText}>Drag anywhere to rotate shield</Text>
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
  core: {
    position: 'absolute',
    width: CORE_RADIUS * 2,
    height: CORE_RADIUS * 2,
    borderRadius: CORE_RADIUS,
    backgroundColor: colors.gold,
    borderWidth: 3,
    borderColor: colors.goldLight,
    ...shadow.gold,
  },
  shield: {
    position: 'absolute',
    width: SHIELD_RADIUS * 2,
    height: SHIELD_RADIUS * 2,
    borderRadius: SHIELD_RADIUS,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  shieldIndicator: {
    width: 36,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.neon,
    ...shadow.neon,
  },
  projectile: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF3366',
    shadowColor: '#FF3366',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
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
