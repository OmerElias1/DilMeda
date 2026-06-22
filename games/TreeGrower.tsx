import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, Modal, Dimensions,
} from 'react-native';
import { Droplets, Leaf, Star, Zap, Eye, ChevronRight } from 'lucide-react-native';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';
import { supabase } from '@/lib/supabase';
import AdPlayer from '@/components/AdPlayer';

type Props = { onClose: () => void };

const MAX_HEIGHT = 20;
const FREE_WATERS_PER_DAY = 5;
const POINTS_PER_LEVEL = 3;
const { width: SW } = Dimensions.get('window');

function getTreeLabel(h: number) {
  if (h === 0) return 'Bare Soil';
  if (h < 3) return 'Seedling';
  if (h < 6) return 'Sprout';
  if (h < 10) return 'Young Tree';
  if (h < 15) return 'Full Tree';
  return 'Ancient Tree';
}

function getStageColor(h: number) {
  if (h === 0) return '#6B5A8E';
  if (h < 6) return '#00FF88';
  if (h < 15) return '#00CC66';
  return '#FFD700';
}

// ── Realistic Tree Component ──
function TreeVisual({ height }: { height: number }) {
  const pct = height / MAX_HEIGHT;
  const trunkH = 30 + pct * 70;
  const trunkW = 8 + pct * 14;
  const canopySize = 40 + pct * 120;
  const canopyLayers = height < 3 ? 0 : height < 6 ? 1 : height < 10 ? 2 : 3;

  if (height === 0) {
    return (
      <View style={tv.wrap}>
        <View style={tv.soil}>
          <View style={tv.soilLine} />
          <View style={[tv.soilLine, { width: 20, marginLeft: 30 }]} />
        </View>
      </View>
    );
  }

  if (height < 3) {
    return (
      <View style={tv.wrap}>
        <View style={[tv.sproutStem, { height: 20 + height * 10 }]} />
        <View style={[tv.sproutLeafL, { bottom: 14 + height * 8 }]} />
        <View style={[tv.sproutLeafR, { bottom: 10 + height * 6 }]} />
        <View style={tv.soil}>
          <View style={tv.soilLine} />
        </View>
      </View>
    );
  }

  return (
    <View style={tv.wrap}>
      {/* Trunk */}
      <View style={[tv.trunk, { height: trunkH, width: trunkW, borderRadius: trunkW / 3 }]}>
        <View style={[tv.trunkHighlight, { height: trunkH - 6 }]} />
        {height >= 10 && <View style={[tv.trunkKnot, { top: trunkH * 0.4 }]} />}
        {height >= 15 && <View style={[tv.trunkKnot, { top: trunkH * 0.7, left: trunkW - 8 }]} />}
      </View>

      {/* Branches for bigger trees */}
      {height >= 6 && (
        <>
          <View style={[tv.branch, { bottom: trunkH * 0.55, left: -canopySize * 0.2, width: canopySize * 0.3, transform: [{ rotate: '-30deg' }] }]} />
          <View style={[tv.branch, { bottom: trunkH * 0.65, right: -canopySize * 0.2, width: canopySize * 0.25, transform: [{ rotate: '25deg' }] }]} />
        </>
      )}

      {/* Canopy layers (back to front for depth) */}
      {canopyLayers >= 3 && (
        <View style={[tv.canopy, {
          width: canopySize * 1.1, height: canopySize * 0.7,
          bottom: trunkH - 10, backgroundColor: '#1B8A3E',
          borderRadius: canopySize * 0.4,
        }]} />
      )}
      {canopyLayers >= 2 && (
        <View style={[tv.canopy, {
          width: canopySize * 0.95, height: canopySize * 0.65,
          bottom: trunkH + 5, backgroundColor: '#22A849',
          borderRadius: canopySize * 0.35,
        }]} />
      )}
      {canopyLayers >= 1 && (
        <View style={[tv.canopy, {
          width: canopySize * 0.75, height: canopySize * 0.55,
          bottom: trunkH + 18, backgroundColor: '#2BBF56',
          borderRadius: canopySize * 0.3,
        }]} />
      )}

      {/* Top highlight */}
      {canopyLayers >= 1 && (
        <View style={[tv.canopyHighlight, {
          width: canopySize * 0.35, height: canopySize * 0.25,
          bottom: trunkH + canopySize * 0.3 + 10,
          backgroundColor: '#34D860',
          borderRadius: canopySize * 0.2,
        }]} />
      )}

      {/* Fruits/flowers for high-level trees */}
      {height >= 15 && (
        <>
          <View style={[tv.fruit, { bottom: trunkH + 20, left: -canopySize * 0.25 }]} />
          <View style={[tv.fruit, { bottom: trunkH + 40, right: -canopySize * 0.2 }]} />
          <View style={[tv.fruit, { bottom: trunkH + canopySize * 0.35, left: canopySize * 0.1 }]} />
        </>
      )}

      {/* Soil */}
      <View style={tv.soil}>
        <View style={tv.soilLine} />
        <View style={[tv.soilLine, { width: 14, marginLeft: 40 }]} />
      </View>
    </View>
  );
}

const tv = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-end', height: 260, position: 'relative' },
  trunk: { backgroundColor: '#6B4226', position: 'absolute', bottom: 16, zIndex: 2 },
  trunkHighlight: {
    position: 'absolute', right: 2, top: 3, width: 4,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2,
  },
  trunkKnot: {
    position: 'absolute', left: 3, width: 8, height: 5,
    backgroundColor: '#5A3520', borderRadius: 3,
  },
  branch: {
    position: 'absolute', height: 5, backgroundColor: '#6B4226',
    borderRadius: 3, zIndex: 1,
  },
  canopy: { position: 'absolute', zIndex: 3 },
  canopyHighlight: { position: 'absolute', zIndex: 4, opacity: 0.6 },
  groundShadow: {
    position: 'absolute', bottom: 8, height: 8,
    backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 100,
  },
  fruit: {
    position: 'absolute', width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#FF6B6B', zIndex: 5,
  },
  sproutStem: { width: 4, backgroundColor: '#22A849', borderRadius: 2, position: 'absolute', bottom: 16 },
  sproutLeafL: {
    position: 'absolute', left: -8, width: 14, height: 10,
    backgroundColor: '#2BBF56', borderRadius: 7,
    transform: [{ rotate: '-25deg' }],
  },
  sproutLeafR: {
    position: 'absolute', right: -10, width: 16, height: 11,
    backgroundColor: '#22A849', borderRadius: 8,
    transform: [{ rotate: '20deg' }],
  },
  soil: { position: 'absolute', bottom: 0, alignItems: 'center' },
  soilLine: { width: 40, height: 2, backgroundColor: '#5A3520', borderRadius: 1, marginTop: 2 },
});

// ── Main Component ──
export default function TreeGrower({ onClose }: Props) {
  const { user, addPoints } = useAuth();
  const { isExpired } = useTournament();

  const [treeHeight, setTreeHeight] = useState(0);
  const [waterCount, setWaterCount] = useState(0);
  const [watersUsedToday, setWatersUsedToday] = useState(0);
  const [lastWaterDate, setLastWaterDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [watering, setWatering] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);

  const treeAnim = useRef(new Animated.Value(1)).current;
  const dropAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pointsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
    return () => glowAnim.stopAnimation();
  }, []);

  const loadTreeData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('tree_height, water_count, waters_used_today, last_water_date')
        .eq('id', user.id)
        .single();

      if (data) {
        const today = new Date().toDateString();
        const storedDate = data.last_water_date
          ? new Date(data.last_water_date).toDateString()
          : null;

        if (storedDate !== today) {
          const newWaterCount = (data.water_count ?? 0) + FREE_WATERS_PER_DAY;
          await supabase.from('profiles').update({
            waters_used_today: 0,
            water_count: newWaterCount,
            last_water_date: new Date().toISOString(),
          }).eq('id', user.id);
          setWaterCount(newWaterCount);
          setWatersUsedToday(0);
          setLastWaterDate(new Date().toISOString());
        } else {
          setWaterCount(data.water_count ?? FREE_WATERS_PER_DAY);
          setWatersUsedToday(data.waters_used_today ?? 0);
          setLastWaterDate(data.last_water_date);
        }
        setTreeHeight(data.tree_height ?? 0);
      }
    } catch (e) {
      setWaterCount(FREE_WATERS_PER_DAY);
      setWatersUsedToday(0);
      setTreeHeight(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadTreeData(); }, [loadTreeData]);

  const animateWater = () =>
    new Promise<void>(resolve => {
      dropAnim.setValue(0);
      treeAnim.setValue(1);
      Animated.sequence([
        Animated.timing(dropAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(treeAnim, { toValue: 1.12, useNativeDriver: true, tension: 150, friction: 5 }),
        Animated.spring(treeAnim, { toValue: 1, useNativeDriver: true, tension: 150, friction: 5 }),
      ]).start(() => resolve());
    });

  const animatePoints = (pts: number) => {
    setPointsEarned(pts);
    pointsAnim.setValue(0);
    Animated.sequence([
      Animated.timing(pointsAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(pointsAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setPointsEarned(null));
  };

  const handleWater = async () => {
    if (!user || watering || isExpired) return;
    if (waterCount <= 0 || treeHeight >= MAX_HEIGHT) return;

    setWatering(true);
    await animateWater();

    const newH = treeHeight + 1;
    const newWC = waterCount - 1;
    const newWU = watersUsedToday + 1;
    const pts = newH * POINTS_PER_LEVEL;

    try {
      await supabase.from('profiles').update({
        tree_height: newH, water_count: newWC,
        waters_used_today: newWU, last_water_date: new Date().toISOString(),
      }).eq('id', user.id);
      await addPoints(pts);
      setTreeHeight(newH);
      setWaterCount(newWC);
      setWatersUsedToday(newWU);
      animatePoints(pts);
    } catch (e) { /* silent */ } finally { setWatering(false); }
  };

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.5] });
  const dropTranslate = dropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 100] });
  const dropOpacity = dropAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1, 0] });
  const pct = Math.min((treeHeight / MAX_HEIGHT) * 100, 100);
  const freeLeft = Math.max(0, FREE_WATERS_PER_DAY - watersUsedToday);
  const bonus = Math.max(0, waterCount - freeLeft);
  const stageColor = getStageColor(treeHeight);

  if (isExpired) {
    return (
      <View style={s.container}>
        <Text style={s.expiredText}>Tournament ended. Come back next time!</Text>
        <TouchableOpacity style={s.btnOutline} onPress={onClose}><Text style={s.btnOutlineText}>Close</Text></TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return <View style={s.container}><Text style={s.loadingText}>Loading your tree...</Text></View>;
  }

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Title */}
        <View style={s.titleRow}>
          <Leaf color={colors.gold} size={22} />
          <Text style={s.gameTitle}>TREE GROWER</Text>
          <Leaf color={colors.gold} size={22} />
        </View>
        <Text style={s.gameSub}>Water your tree daily to grow & earn points!</Text>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <View style={[s.statIconWrap, { backgroundColor: 'rgba(0,255,204,0.12)' }]}>
              <Droplets color={colors.neon} size={16} />
            </View>
            <Text style={s.statValue}>{waterCount}</Text>
            <Text style={s.statLabel}>WATER</Text>
          </View>
          <View style={s.statBox}>
            <View style={[s.statIconWrap, { backgroundColor: 'rgba(0,255,136,0.12)' }]}>
              <Leaf color={colors.success} size={16} />
            </View>
            <Text style={s.statValue}>{treeHeight}/{MAX_HEIGHT}</Text>
            <Text style={s.statLabel}>HEIGHT</Text>
          </View>
          <View style={s.statBox}>
            <View style={[s.statIconWrap, { backgroundColor: 'rgba(255,215,0,0.12)' }]}>
              <Star color={colors.gold} size={16} fill={colors.gold} />
            </View>
            <Text style={s.statValue}>{treeHeight * POINTS_PER_LEVEL}</Text>
            <Text style={s.statLabel}>POINTS</Text>
          </View>
        </View>

        {/* Tree Display */}
        <View style={s.treeArea}>
          {pointsEarned !== null && (
            <Animated.Text style={[s.pointsPopup, {
              opacity: pointsAnim,
              transform: [{ translateY: pointsAnim.interpolate({ inputRange: [0, 1], outputRange: [20, -20] }) }],
            }]}>+{pointsEarned} pts!</Animated.Text>
          )}

          <Animated.View style={[s.dropWrap, { opacity: dropOpacity, transform: [{ translateY: dropTranslate }] }]}>
            <Droplets color="#4FC3F7" size={28} />
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: treeAnim }] }}>
            <TreeVisual height={treeHeight} />
          </Animated.View>

          {/* Stage badge */}
          <View style={[s.stageBadge, { backgroundColor: stageColor + '20', borderColor: stageColor }]}>
            <Text style={[s.stageBadgeText, { color: stageColor }]}>{getTreeLabel(treeHeight)}</Text>
          </View>

          {/* Progress bar */}
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: `${pct}%`, backgroundColor: stageColor }]} />
          </View>
          <Text style={s.progressLabel}>
            {treeHeight >= MAX_HEIGHT ? '🏆 Max Height Reached!' : `${MAX_HEIGHT - treeHeight} more to max`}
          </Text>
        </View>

        {/* Daily waters */}
        <View style={s.dailyCard}>
          <Text style={s.dailyTitle}>Daily Free Waters</Text>
          <View style={s.dotsRow}>
            {Array.from({ length: FREE_WATERS_PER_DAY }).map((_, i) => (
              <View key={i} style={[s.dot, i < freeLeft ? s.dotActive : s.dotUsed]} />
            ))}
          </View>
          {bonus > 0 && (
            <View style={s.bonusRow}>
              <Zap color={colors.gold} size={13} fill={colors.gold} />
              <Text style={s.bonusText}>+{bonus} bonus waters from ads</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={[s.waterBtn, (waterCount <= 0 || treeHeight >= MAX_HEIGHT || watering) && s.btnDisabled]}
          onPress={handleWater}
          disabled={waterCount <= 0 || treeHeight >= MAX_HEIGHT || watering}
          activeOpacity={0.8}
        >
          <Droplets color={waterCount > 0 ? colors.bgDeep : colors.textMuted} size={20} />
          <Text style={[s.waterBtnText, waterCount <= 0 && { color: colors.textMuted }]}>
            {watering ? 'Watering...' : treeHeight >= MAX_HEIGHT ? 'Max Height!'
              : waterCount <= 0 ? 'No Water Left' : `Water Tree (+${(treeHeight + 1) * POINTS_PER_LEVEL} pts)`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.adBtn} onPress={() => setShowAdModal(true)} activeOpacity={0.8}>
          <Eye color={colors.neon} size={18} />
          <Text style={s.adBtnText}>Watch Ad for +3 Waters</Text>
        </TouchableOpacity>

        <Text style={s.ruleText}>🕐 Free waters reset daily • Higher tree = more points</Text>

      </ScrollView>

      <Modal visible={showAdModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdModal(false)}>
        <View style={s.adModalRoot}>
          <View style={s.adModalHeader}>
            <Text style={s.adModalTitle}>Watch Ad for Waters 💧</Text>
          </View>
          <AdPlayer
            givePoints={false}
            onAdWatched={async () => {
              if (!user) return;
              const nc = waterCount + 3;
              await supabase.from('profiles').update({ water_count: nc }).eq('id', user.id);
              setWaterCount(nc);
              setShowAdModal(false);
            }}
            onClose={() => setShowAdModal(false)}
          />
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { alignItems: 'center', padding: spacing.lg, gap: 14, paddingBottom: 40 },
  loadingText: { color: colors.textMuted, fontSize: 16, marginTop: 40 },
  expiredText: { color: colors.error, fontSize: 16, textAlign: 'center', fontWeight: '600' },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  gameTitle: { color: colors.gold, fontSize: 26, fontWeight: '900', letterSpacing: 3 },
  gameSub: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },

  statsRow: { flexDirection: 'row', gap: 8, width: '100%' },
  statBox: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: 14,
    alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border,
  },
  statIconWrap: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
  },
  statValue: { color: colors.gold, fontSize: 18, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },

  treeArea: {
    width: '100%', backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
    paddingVertical: 24, paddingHorizontal: spacing.lg, gap: 10,
    position: 'relative', overflow: 'hidden', minHeight: 340,
  },

  pointsPopup: {
    position: 'absolute', top: 10, color: colors.gold, fontSize: 22, fontWeight: '900',
    zIndex: 10,
  },
  dropWrap: { position: 'absolute', top: 10, zIndex: 5 },
  stageBadge: {
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1,
  },
  stageBadgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  progressTrack: {
    width: '100%', height: 8, backgroundColor: colors.bgDeep,
    borderRadius: radius.full, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.full },
  progressLabel: { color: colors.textMuted, fontSize: 11 },

  dailyCard: {
    width: '100%', backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 10,
  },
  dailyTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  dotsRow: { flexDirection: 'row', gap: 10 },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  dotActive: {
    backgroundColor: colors.neon, borderColor: colors.neon,
  },
  dotUsed: { backgroundColor: 'transparent', borderColor: colors.border },
  bonusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bonusText: { color: colors.gold, fontSize: 12, fontWeight: '700' },

  waterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.neon, paddingVertical: 14, paddingHorizontal: spacing.xl,
    borderRadius: radius.full, width: '100%', justifyContent: 'center',
    ...shadow.neon,
  },
  waterBtnText: { color: colors.bgDeep, fontSize: 15, fontWeight: '900' },
  btnDisabled: { backgroundColor: colors.bgCard, shadowOpacity: 0, elevation: 0 },
  adBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: colors.neon, paddingVertical: 12,
    paddingHorizontal: spacing.xl, borderRadius: radius.full, width: '100%', justifyContent: 'center',
  },
  adBtnText: { color: colors.neon, fontSize: 14, fontWeight: '700' },
  ruleText: { color: colors.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 17 },

  btnOutline: {
    borderWidth: 1.5, borderColor: colors.border, paddingVertical: 12,
    paddingHorizontal: spacing.xl, borderRadius: radius.full, marginTop: spacing.md,
  },
  btnOutlineText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },

  adModalRoot: { flex: 1, backgroundColor: colors.bg },
  adModalHeader: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  adModalTitle: { color: colors.gold, fontSize: 18, fontWeight: '800' },
});
