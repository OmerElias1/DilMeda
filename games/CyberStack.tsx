import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated as A, Easing } from 'react-native';
import { Zap, ChevronRight, Layers } from 'lucide-react-native';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';

const { width: SW } = Dimensions.get('window');
const GW = Math.min(SW - 32, 380);
const GH = 480;

type Block = { id: number; y: number; x: number; w: number; color: string };
type Props = { onClose: () => void; onPlayAgain?: () => void };

const PALETTE = ['#FF0055', '#FF5500', '#FFCC00', '#00FF66', '#00CCFF', '#9900FF'];

export default function CyberStack({ onClose, onPlayAgain }: Props) {
  const { endGameSession } = useAuth();
  const { isExpired } = useTournament();

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [score, setScore] = useState(0);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [combo, setCombo] = useState(0);

  // Refs for loop & physics
  const blocksRef = useRef<Block[]>([]);
  const currentBlockX = useRef(0);
  const currentBlockW = useRef(160);
  const dirRef = useRef(1); // 1 = right, -1 = left
  const scoreRef = useRef(0);
  const speedRef = useRef(3.5);
  const activeRef = useRef(false);
  const loopRef = useRef<number | null>(null);

  const tickRef = useRef(0);
  const frameSkipCS = useRef(0);

  // Animations
  const glowAnim = useRef(new A.Value(0)).current;
  const cameraY = useRef(new A.Value(0)).current;
  const resultScale = useRef(new A.Value(0)).current;
  // Native-driven X for the active moving block (avoids setState on every frame)
  const activeBlockX = useRef(new A.Value(0)).current;

  // Setup loop animations - only on ready screen
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

  const dropBlock = useCallback(() => {
    if (!activeRef.current || blocksRef.current.length === 0) return;

    const currentIdx = blocksRef.current.length - 1;
    const cur = blocksRef.current[currentIdx];
    const prev = blocksRef.current[currentIdx - 1];

    let nextW = cur.w;
    let nextX = cur.x;
    let gameOver = false;

    if (prev) {
      const leftEdge = cur.x;
      const rightEdge = cur.x + cur.w;
      const prevLeft = prev.x;
      const prevRight = prev.x + prev.w;

      // Check overlap
      const overlapLeft = Math.max(leftEdge, prevLeft);
      const overlapRight = Math.min(rightEdge, prevRight);
      const overlapW = overlapRight - overlapLeft;

      if (overlapW <= 0) {
        gameOver = true;
      } else {
        // Perfect match check (within 4px)
        const diff = Math.abs(cur.x - prev.x);
        if (diff < 4) {
          nextX = prev.x;
          nextW = prev.w;
          setCombo(c => c + 1);
        } else {
          // Slice the overhang
          setCombo(0);
          nextX = overlapLeft;
          nextW = overlapW;

        }
      }
    }

    if (gameOver) {
      endGame();
      return;
    }

    // Lock block in place
    blocksRef.current[currentIdx] = { ...cur, x: nextX, w: nextW };
    currentBlockW.current = nextW;

    scoreRef.current++;
    setScore(scoreRef.current);

    // Increase speed slightly
    speedRef.current = Math.min(8.0, 3.5 + scoreRef.current * 0.12);

    // Pan camera down to follow stack
    const targetCamY = scoreRef.current * 28;
    A.timing(cameraY, { toValue: targetCamY, duration: 250, useNativeDriver: true }).start();

    // Spawn new block on top
    const nextY = GH - 70 - (blocksRef.current.length * 28);
    const color = PALETTE[blocksRef.current.length % PALETTE.length];
    const newBlock: Block = {
      id: blocksRef.current.length,
      y: nextY,
      x: 0,
      w: nextW,
      color,
    };

    currentBlockX.current = 0;
    activeBlockX.setValue(0);
    dirRef.current = 1;
    blocksRef.current.push(newBlock);
    // Only re-render locked blocks; active block moves via Animated.Value
    setBlocks(blocksRef.current.slice(0, -1));
  }, [endGame]);

  const gameLoop = useCallback(() => {
    if (!activeRef.current) return;

    // Throttle to ~30fps
    frameSkipCS.current = (frameSkipCS.current + 1) % 2;
    if (frameSkipCS.current !== 0) {
      loopRef.current = requestAnimationFrame(gameLoop);
      return;
    }
    tickRef.current++;

    // 1. Move active block
    if (blocksRef.current.length > 0) {
      const activeIdx = blocksRef.current.length - 1;
      const cur = blocksRef.current[activeIdx];
      let nx = currentBlockX.current + dirRef.current * speedRef.current;

      // Bound checks
      if (nx + cur.w >= GW) {
        nx = GW - cur.w;
        dirRef.current = -1;
      } else if (nx <= 0) {
        nx = 0;
        dirRef.current = 1;
      }

      currentBlockX.current = nx;
      blocksRef.current[activeIdx] = { ...cur, x: nx };
      // Drive X via native Animated.Value — zero React re-renders
      activeBlockX.setValue(nx);
    }



    loopRef.current = requestAnimationFrame(gameLoop);
  }, []);

  const startGame = () => {
    activeRef.current = true;
    scoreRef.current = 0;
    setScore(0);
    setCombo(0);
    currentBlockW.current = 150;
    cameraY.setValue(0);

    // Base block
    const baseBlock: Block = {
      id: 0,
      y: GH - 70,
      x: (GW - 150) / 2,
      w: 150,
      color: '#FFFFFF',
    };

    // First moving block
    const movingBlock: Block = {
      id: 1,
      y: GH - 70 - 28,
      x: 0,
      w: 150,
      color: PALETTE[1],
    };

    currentBlockX.current = 0;
    activeBlockX.setValue(0);
    dirRef.current = 1;
    speedRef.current = 3.5;
    blocksRef.current = [baseBlock, movingBlock];
    // Render only the base (locked) block; movingBlock rendered via activeBlockX
    setBlocks([baseBlock]);

    setPhase('playing');
    loopRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
    };
  }, []);

  const titleOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

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
            <Layers color="#FF0055" size={26} />
            <Text style={s.gameTitle}>CYBER STACK</Text>
            <Layers color="#FF0055" size={26} />
          </View>
        </A.View>

        <View style={s.infoCard}>
          <Text style={s.infoHeading}>How to Play</Text>
          <Text style={s.infoText}>
            <Text style={{ color: '#FF0055', fontWeight: '800' }}>Tap the screen</Text> to place the block.
          </Text>
          <Text style={s.infoText}>Align it perfectly with the block below it.</Text>
          <Text style={s.infoText}>Overhanging parts get sliced away!</Text>
          <Text style={[s.infoText, { color: colors.gold, marginTop: 8 }]}>⚡ Speed increases as you build!</Text>
        </View>

        <TouchableOpacity style={s.startBtn} onPress={startGame} activeOpacity={0.8}>
          <Text style={s.startBtnText}>START STACKING</Text>
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
            <Text style={{ fontSize: 38 }}>💥</Text>
          </View>
          <Text style={s.resultTitle}>TOPPLED!</Text>
          <Text style={s.resultScore}>{score}</Text>
          <Text style={s.resultLabel}>LAYERS STACKED</Text>
        </A.View>

        <TouchableOpacity style={s.startBtn} onPress={onPlayAgain || startGame} activeOpacity={0.8}>
          <Text style={s.startBtnText}>STACK AGAIN</Text>
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
          <Text style={s.hudScoreLabel}>LAYERS</Text>
        </View>
        {combo > 0 && (
          <View style={s.comboBadge}>
            <Zap color="#FFCC00" size={11} fill="#FFCC00" />
            <Text style={s.comboText}>{combo} COMBO</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={s.gameArea}
        onPress={dropBlock}
        activeOpacity={1}
      >
        <A.View style={{ transform: [{ translateY: cameraY }], flex: 1 }}>
          {/* Static locked blocks */}
          {blocks.map(b => (
            <View
              key={b.id}
              style={[
                s.block,
                {
                  left: b.x,
                  top: b.y,
                  width: b.w,
                  backgroundColor: b.color,
                },
              ]}
            />
          ))}

          {/* Active moving block — rendered via Animated.Value to avoid setState */}
          {blocksRef.current.length > 0 && (() => {
            const ab = blocksRef.current[blocksRef.current.length - 1];
            return (
              <A.View
                style={[
                  s.block,
                  {
                    top: ab.y,
                    width: ab.w,
                    backgroundColor: ab.color,
                    transform: [{ translateX: activeBlockX }],
                  },
                ]}
              />
            );
          })()}

        </A.View>
      </TouchableOpacity>
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
    color: '#FF0055', fontSize: 30, fontWeight: '900', letterSpacing: 4,
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
    backgroundColor: '#FF0055', paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: radius.full,
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
  hudScore: { color: '#FF0055', fontSize: 26, fontWeight: '900' },
  hudScoreLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  comboBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,204,0,0.1)', borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,204,0,0.25)',
  },
  comboText: { color: '#FFCC00', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  gameArea: {
    width: GW, height: GH,
    backgroundColor: '#0A050B',
    borderRadius: radius.lg, borderWidth: 2, borderColor: '#3A1A2E',
    overflow: 'hidden', position: 'relative',
  },
  block: {
    position: 'absolute',
    height: 26,
    borderRadius: 3,
  },
  debris: {
    position: 'absolute',
    height: 26,
    borderRadius: 3,
  },
  resultCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 26,
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border,
    width: Math.min(SW - 64, 340), ...shadow.card,
  },
  crashedRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,0,85,0.08)',
    borderWidth: 2, borderColor: '#FF0055',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  resultTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  resultScore: { color: '#FF0055', fontSize: 52, fontWeight: '900' },
  resultLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
});
