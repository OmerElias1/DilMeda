import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useURL } from 'expo-linking';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/constants/theme';

/**
 * This screen exists solely to give the `dilmeda://auth/callback` deep link
 * a valid Expo Router destination. Without it, after Google OAuth the router
 * briefly shows the +not-found "This screen doesn't exist" page.
 *
 * The actual session is established in useAuth via handleAuthDeepLink (which
 * is triggered by the useURL() listener). Once the session is set, the
 * useEffect in auth/index.tsx redirects to /(tabs) automatically.
 * This screen simply shows a loading spinner in the meantime.
 */
export default function AuthCallbackScreen() {
  const { session } = useAuth();
  const url = useURL();

  useEffect(() => {
    // If we already have a session by the time this mounts, go straight to tabs.
    if (session) {
      router.replace('/(tabs)');
    }
  }, [session]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.gold} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0618',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
