import React, { useEffect, useRef } from 'react';
import { Tabs, router } from 'expo-router';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
} from 'react-native';
import { Home, Gamepad2, Trophy, User } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { colors, radius, shadow } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');
const BAR_WIDTH = width - 40;
const NUM_TABS = 4;
const TAB_W = BAR_WIDTH / NUM_TABS;

// Centre x of each tab's blob (relative to pill left edge)
const tabCenter = (i: number) => TAB_W * i + TAB_W / 2 -24;

const TABS_DEF = [
  { name: 'index',       labelKey: 'tabHome'    as const, Icon: Home },
  { name: 'games',       labelKey: 'tabGames'   as const, Icon: Gamepad2 },
  { name: 'leaderboard', labelKey: 'tabRank'    as const, Icon: Trophy },
  { name: 'profile',     labelKey: 'tabProfile' as const, Icon: User },
];

/* ─── Pulsing blob ───────────────────────────────────────────────── */
function Blob({ x }: { x: Animated.Value }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.92, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.blobWrapper, { transform: [{ translateX: x }] }]}
    >
      <Animated.View style={[styles.blobGlow,  { transform: [{ scale: pulse }] }]} />
      <LinearGradient
        colors={['rgba(0, 255, 204, 0.35)', 'rgba(255, 215, 0, 0.2)']}// liquid teal/gold mercury gradient
        style={styles.blobGrad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Animated.View style={[styles.blob, { transform: [{ scale: pulse }] }]} />
      </LinearGradient>
    </Animated.View>
  );
}

/* ─── Single tab icon + label ────────────────────────────────────── */
function TabItem({ tab, focused }: { tab: { name: string; label: string; Icon: any }; focused: boolean }) {
  const scale   = useRef(new Animated.Value(focused ? 1.15 : 1)).current;
  const opacity = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: focused ? 1.15 : 1, friction: 5, tension: 150, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: focused ? 1 : 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [focused]);

  const { Icon } = tab;
  return (
    <Animated.View style={[styles.tabInner, { transform: [{ scale }] }]}>
      <View style={styles.iconContainer}>
        <Icon
          color={focused ? colors.gold : '#8F7EA6'}
          size={21}
          strokeWidth={focused ? 2.5 : 1.8}
        />
      </View>
      <Animated.Text style={[styles.tabLabel, focused ? styles.tabLabelActive : styles.tabLabelInactive, { opacity }]}>
        {tab.label}
      </Animated.Text>
    </Animated.View>
  );
}

/* ─── Custom tab bar ─────────────────────────────────────────────── */
function LiquidTabBar({ state, navigation }: any) {
  const { t } = useLanguage();
  const TABS = TABS_DEF.map(tab => ({ ...tab, label: t(tab.labelKey) }));
  const currentIndex = state.index;

  const blobX = useRef(new Animated.Value(tabCenter(currentIndex))).current;
  const blobXJS = useRef(tabCenter(currentIndex));

  useEffect(() => {
    Animated.spring(blobX, {
      toValue: tabCenter(currentIndex),
      friction: 7,
      tension: 80,
      useNativeDriver: true,
    }).start(() => {
      blobXJS.current = tabCenter(currentIndex);
    });
  }, [currentIndex]);

  const stateRef = useRef(state);
  stateRef.current = state;
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,

      onPanResponderGrant: () => {
        blobX.stopAnimation((val) => {
          blobXJS.current = val;
          blobX.setValue(val);
        });
      },

      onPanResponderMove: (_, gesture) => {
        const min = tabCenter(0);
        const max = tabCenter(NUM_TABS - 1);
        const next = Math.max(min, Math.min(max, blobXJS.current + gesture.dx));
        blobX.setValue(next);
      },

      onPanResponderRelease: (_, gesture) => {
        const current = blobXJS.current + gesture.dx;
        const snappedIndex = Math.round(
          (current - tabCenter(0)) / TAB_W
        );
        const clamped = Math.max(0, Math.min(NUM_TABS - 1, snappedIndex));

        Animated.spring(blobX, {
          toValue: tabCenter(clamped),
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }).start(() => {
          blobXJS.current = tabCenter(clamped);
        });

        if (clamped !== stateRef.current.index) {
          navigationRef.current.navigate(TABS_DEF[clamped].name);
        }
      },

      onPanResponderTerminate: (_, gesture) => {
        const current = blobXJS.current + gesture.dx;
        const snappedIndex = Math.round((current - tabCenter(0)) / TAB_W);
        const clamped = Math.max(0, Math.min(NUM_TABS - 1, snappedIndex));
        Animated.spring(blobX, {
          toValue: tabCenter(clamped),
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }).start(() => { blobXJS.current = tabCenter(clamped); });
      },
    })
  ).current;

  return (
    <View style={styles.barOuter} pointerEvents="box-none">
      <View style={styles.pill} {...panResponder.panHandlers}>
        {/* Frosted Glass Base Layer */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 40 : 70}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(24, 10, 45, 0.35)', 'rgba(10, 2, 22, 0.65)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />

        {/* Shimmer top line */}
        <View style={styles.shimmer} pointerEvents="none" />

        {/* Liquid blob sliding indicator */}
        <Blob x={blobX} />

        {/* Tab buttons */}
        {TABS.map((tab, i) => (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabButton}
            activeOpacity={0.7}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: state.routes[i]?.key,
                canPreventDefault: true,
              });
              if (!event.defaultPrevented) navigation.navigate(tab.name);
            }}
          >
            <TabItem tab={tab} focused={state.index === i} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/* ─── Root layout ────────────────────────────────────────────────── */
export default function TabsLayout() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && !session) router.replace('/(auth)');
  }, [session, loading]);

  if (!session) return null;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <LiquidTabBar {...props} />}
    >
      <Tabs.Screen name="index"       options={{ title: 'Home' }} />
      <Tabs.Screen name="games"       options={{ title: 'Games' }} />
      <Tabs.Screen name="leaderboard" options={{ title: 'Rank' }} />
      <Tabs.Screen name="profile"     options={{ title: 'Profile' }} />
    </Tabs>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  barOuter: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 16,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  pill: {
    width: BAR_WIDTH,
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 36,
    backgroundColor: 'rgba(15, 6, 27, 0.25)', // Semi-transparent base for glass
    borderWidth: 1.5,
    borderColor: 'rgba(255, 215, 0, 0.18)', // Glass edge glow border
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 20,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 1,
  },

  /* ── Blob ── */
  blobWrapper: {
    position: 'absolute',
    left: 0,
    top: 11,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blobGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 255, 204, 0.14)', // vibrant neon glow behind the glass
  },
  blobGrad: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 215, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blob: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
  },

  /* ── Tab button ── */
  tabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabInner: {
    height: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    position: 'absolute',
    bottom: 8,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tabLabelActive: {
    color: colors.gold,
    textShadowColor: 'rgba(255, 215, 0, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  tabLabelInactive: {
    color: '#8F7EA6',
  },
});
