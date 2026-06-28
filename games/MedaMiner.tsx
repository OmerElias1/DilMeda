import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Easing
} from 'react-native';
import { Zap, Trophy, ChevronRight, Clock } from 'lucide-react-native';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';

const { width: SW, height: SH } = Dimensions.get('window');
const PIVOT_X = SW / 2;
const PIVOT_Y = 80;
const CLAW_BASE_SPEED = 300; // pixels per second extending
const CLAW_RETRACT_SPEED = 250;

type Item = {
  id: number;
  x: number;
  y: number;
  radius: number;
  points: number;
  weight: number; // speed multiplier: higher means heavier/slower
  type: 'gold_large' | 'gold_small' | 'diamond' | 'stone' | 'bone';
  color: string;
};

type Props = {
  onClose: () => void;
  onPlayAgain?: () => void;
};

// ── Claw Visual Component ──────────────────────────────────────────
function ClawVisual({ state, hasItem }: { state: 'swing' | 'extending' | 'retracting'; hasItem: boolean }) {
  const isOpen = state === 'extending' || (state === 'swing' && !hasItem);
  return (
    <View style={cv.wrap}>
      {/* Anchor ring */}
      <View style={cv.ring} />
      {/* Left pincer */}
      <View style={[cv.pincer, cv.pincerLeft, isOpen ? cv.pincerLeftOpen : cv.pincerLeftClosed]} />
      {/* Right pincer */}
      <View style={[cv.pincer, cv.pincerRight, isOpen ? cv.pincerRightOpen : cv.pincerRightClosed]} />
    </View>
  );
}

const cv = StyleSheet.create({
  wrap: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: colors.gold, marginBottom: -2 },
  pincer: {
    position: 'absolute', width: 6, height: 18,
    borderWidth: 2, borderColor: colors.gold,
    borderRadius: 8, backgroundColor: '#3A2D3A',
  },
  pincerLeft: { left: 4, top: 8 },
  pincerRight: { right: 4, top: 8 },
  pincerLeftOpen: { transform: [{ rotate: '-25deg' }] },
  pincerLeftClosed: { transform: [{ rotate: '5deg' }] },
  pincerRightOpen: { transform: [{ rotate: '25deg' }] },
  pincerRightClosed: { transform: [{ rotate: '-5deg' }] },
});

// ── Item Visual Component ─────────────────────────────────────────
function ItemVisual({ type, radius: r }: { type: string; radius: number }) {
  if (type === 'diamond') {
    return (
      <View style={[iv.diamond, { width: r * 2, height: r * 2 }]}>
        <View style={[iv.diamondInner, { width: r * 1.3, height: r * 1.3 }]} />
      </View>
    );
  }
  if (type.includes('gold')) {
    return (
      <View style={[iv.gold, { width: r * 2, height: r * 2, borderRadius: r }]}>
        <View style={[iv.goldHighlight, { width: r * 1.2, height: r * 1.2, borderRadius: r * 0.6 }]} />
      </View>
    );
  }
  // Stone/Bone
  return (
    <View style={[iv.stone, { width: r * 2, height: r * 2, borderRadius: r * 0.45 }]}>
      <View style={[iv.stoneHighlight, { width: r, height: r, borderRadius: r * 0.5 }]} />
    </View>
  );
}

const iv = StyleSheet.create({
  diamond: {
    backgroundColor: '#00FFFF', borderWidth: 1.5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }],
    ...shadow.neon,
  },
  diamondInner: { backgroundColor: '#E0FFFF', opacity: 0.8 },
  gold: {
    backgroundColor: '#FFD700', borderWidth: 2, borderColor: '#FFA500',
    alignItems: 'center', justifyContent: 'center',
    ...shadow.gold,
  },
  goldHighlight: { backgroundColor: '#FFFACD', opacity: 0.7, position: 'absolute', top: 2, left: 2 },
  stone: {
    backgroundColor: '#808080', borderWidth: 2, borderColor: '#555555',
    alignItems: 'center', justifyContent: 'center',
  },
  stoneHighlight: { backgroundColor: '#A9A9A9', opacity: 0.5, position: 'absolute', top: 3, left: 3 },
});

export default function MedaMiner({ onClose, onPlayAgain }: Props) {
  const { endGameSession } = useAuth();
  const { isExpired } = useTournament();

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [items, setItems] = useState<Item[]>([]);

  // Claw state
  const [clawState, setClawState] = useState<'swing' | 'extending' | 'retracting'>('swing');
  const swingAnim = useRef(new Animated.Value(0)).current; // -60 to 60 degrees
  const lengthAnim = useRef(new Animated.Value(40)).current; // current rope length

  const [currentAngle, setCurrentAngle] = useState(0);
  const [ropeLength, setRopeLength] = useState(40);
  const [grabbedItem, setGrabbedItem] = useState<Item | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoreRef = useRef(0);
  const activeItemRef = useRef<Item | null>(null);
  const currentAngleRef = useRef(0);

  // Synchronize layout animations to state to trigger re-renders
  useEffect(() => {
    const angleListener = swingAnim.addListener(({ value }) => {
      const angle = -60 + value * 120;
      currentAngleRef.current = angle;
      setCurrentAngle(angle);
    });
    const lengthListener = lengthAnim.addListener(({ value }) => {
      setRopeLength(value);
    });
    return () => {
      swingAnim.removeListener(angleListener);
      lengthAnim.removeListener(lengthListener);
    };
  }, []);

  // Swing animation loop
  useEffect(() => {
    if (phase !== 'playing' || clawState !== 'swing') return;

    // Reset length to short
    lengthAnim.setValue(40);

    const swing = Animated.loop(
      Animated.sequence([
        Animated.timing(swingAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(swingAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    swing.start();

    return () => {
      swing.stop();
    };
  }, [phase, clawState]);

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

  const generateItems = () => {
    const list: Item[] = [];
    const types: Omit<Item, 'id' | 'x' | 'y'>[] = [
      { radius: 24, points: 50, weight: 1.5, type: 'gold_large', color: '#FFD700' },
      { radius: 14, points: 25, weight: 0.9, type: 'gold_small', color: '#FFDF00' },
      { radius: 10, points: 100, weight: 0.7, type: 'diamond', color: colors.neon },
      { radius: 28, points: 5, weight: 2.8, type: 'stone', color: '#888' },
      { radius: 12, points: 15, weight: 0.8, type: 'bone', color: '#FFF' },
    ];

    for (let i = 0; i < 8; i++) {
      const template = types[Math.floor(Math.random() * types.length)];
      // Spawn in lower 60% of the screen
      const minX = template.radius + 20;
      const maxX = SW - template.radius - 20;
      const minY = SH * 0.4;
      const maxY = SH * 0.8;

      list.push({
        id: i,
        x: Math.random() * (maxX - minX) + minX,
        y: Math.random() * (maxY - minY) + minY,
        ...template,
      });
    }
    setItems(list);
  };

  const startGame = () => {
    scoreRef.current = 0;
    setScore(0);
    setTimeLeft(30);
    setGrabbedItem(null);
    generateItems();
    setClawState('swing');
    setPhase('playing');
  };

  const finishGame = async () => {
    setPhase('done');
    await endGameSession(scoreRef.current);
  };

  const handleLaunch = () => {
    if (phase !== 'playing' || clawState !== 'swing') return;

    // Stop swinging, freeze current angle
    setClawState('extending');
    const angleRad = (currentAngleRef.current * Math.PI) / 180;
    const sinA = Math.sin(angleRad);
    const cosA = Math.cos(angleRad);

    // Bounding / Intersection Check
    let targetDistance = 600; // max length
    let hitItem: Item | null = null;

    items.forEach((item) => {
      // Distance from pivot to circle center along the ray
      const d = Math.abs((item.x - PIVOT_X) * cosA - (item.y - PIVOT_Y) * sinA);
      if (d < item.radius) {
        const t = (item.x - PIVOT_X) * sinA + (item.y - PIVOT_Y) * cosA;
        // Check if item is in the forward direction
        if (t > 0 && t < targetDistance) {
          targetDistance = t;
          hitItem = item;
        }
      }
    });

    activeItemRef.current = hitItem;
    if (hitItem) {
      // Remove it from the board immediately so it doesn't stay static at the bottom
      setItems((prev) => prev.filter((it) => it.id !== hitItem!.id));
      setGrabbedItem(hitItem);
    }

    // Extend Claw Animation
    const duration = (targetDistance / CLAW_BASE_SPEED) * 1000;
    Animated.timing(lengthAnim, {
      toValue: targetDistance,
      duration,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(() => {
      // Retrieve/Retract
      setClawState('retracting');
      const retractMultiplier = hitItem ? (hitItem as Item).weight : 1.0;
      const retractDuration = (targetDistance / (CLAW_RETRACT_SPEED / retractMultiplier)) * 1000;

      Animated.timing(lengthAnim, {
        toValue: 40,
        duration: retractDuration,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(() => {
        if (hitItem) {
          const earned = hitItem.points;
          scoreRef.current += earned;
          setScore(scoreRef.current);
        }
        activeItemRef.current = null;
        setGrabbedItem(null);
        setClawState('swing');
      });
    });
  };

  // Convert animated state values into layout coords — using state triggers re-render
  const angleRad = (currentAngle * Math.PI) / 180;
  const sinA = Math.sin(angleRad);
  const cosA = Math.cos(angleRad);

  // Render done
  if (phase === 'done') {
    return (
      <View style={s.container}>
        <View style={s.resultCard}>
          <View style={s.trophyRing}>
            <Trophy color={colors.gold} size={40} fill={colors.gold} />
          </View>
          <Text style={s.resultTitle}>TIME'S UP!</Text>
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

  // Render ready
  if (phase === 'ready') {
    return (
      <View style={s.container}>
        <View style={s.titleRow}>
          <Zap color={colors.gold} size={24} fill={colors.gold} />
          <Text style={s.gameTitle}>MEDA MINER</Text>
          <Zap color={colors.gold} size={24} fill={colors.gold} />
        </View>

        <View style={s.infoCard}>
          <Text style={s.infoHeading}>How to Play</Text>
          <Text style={s.infoText}>Tap anywhere to drop the swinging claw!</Text>
          <Text style={s.infoText}>Grab gold & diamonds for high points.</Text>
          <Text style={s.infoText}>Avoid heavy stones that pull up very slowly!</Text>
          <Text style={[s.infoText, { color: colors.neon, marginTop: 6 }]}>⚡ Grab items quickly before time runs out!</Text>
        </View>

        <TouchableOpacity style={s.startBtn} onPress={startGame}>
          <Text style={s.startBtnText}>START GAME</Text>
          <ChevronRight color={colors.bgDeep} size={20} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity activeOpacity={1} onPress={handleLaunch} style={s.playContainer}>
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

      {/* Target Items */}
      {items.map((item) => (
        <View
          key={item.id}
          style={[
            s.itemCircle,
            {
              left: item.x - item.radius,
              top: item.y - item.radius,
            },
          ]}
        >
          <ItemVisual type={item.type} radius={item.radius} />
        </View>
      ))}

      {/* Grabbed Item (Retracting with claw) */}
      {grabbedItem && (
        <View
          style={[
            s.itemCircle,
            {
              left: PIVOT_X + sinA * ropeLength - grabbedItem.radius,
              top: PIVOT_Y + cosA * ropeLength - grabbedItem.radius,
              zIndex: 5,
            },
          ]}
        >
          <ItemVisual type={grabbedItem.type} radius={grabbedItem.radius} />
        </View>
      )}

      {/* Rope / Wire */}
      <View
        style={[
          s.rope,
          {
            left: PIVOT_X,
            top: PIVOT_Y,
            width: 2,
            height: ropeLength,
            transform: [
              { rotate: `${currentAngle}deg` },
              { translateY: ropeLength / 2 },
            ],
          },
        ]}
      />

      {/* Claw Hook */}
      <View
        style={[
          s.claw,
          {
            left: PIVOT_X + sinA * ropeLength - 15,
            top: PIVOT_Y + cosA * ropeLength - 15,
            transform: [{ rotate: `${currentAngle}deg` }],
          },
        ]}
      >
        <ClawVisual state={clawState} hasItem={!!grabbedItem} />
      </View>

      {/* Miner Pivot Base */}
      <View style={s.pivotBase} />
    </TouchableOpacity>
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
  pivotBase: {
    position: 'absolute',
    left: PIVOT_X - 16,
    top: PIVOT_Y - 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gold,
    borderWidth: 3,
    borderColor: colors.goldLight,
  },
  rope: {
    position: 'absolute',
    backgroundColor: colors.goldDim,
    transformOrigin: 'top center',
  },
  claw: {
    position: 'absolute',
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCircle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
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
