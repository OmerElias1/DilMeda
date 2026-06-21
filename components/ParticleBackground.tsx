import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { colors } from '@/constants/theme';

const { width: W, height: H } = Dimensions.get('window');

type Particle = {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  anim: Animated.Value;
  xAnim: Animated.Value;
  duration: number;
  delay: number;
  targetY: number;
  targetX: number;
};

const PARTICLE_COLORS = [
  'rgba(255,215,0,0.6)',
  'rgba(0,255,204,0.4)',
  'rgba(255,215,0,0.3)',
  'rgba(180,100,255,0.3)',
  'rgba(0,255,204,0.6)',
];

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * W,
    y: Math.random() * H,
    size: Math.random() * 4 + 2,
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    anim: new Animated.Value(0),
    xAnim: new Animated.Value(0),
    duration: Math.random() * 4000 + 3000,
    delay: Math.random() * 3000,
    targetY: -(60 + Math.random() * 80),
    targetX: (Math.random() - 0.5) * 30,
  }));
}

export default function ParticleBackground() {
  const particles = useRef(makeParticles(28)).current;
  const orbAnim1 = useRef(new Animated.Value(0)).current;
  const orbAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    particles.forEach(p => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.parallel([
            Animated.timing(p.anim, { toValue: 1, duration: p.duration, useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(p.xAnim, { toValue: 1, duration: p.duration / 2, useNativeDriver: true }),
              Animated.timing(p.xAnim, { toValue: 0, duration: p.duration / 2, useNativeDriver: true }),
            ]),
          ]),
          Animated.timing(p.anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
      loop.start();
    });

    const orbLoop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(orbAnim1, { toValue: 1, duration: 6000, useNativeDriver: true }),
        Animated.timing(orbAnim1, { toValue: 0, duration: 6000, useNativeDriver: true }),
      ])
    );
    const orbLoop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(orbAnim2, { toValue: 1, duration: 8000, useNativeDriver: true }),
        Animated.timing(orbAnim2, { toValue: 0, duration: 8000, useNativeDriver: true }),
      ])
    );
    orbLoop1.start();
    orbLoop2.start();
  }, []);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Gradient orbs */}
      <Animated.View
        style={[
          styles.orb,
          {
            width: 220,
            height: 220,
            top: -40,
            left: -60,
            backgroundColor: 'rgba(120,40,180,0.18)',
            borderRadius: 110,
            transform: [
              {
                scale: orbAnim1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }),
              },
            ],
            opacity: orbAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.9] }),
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          {
            width: 180,
            height: 180,
            bottom: 80,
            right: -40,
            backgroundColor: 'rgba(0,200,160,0.12)',
            borderRadius: 90,
            transform: [
              {
                scale: orbAnim2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }),
              },
            ],
            opacity: orbAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.8] }),
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          {
            width: 140,
            height: 140,
            top: H * 0.4,
            left: W * 0.5,
            backgroundColor: 'rgba(255,200,0,0.08)',
            borderRadius: 70,
            transform: [
              {
                scale: orbAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }),
              },
            ],
            opacity: orbAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }),
          },
        ]}
      />
      {/* Particles */}
      {particles.map(p => (
        <Animated.View
          key={p.id}
          style={[
            styles.particle,
            {
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.color,
              left: p.x,
              top: p.y,
              opacity: p.anim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                {
                  translateY: p.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, p.targetY],
                  }),
                },
                {
                  translateX: p.xAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, p.targetX],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    blurRadius: 40,
  } as any,
  particle: {
    position: 'absolute',
  },
});
