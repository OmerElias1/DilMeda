import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated
} from 'react-native';
import { Brain, Gamepad2, Trophy, Lightbulb, Star, Heart, Zap, Music } from 'lucide-react-native';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';

type Props = {
  onClose: () => void;
  onPlayAgain?: () => void;
};

const ICON_COMPONENTS = [Trophy, Lightbulb, Brain, Gamepad2, Star, Heart, Zap, Music];

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

type Card = {
  id: number;
  value: number;
  flipped: boolean;
  matched: boolean;
};

function makeCards(): Card[] {
  const pairs = Array.from({ length: ICON_COMPONENTS.length }, (_, i) => i).flatMap(i => [i, i]);
  return shuffle(pairs).map((v, i) => ({ id: i, value: v, flipped: false, matched: false }));
}

export default function MemoryMatch({ onClose, onPlayAgain }: Props) {
  const { endGameSession } = useAuth();
  const { isExpired } = useTournament();
  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [cards, setCards] = useState<Card[]>(makeCards());
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [locked, setLocked] = useState(false);

  const startGame = () => {
    setCards(makeCards());
    setSelected([]);
    setMoves(0);
    setMatches(0);
    setLocked(false);
    setPhase('playing');
  };

  const calcPoints = (mv: number, matched: number) => {
    const base = matched * 5;
    const bonus = Math.max(0, 50 - mv * 2);
    return base + bonus;
  };

  const handleCardPress = useCallback((idx: number) => {
    if (locked || cards[idx].flipped || cards[idx].matched) return;

    const newCards = cards.map((c, i) => i === idx ? { ...c, flipped: true } : c);
    setCards(newCards);

    const newSel = [...selected, idx];
    setSelected(newSel);

    if (newSel.length === 2) {
      setMoves(m => m + 1);
      setLocked(true);
      const [a, b] = newSel;
      if (newCards[a].value === newCards[b].value) {
        const afterMatch = newCards.map((c, i) =>
          i === a || i === b ? { ...c, matched: true } : c
        );
        setTimeout(() => {
          setCards(afterMatch);
          setSelected([]);
          setLocked(false);
          const newMatches = matches + 1;
          setMatches(newMatches);
          if (newMatches === ICON_COMPONENTS.length) {
            setPhase('done');
            const pts = calcPoints(moves + 1, newMatches);
            (async () => {
              await endGameSession(pts);
            })();
          }
        }, 500);
      } else {
        setTimeout(() => {
          setCards(newCards.map((c, i) =>
            i === a || i === b ? { ...c, flipped: false } : c
          ));
          setSelected([]);
          setLocked(false);
        }, 900);
      }
    }
  }, [cards, selected, locked, matches, moves, endGameSession]);

  const pts = calcPoints(moves, matches);

  if (isExpired) {
    return (
      <View style={styles.container}>
        <Text style={styles.expiredText}>Tournament ended!</Text>
        <TouchableOpacity style={styles.btnOutline} onPress={onClose}><Text style={styles.btnOutlineText}>Close</Text></TouchableOpacity>
      </View>
    );
  }

  if (phase === 'ready') {
    return (
      <View style={styles.container}>
        <Text style={styles.gameTitle}>MEMORY MATCH</Text>
        <Text style={styles.gameSub}>Find all matching pairs</Text>
        <Text style={styles.gameSub}>Fewer moves = more bonus points!</Text>
        <View style={styles.previewGrid}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={styles.previewCard}>
              <Text style={styles.cardBack}>?</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.btnGold} onPress={startGame}>
          <Text style={styles.btnGoldText}>Start Game</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'done') {
    return (
      <View style={styles.container}>
        <Brain color={colors.gold} size={56} />
        <Text style={styles.resultTitle}>All Matched!</Text>
        <Text style={styles.resultScore}>{moves} Moves</Text>
        <Text style={styles.resultPoints}>+{pts} Points Earned!</Text>
        <TouchableOpacity style={styles.btnGold} onPress={onPlayAgain || startGame}><Text style={styles.btnGoldText}>Play Again</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnOutline} onPress={onClose}><Text style={styles.btnOutlineText}>Exit</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.hud}>
        <View style={styles.hudBox}>
          <Text style={styles.hudLabel}>MOVES</Text>
          <Text style={styles.hudValue}>{moves}</Text>
        </View>
        <View style={styles.hudBox}>
          <Text style={styles.hudLabel}>MATCHES</Text>
          <Text style={styles.hudValue}>{matches}/{ICON_COMPONENTS.length}</Text>
        </View>
      </View>
      <View style={styles.grid}>
        {cards.map((card, idx) => (
          <TouchableOpacity
            key={card.id}
            style={[
              styles.card,
              card.matched && styles.cardMatched,
              card.flipped && !card.matched && styles.cardFlipped,
            ]}
            onPress={() => handleCardPress(idx)}
            activeOpacity={0.8}
          >
            {card.flipped || card.matched ? (
              React.createElement(ICON_COMPONENTS[card.value], {
                color: colors.gold,
                size: 24,
              })
            ) : (
              <Text style={styles.cardBack}>?</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center',
    gap: spacing.md, padding: spacing.md,
  },
  expiredText: { color: colors.error, fontSize: 16, textAlign: 'center', fontWeight: '600' },
  gameTitle: {
    color: colors.gold, fontSize: 26, fontWeight: '900', letterSpacing: 3,
  },
  gameSub: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  hud: { flexDirection: 'row', gap: spacing.lg, marginBottom: 4 },
  hudBox: {
    backgroundColor: colors.bgCard, borderRadius: radius.sm, padding: spacing.sm,
    alignItems: 'center', minWidth: 80, borderWidth: 1, borderColor: colors.border,
  },
  hudLabel: { color: colors.textMuted, fontSize: 9, letterSpacing: 2, fontWeight: '700' },
  hudValue: { color: colors.gold, fontSize: 20, fontWeight: '900' },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', width: 312, gap: 8,
    justifyContent: 'center',
  },
  card: {
    width: 68, height: 68, borderRadius: radius.md,
    backgroundColor: colors.bgCard, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cardFlipped: { borderColor: colors.gold, backgroundColor: colors.bgCardLight },
  cardMatched: { borderColor: colors.neon, backgroundColor: 'rgba(0,255,204,0.1)' },
  cardBack: { color: colors.textMuted, fontSize: 22, fontWeight: '800' },
  previewGrid: { flexDirection: 'row', gap: 8, marginVertical: spacing.md },
  previewCard: {
    width: 60, height: 60, borderRadius: radius.md,
    backgroundColor: colors.bgCard, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  resultTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: '800' },
  resultScore: { color: colors.gold, fontSize: 42, fontWeight: '900' },
  resultPoints: { color: colors.neon, fontSize: 16, fontWeight: '700' },
  btnGold: {
    backgroundColor: colors.gold, paddingVertical: 14, paddingHorizontal: spacing.xl,
    borderRadius: radius.full, ...shadow.gold,
  },
  btnGoldText: { color: colors.bgDeep, fontSize: 15, fontWeight: '800' },
  btnOutline: {
    borderWidth: 1.5, borderColor: colors.border, paddingVertical: 12,
    paddingHorizontal: spacing.xl, borderRadius: radius.full,
  },
  btnOutlineText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
});
