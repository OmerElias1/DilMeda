import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated as A, Easing } from 'react-native';
import { Zap, ChevronRight, Music } from 'lucide-react-native';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';

const { width: SW } = Dimensions.get('window');
const GW = Math.min(SW - 32, 380);
const GH = 480;

const LANE_X = [GW * 0.17, GW * 0.39, GW * 0.61, GW * 0.83];
const TARGET_Y = GH - 75;
const NOTE_SIZE = 36;
const TARGET_SIZE = 50;

type LaneIndex = 0 | 1 | 2 | 3;
type Note = {
  id: number;
  lane: LaneIndex;
  yAnim: A.Value;
  yRef: { current: number };
  hit: boolean;
  miss: boolean;
};
type Feedback = { id: number; text: string; color: string; scale: A.Value };
type Props = { onClose: () => void; onPlayAgain?: () => void };

const COLORS = ['#00FFCC', '#FF00CC', '#FFCC00', '#A924FF'];

export default function RhythmPulse({ onClose, onPlayAgain }: Props) {
  const { endGameSession } = useAuth();
  const { isExpired } = useTournament();

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(5);
  const [combo, setCombo] = useState(0);
  const [notes, setNotes] = useState<Note[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);

  // Refs for loop
  const notesRef = useRef<Note[]>([]);
  const scoreRef = useRef(0);
  const healthRef = useRef(5);
  const comboRef = useRef(0);
  const activeRef = useRef(false);
  const loopRef = useRef<number | null>(null);
  const tickRef = useRef(0);
  const idRef = useRef(0);
  const speedRef = useRef(4.0);

  const glowAnim = useRef(new A.Value(0)).current;
  const resultScale = useRef(new A.Value(0)).current;

  // Title glow pulse - only on ready screen
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

  const showFeedback = (text: string, color: string) => {
    const scale = new A.Value(0.5);
    const newFb = { id: Date.now(), text, color, scale };
    setFeedbacks(prev => [...prev, newFb]);
    A.spring(scale, { toValue: 1.2, friction: 3, tension: 100, useNativeDriver: true }).start(() => {
      setTimeout(() => {
        setFeedbacks(prev => prev.filter(f => f.id !== newFb.id));
      }, 400);
    });
  };

  const removeNote = useCallback((id: number) => {
    const note = notesRef.current.find(n => n.id === id);
    if (note) {
      note.yAnim.stopAnimation();
      note.yAnim.removeAllListeners();
    }
    notesRef.current = notesRef.current.filter(n => n.id !== id);
    setNotes([...notesRef.current]);
  }, []);

  const spawnNote = useCallback((lane: LaneIndex) => {
    const id = idRef.current++;
    const yAnim = new A.Value(-20);
    const yRef = { current: -20 };
    const listenerId = yAnim.addListener(({ value }) => {
      yRef.current = value;
    });

    const newNote: Note = {
      id,
      lane,
      yAnim,
      yRef,
      hit: false,
      miss: false,
    };

    const distance = (GH + 50) - (-20);
    const duration = (distance / speedRef.current) * 16.67;

    notesRef.current.push(newNote);
    setNotes([...notesRef.current]);

    A.timing(yAnim, {
      toValue: GH + 50,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(({ finished }) => {
      yAnim.removeListener(listenerId);
      if (finished) {
        if (!newNote.hit && !newNote.miss) {
          newNote.miss = true;
          comboRef.current = 0;
          setCombo(0);
          healthRef.current--;
          setHealth(healthRef.current);
          showFeedback('MISS', '#FF00CC');
          if (healthRef.current <= 0) endGame();
          removeNote(id);
        }
      }
    });
  }, [endGame, removeNote]);

  const tapLane = useCallback((lane: LaneIndex) => {
    if (!activeRef.current) return;

    // Find the closest active unhit note in this lane
    const laneNotes = notesRef.current.filter(n => n.lane === lane && !n.hit && !n.miss);
    if (laneNotes.length === 0) return;

    // Sort by yRef.current descending (closest to target)
    laneNotes.sort((a, b) => b.yRef.current - a.yRef.current);
    const targetNote = laneNotes[0];

    const dist = Math.abs(targetNote.yRef.current - TARGET_Y);

    if (dist < 18) {
      // Perfect
      targetNote.hit = true;
      comboRef.current++;
      setCombo(comboRef.current);
      scoreRef.current += 10 + Math.floor(comboRef.current / 5);
      setScore(scoreRef.current);
      showFeedback('PERFECT!', '#00FFCC');
      removeNote(targetNote.id);
    } else if (dist < 38) {
      // Good
      targetNote.hit = true;
      comboRef.current++;
      setCombo(comboRef.current);
      scoreRef.current += 5;
      setScore(scoreRef.current);
      showFeedback('GOOD!', '#FFCC00');
      removeNote(targetNote.id);
    } else {
      // Early/Late Miss
      comboRef.current = 0;
      setCombo(0);
      healthRef.current--;
      setHealth(healthRef.current);
      showFeedback('TOO EARLY!', '#FF00CC');
      if (healthRef.current <= 0) endGame();
    }
  }, [endGame, removeNote]);

  const frameSkipRP = useRef(0);
  const gameLoop = useCallback(() => {
    if (!activeRef.current) return;

    // Throttle to ~30fps
    frameSkipRP.current = (frameSkipRP.current + 1) % 2;
    if (frameSkipRP.current !== 0) {
      loopRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    tickRef.current++;

    // Spawn notes
    const spawnRate = Math.max(14, 30 - Math.floor(scoreRef.current / 30) * 2);
    if (tickRef.current % spawnRate === 0) {
      const lane = Math.floor(Math.random() * 4) as LaneIndex;
      spawnNote(lane);
    }

    // Check for passed notes every 3 logic ticks
    if (tickRef.current % 3 === 0) {
      notesRef.current.forEach(n => {
        if (!n.hit && !n.miss) {
          if (n.yRef.current > TARGET_Y + 40) {
            n.miss = true;
            comboRef.current = 0;
            setCombo(0);
            healthRef.current--;
            setHealth(healthRef.current);
            showFeedback('MISS', '#FF00CC');
            if (healthRef.current <= 0) endGame();
            removeNote(n.id);
          }
        }
      });
    }

    // Speed scaling
    speedRef.current = 4.0 + scoreRef.current * 0.04;

    loopRef.current = requestAnimationFrame(gameLoop);
  }, [endGame, spawnNote, removeNote]);

  const startGame = () => {
    activeRef.current = true;
    scoreRef.current = 0;
    healthRef.current = 5;
    comboRef.current = 0;
    speedRef.current = 4.0;
    setScore(0);
    setHealth(5);
    setCombo(0);
    
    // Clean up existing note animations
    notesRef.current.forEach(n => {
      n.yAnim.stopAnimation();
      n.yAnim.removeAllListeners();
    });
    notesRef.current = [];
    setNotes([]);
    setFeedbacks([]);
    setPhase('playing');
    loopRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
      notesRef.current.forEach(n => {
        n.yAnim.stopAnimation();
        n.yAnim.removeAllListeners();
      });
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
            <Music color="#00FFCC" size={26} />
            <Text style={s.gameTitle}>RHYTHM PULSE</Text>
            <Music color="#00FFCC" size={26} />
          </View>
        </A.View>

        <View style={s.infoCard}>
          <Text style={s.infoHeading}>How to Play</Text>
          <Text style={s.infoText}>Notes fall down four neon lanes.</Text>
          <Text style={s.infoText}>
            <Text style={{ color: '#00FFCC', fontWeight: '800' }}>Tap the lanes</Text> as the rings match up.
          </Text>
          <Text style={s.infoText}>Score bonus points with high combos!</Text>
          <Text style={[s.infoText, { color: colors.gold, marginTop: 8 }]}>⚡ Avoid misses — you only have 5 shields!</Text>
        </View>

        <TouchableOpacity style={s.startBtn} onPress={startGame} activeOpacity={0.8}>
          <Text style={s.startBtnText}>START TAPING</Text>
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
            <Text style={{ fontSize: 38 }}>🔇</Text>
          </View>
          <Text style={s.resultTitle}>OUT OF SYNC!</Text>
          <Text style={s.resultScore}>{score}</Text>
          <Text style={s.resultLabel}>POINTS EARNED</Text>
        </A.View>

        <TouchableOpacity style={s.startBtn} onPress={onPlayAgain || startGame} activeOpacity={0.8}>
          <Text style={s.startBtnText}>TAP AGAIN</Text>
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
          <Text style={s.hudScoreLabel}>SCORE</Text>
        </View>
        <View style={s.healthRow}>
          {[...Array(5)].map((_, i) => (
            <View
              key={i}
              style={[
                s.healthBlock,
                { backgroundColor: i < health ? '#00FFCC' : 'rgba(255,255,255,0.08)' },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Game area */}
      <View style={s.gameArea}>
        {/* Lanes backdrop */}
        {LANE_X.map((lx, idx) => (
          <View
            key={idx}
            style={[
              s.laneLine,
              { left: lx - 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.05)' },
            ]}
          />
        ))}

        {/* Notes */}
        {notes.map(n => (
          <A.View
            key={n.id}
            style={[
              s.note,
              {
                left: LANE_X[n.lane] - NOTE_SIZE / 2,
                top: -NOTE_SIZE / 2,
                transform: [{ translateY: n.yAnim }],
                backgroundColor: COLORS[n.lane],
                shadowColor: COLORS[n.lane],
              },
            ]}
          />
        ))}

        {/* Floating feedback text */}
        {feedbacks.map(f => (
          <A.View
            key={f.id}
            style={[
              s.feedbackWrapper,
              { transform: [{ scale: f.scale }] },
            ]}
          >
            <Text style={[s.feedbackText, { color: f.color }]}>{f.text}</Text>
          </A.View>
        ))}

        {/* Targets pads */}
        {LANE_X.map((lx, idx) => (
          <TouchableOpacity
            key={idx}
            style={[
              s.targetCircle,
              {
                left: lx - TARGET_SIZE / 2,
                top: TARGET_Y - TARGET_SIZE / 2,
                borderColor: COLORS[idx],
                backgroundColor: 'rgba(0,0,0,0.4)',
              },
            ]}
            onPressIn={() => tapLane(idx as LaneIndex)}
            activeOpacity={0.6}
          >
            <View style={[s.targetInner, { backgroundColor: COLORS[idx], opacity: 0.15 }]} />
          </TouchableOpacity>
        ))}
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
    color: '#00FFCC', fontSize: 30, fontWeight: '900', letterSpacing: 4,
    textShadowColor: 'rgba(0,255,204,0.6)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10,
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
    backgroundColor: '#00FFCC', paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: radius.full,
    shadowColor: '#00FFCC', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 12, elevation: 8,
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
  hudScore: { color: '#00FFCC', fontSize: 26, fontWeight: '900' },
  hudScoreLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  healthRow: { flexDirection: 'row', gap: 4 },
  healthBlock: { width: 14, height: 8, borderRadius: 2 },

  gameArea: {
    width: GW, height: GH,
    backgroundColor: '#040B0A',
    borderRadius: radius.lg, borderWidth: 2, borderColor: '#1A3A35',
    overflow: 'hidden', position: 'relative',
  },
  laneLine: {
    position: 'absolute',
    top: 0, bottom: 0,
    borderWidth: 1,
  },
  note: {
    position: 'absolute',
    width: NOTE_SIZE, height: NOTE_SIZE,
    borderRadius: NOTE_SIZE / 2,
  },
  targetCircle: {
    position: 'absolute',
    width: TARGET_SIZE, height: TARGET_SIZE,
    borderRadius: TARGET_SIZE / 2,
    borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  targetInner: {
    width: TARGET_SIZE - 10, height: TARGET_SIZE - 10,
    borderRadius: (TARGET_SIZE - 10) / 2,
  },
  feedbackWrapper: {
    position: 'absolute',
    top: GH * 0.4,
    left: 0, right: 0,
    alignItems: 'center',
  },
  feedbackText: {
    fontSize: 22, fontWeight: '900', letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3,
  },
  resultCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 26,
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border,
    width: Math.min(SW - 64, 340), ...shadow.card,
  },
  crashedRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(0,255,204,0.08)',
    borderWidth: 2, borderColor: '#00FFCC',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  resultTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  resultScore: { color: '#00FFCC', fontSize: 52, fontWeight: '900' },
  resultLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
});
