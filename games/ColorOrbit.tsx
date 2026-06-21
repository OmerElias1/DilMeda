import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated as A, Easing, PanResponder } from 'react-native';
import { Zap, ChevronRight, RefreshCw } from 'lucide-react-native';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';

const { width: SW } = Dimensions.get('window');
const GW = Math.min(SW - 32, 380);
const GH = 480;

const CENTER_X = GW / 2;
const CENTER_Y = GH / 2;
const WHEEL_SIZE = 100;
const BEAM_SIZE = 18;

type Beam = {
  id: number;
  yAnim: A.Value;
  yRef: { current: number };
  colorIdx: number;
  active: boolean;
};
type Props = { onClose: () => void; onPlayAgain?: () => void };

const COLORS = ['#FF00CC', '#00FFCC', '#FFCC00', '#A924FF'];

export default function ColorOrbit({ onClose, onPlayAgain }: Props) {
  const { endGameSession } = useAuth();
  const { isExpired } = useTournament();

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [beams, setBeams] = useState<Beam[]>([]);

  // Wheel state: index 0, 1, 2, 3 represents the active segment rotated to the top
  const [topColorIdx, setTopColorIdx] = useState(0);

  // Refs
  const beamsRef = useRef<Beam[]>([]);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const activeRef = useRef(false);
  const loopRef = useRef<number | null>(null);
  const tickRef = useRef(0);
  const idRef = useRef(0);
  const speedRef = useRef(3.5);
  const topColorIdxRef = useRef(0); // mirror of topColorIdx for use in game loop

  const wheelRotation = useRef(new A.Value(0)).current;
  const currentAngle = useRef(0);

  const glowAnim = useRef(new A.Value(0)).current;
  const resultScale = useRef(new A.Value(0)).current;

  const gameAreaRef = useRef<View>(null);
  const centerScreenPosRef = useRef({ x: 0, y: 0 });
  const startAngleRef = useRef(0);
  const startWheelAngleRef = useRef(0);
  const spawnCooldownRef = useRef(0);

  // Title glow loop (only on ready screen)
  useEffect(() => {
    if (phase !== 'ready') return;
    const anim = A.loop(A.sequence([
      A.timing(glowAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      A.timing(glowAnim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [phase]);

  useEffect(() => {
    if (phase === 'done') {
      A.spring(resultScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }).start();
    } else {
      resultScale.setValue(0);
    }
  }, [phase]);

  const endGame = useCallback(() => {
    activeRef.current = false;
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    setPhase('done');
    endGameSession(scoreRef.current);
  }, [endGameSession]);

  const removeBeam = useCallback((id: number) => {
    const beam = beamsRef.current.find(b => b.id === id);
    if (beam) {
      beam.yAnim.stopAnimation();
      beam.yAnim.removeAllListeners();
    }
    beamsRef.current = beamsRef.current.filter(b => b.id !== id);
    setBeams([...beamsRef.current]);
  }, []);

  const spawnBeam = useCallback((colorIdx: number) => {
    const id = idRef.current++;
    const yAnim = new A.Value(-30);
    const yRef = { current: -30 };
    const listenerId = yAnim.addListener(({ value }) => {
      yRef.current = value;
    });

    const newBeam: Beam = {
      id,
      yAnim,
      yRef,
      colorIdx,
      active: true,
    };

    const endY = CENTER_Y + 10;
    const distance = endY - (-30);
    const duration = (distance / speedRef.current) * 16.67;

    beamsRef.current.push(newBeam);
    setBeams([...beamsRef.current]);

    A.timing(yAnim, {
      toValue: endY,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(({ finished }) => {
      yAnim.removeListener(listenerId);
      if (finished) {
        removeBeam(id);
      }
    });
  }, [removeBeam]);

  const rotateWheel = (dir: 'left' | 'right') => {
    if (!activeRef.current) return;

    let delta = dir === 'left' ? -90 : 90;
    currentAngle.current += delta;

    let rotationSteps = Math.round(currentAngle.current / 90) % 4;
    if (rotationSteps < 0) rotationSteps += 4;
    let nextTopColor = (4 - rotationSteps) % 4;

    topColorIdxRef.current = nextTopColor;
    setTopColorIdx(nextTopColor);

    A.spring(wheelRotation, {
      toValue: currentAngle.current,
      friction: 7,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const measureGameArea = () => {
    if (gameAreaRef.current) {
      gameAreaRef.current.measureInWindow((x, y, width, height) => {
        centerScreenPosRef.current = {
          x: x + width / 2,
          y: y + height / 2,
        };
      });
    }
  };

  const onLayout = () => {
    measureGameArea();
  };

  const getAngle = (pageX: number, pageY: number) => {
    const dx = pageX - centerScreenPosRef.current.x;
    const dy = pageY - centerScreenPosRef.current.y;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    return angle;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: (evt) => {
        if (!activeRef.current) return;
        const pageX = evt.nativeEvent.pageX;
        const pageY = evt.nativeEvent.pageY;
        startAngleRef.current = getAngle(pageX, pageY);
        startWheelAngleRef.current = currentAngle.current;
      },
      onPanResponderMove: (evt) => {
        if (!activeRef.current) return;
        const pageX = evt.nativeEvent.pageX;
        const pageY = evt.nativeEvent.pageY;
        const currentTouchAngle = getAngle(pageX, pageY);
        let delta = currentTouchAngle - startAngleRef.current;

        if (delta > 180) {
          delta -= 360;
        } else if (delta < -180) {
          delta += 360;
        }

        const nextAngle = startWheelAngleRef.current + delta;
        currentAngle.current = nextAngle;
        wheelRotation.setValue(nextAngle);

        let rotationSteps = Math.round(nextAngle / 90) % 4;
        if (rotationSteps < 0) rotationSteps += 4;
        let nextTopColor = (4 - rotationSteps) % 4;
        topColorIdxRef.current = nextTopColor;
        setTopColorIdx(nextTopColor);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (!activeRef.current) return;

        if (Math.abs(gestureState.dx) < 8 && Math.abs(gestureState.dy) < 8) {
          const pageX = evt.nativeEvent.pageX;
          if (pageX < centerScreenPosRef.current.x) {
            rotateWheel('left');
          } else {
            rotateWheel('right');
          }
          return;
        }

        const finalAngle = Math.round(currentAngle.current / 90) * 90;
        currentAngle.current = finalAngle;

        let rotationSteps = Math.round(finalAngle / 90) % 4;
        if (rotationSteps < 0) rotationSteps += 4;
        let nextTopColor = (4 - rotationSteps) % 4;

        topColorIdxRef.current = nextTopColor;
        setTopColorIdx(nextTopColor);

        A.spring(wheelRotation, {
          toValue: finalAngle,
          friction: 7,
          tension: 200,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        if (!activeRef.current) return;
        const finalAngle = Math.round(currentAngle.current / 90) * 90;
        currentAngle.current = finalAngle;

        let rotationSteps = Math.round(finalAngle / 90) % 4;
        if (rotationSteps < 0) rotationSteps += 4;
        let nextTopColor = (4 - rotationSteps) % 4;

        topColorIdxRef.current = nextTopColor;
        setTopColorIdx(nextTopColor);

        A.spring(wheelRotation, {
          toValue: finalAngle,
          friction: 7,
          tension: 200,
          useNativeDriver: true,
        }).start();
      }
    })
  ).current;

  const frameSkip = useRef(0);
  const gameLoop = useCallback(() => {
    if (!activeRef.current) return;

    // Throttle to ~30fps by skipping every other frame
    frameSkip.current = (frameSkip.current + 1) % 2;
    if (frameSkip.current !== 0) {
      loopRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    tickRef.current++;

    // 1. Spawn falling beams (only one at a time with a slight delay between spawns)
    if (beamsRef.current.length === 0) {
      if (spawnCooldownRef.current > 0) {
        spawnCooldownRef.current--;
      } else {
        const colorIdx = Math.floor(Math.random() * 4);
        spawnBeam(colorIdx);
        spawnCooldownRef.current = 15; // ~500ms delay (15 logic ticks at 30fps)
      }
    } else {
      spawnCooldownRef.current = 15;
    }

    // 2. Collision checks using yRef
    const targetY = CENTER_Y - WHEEL_SIZE / 2 + 10;

    beamsRef.current.forEach(b => {
      if (!b.active) return;

      if (b.yRef.current >= targetY) {
        b.active = false;
        b.yAnim.stopAnimation();
        b.yAnim.removeAllListeners();

        if (topColorIdxRef.current === b.colorIdx) {
          scoreRef.current++;
          setScore(scoreRef.current);
        } else {
          livesRef.current--;
          setLives(livesRef.current);
          if (livesRef.current <= 0) {
            endGame();
            return;
          }
        }
        removeBeam(b.id);
      }
    });

    // Speed scaling (base speed 3.125, scaling 0.0625)
    speedRef.current = 3.125 + scoreRef.current * 0.0625;

    loopRef.current = requestAnimationFrame(gameLoop);
  }, [endGame, spawnBeam, removeBeam]);

  const startGame = () => {
    activeRef.current = true;
    scoreRef.current = 0;
    livesRef.current = 3;
    speedRef.current = 3.125;
    setScore(0);
    setLives(3);
    setTopColorIdx(0);
    currentAngle.current = 0;
    wheelRotation.setValue(0);
    spawnCooldownRef.current = 0; // Spawn first ball immediately
    measureGameArea();

    // Clean up existing beam animations
    beamsRef.current.forEach(b => {
      b.yAnim.stopAnimation();
      b.yAnim.removeAllListeners();
    });
    beamsRef.current = [];
    setBeams([]);
    setPhase('playing');
    loopRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
      beamsRef.current.forEach(b => {
        b.yAnim.stopAnimation();
        b.yAnim.removeAllListeners();
      });
    };
  }, []);

  const titleOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const spinInterpolate = wheelRotation.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  });

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

  if (phase === 'ready') {
    return (
      <View style={s.container}>
        <A.View style={{ opacity: titleOpacity }}>
          <View style={s.titleRow}>
            <RefreshCw color="#FF00CC" size={26} />
            <Text style={s.gameTitle}>COLOR ORBIT</Text>
            <RefreshCw color="#FF00CC" size={26} />
          </View>
        </A.View>

        <View style={s.infoCard}>
          <Text style={s.infoHeading}>How to Play</Text>
          <Text style={s.infoText}>A color wheel sits in the center.</Text>
          <Text style={s.infoText}>
            Drag the wheel to rotate, or tap Left/Right sides to spin by 90°.
          </Text>
          <Text style={s.infoText}>Match the top segment's color with falling laser beams.</Text>
          <Text style={[s.infoText, { color: colors.gold, marginTop: 8 }]}>⚡ 3 shield matches total!</Text>
        </View>

        <TouchableOpacity style={s.startBtn} onPress={startGame} activeOpacity={0.8}>
          <Text style={s.startBtnText}>START ORBIT</Text>
          <ChevronRight color={colors.bgDeep} size={20} />
        </TouchableOpacity>

        <TouchableOpacity style={s.btnOutline} onPress={onClose}>
          <Text style={s.btnOutlineText}>Exit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'done') {
    return (
      <View style={s.container}>
        <A.View style={[s.resultCard, { transform: [{ scale: resultScale }] }]}>
          <View style={s.crashedRing}>
            <Text style={{ fontSize: 38 }}>🌀💥</Text>
          </View>
          <Text style={s.resultTitle}>ORBIT DISSOLVED!</Text>
          <Text style={s.resultScore}>{score}</Text>
          <Text style={s.resultLabel}>LASERS HARNESSED</Text>
        </A.View>

        <TouchableOpacity style={s.startBtn} onPress={onPlayAgain || startGame} activeOpacity={0.8}>
          <Text style={s.startBtnText}>SPIN AGAIN</Text>
          <ChevronRight color={colors.bgDeep} size={20} />
        </TouchableOpacity>
        <TouchableOpacity style={s.btnOutline} onPress={onClose}>
          <Text style={s.btnOutlineText}>Exit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* HUD */}
      <View style={s.hud}>
        <View style={s.hudLeft}>
          <Text style={s.hudScore}>{score}</Text>
          <Text style={s.hudScoreLabel}>HARNESSED</Text>
        </View>
        <View style={s.healthRow}>
          {[...Array(3)].map((_, i) => (
            <View
              key={i}
              style={[
                s.healthBlock,
                { backgroundColor: i < lives ? '#FF00CC' : 'rgba(255,255,255,0.08)' },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Game area with left/right touch zones / dragging */}
      <View
        style={s.gameArea}
        ref={gameAreaRef}
        onLayout={onLayout}
        {...panResponder.panHandlers}
      >
        {/* Falling beams */}
        {beams.map(b => (
          <A.View
            key={b.id}
            style={[
              s.beam,
              {
                left: CENTER_X - BEAM_SIZE / 2,
                top: -BEAM_SIZE / 2,
                transform: [{ translateY: b.yAnim }],
                backgroundColor: COLORS[b.colorIdx],
                shadowColor: COLORS[b.colorIdx],
              },
            ]}
            pointerEvents="none"
          />
        ))}

        {/* Target Orbit Wheel */}
        <A.View
          style={[
            s.orbitWheel,
            {
              left: CENTER_X - WHEEL_SIZE / 2,
              top: CENTER_Y - WHEEL_SIZE / 2,
              transform: [{ rotate: spinInterpolate }],
            },
          ]}
          pointerEvents="none"
        >
          {/* Segment 0 (Top / Magenta) */}
          <View style={[s.wheelSegment, { backgroundColor: COLORS[0], top: 0, left: WHEEL_SIZE/2 - 15 }]} />
          {/* Segment 1 (Right / Cyan) */}
          <View style={[s.wheelSegment, { backgroundColor: COLORS[1], top: WHEEL_SIZE/2 - 15, right: 0 }]} />
          {/* Segment 2 (Bottom / Gold) */}
          <View style={[s.wheelSegment, { backgroundColor: COLORS[2], bottom: 0, left: WHEEL_SIZE/2 - 15 }]} />
          {/* Segment 3 (Left / Purple) */}
          <View style={[s.wheelSegment, { backgroundColor: COLORS[3], top: WHEEL_SIZE/2 - 15, left: 0 }]} />

          {/* Core ring */}
          <View style={s.wheelCore} />
        </A.View>

        {/* Left/Right Action Hints */}
        <View style={s.hintContainer} pointerEvents="none">
          <Text style={s.hintText}>◀ TAP LEFT OR DRAG WHEEL</Text>
          <Text style={s.hintText}>TAP RIGHT OR DRAG WHEEL ▶</Text>
        </View>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gameTitle: {
    color: '#FF00CC', fontSize: 30, fontWeight: '900', letterSpacing: 4,
    textShadowColor: 'rgba(255,0,204,0.6)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10,
  },
  infoCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: 18,
    borderWidth: 1, borderColor: colors.border,
    width: Math.min(SW - 64, 340), alignItems: 'center', gap: 5,
  },
  infoHeading: { color: colors.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  infoText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FF00CC', paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: radius.full,
    shadowColor: '#FF00CC', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 12, elevation: 8,
  },
  startBtnText: { color: colors.bgDeep, fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  btnOutline: {
    borderWidth: 1.5, borderColor: colors.border, paddingVertical: 10,
    paddingHorizontal: spacing.xl, borderRadius: radius.full,
  },
  btnOutlineText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },

  hud: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: GW, marginBottom: 4,
  },
  hudLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  hudScore: { color: '#FF00CC', fontSize: 26, fontWeight: '900' },
  hudScoreLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  healthRow: { flexDirection: 'row', gap: 4 },
  healthBlock: { width: 18, height: 8, borderRadius: 2 },

  gameArea: {
    width: GW, height: GH,
    backgroundColor: '#0B040A',
    borderRadius: radius.lg, borderWidth: 2, borderColor: '#3A1A34',
    overflow: 'hidden', position: 'relative',
  },
  leftZone: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: GW / 2,
    zIndex: 10,
  },
  rightZone: {
    position: 'absolute',
    right: 0, top: 0, bottom: 0,
    width: GW / 2,
    zIndex: 10,
  },
  beam: {
    position: 'absolute',
    width: BEAM_SIZE, height: BEAM_SIZE,
    borderRadius: BEAM_SIZE / 2,
  },
  orbitWheel: {
    position: 'absolute',
    width: WHEEL_SIZE, height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  wheelSegment: {
    position: 'absolute',
    width: 30, height: 30,
    borderRadius: 15,
  },
  wheelCore: {
    width: 24, height: 24,
    borderRadius: 12,
    backgroundColor: '#111',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
  },
  hintContainer: {
    position: 'absolute',
    bottom: 15, left: 10, right: 10,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  hintText: {
    color: '#FF00CC', fontSize: 10, fontWeight: '800', letterSpacing: 0.5, opacity: 0.45,
  },
  resultCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 26,
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border,
    width: Math.min(SW - 64, 340), ...shadow.card,
  },
  crashedRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,0,204,0.08)',
    borderWidth: 2, borderColor: '#FF00CC',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  resultTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  resultScore: { color: '#FF00CC', fontSize: 52, fontWeight: '900' },
  resultLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
});
