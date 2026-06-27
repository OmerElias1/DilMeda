import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Animated, Dimensions, Image
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/lib/supabase';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import ParticleBackground from '@/components/ParticleBackground';
import { Mail, Send } from 'lucide-react-native';
import Svg, { Path, G, ClipPath, Rect, Defs } from 'react-native-svg';

const { width: W, height: H } = Dimensions.get('window');

export default function AuthScreen() {
  const { signIn, signUp, signInWithGoogle, session, isRecoveryMode, setIsRecoveryMode } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'update_password' | 'verify_email'>('signin');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const handlePhoneChange = (val: string) => {
    let formatted = val;
    if (formatted.startsWith('0')) {
      formatted = '+251' + formatted.slice(1);
    }
    setPhone(formatted);
  };
  const logoAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (session && !isRecoveryMode) {
      router.replace('/(tabs)');
    }
  }, [session, isRecoveryMode]);

  useEffect(() => {
    if (isRecoveryMode) {
      setMode('update_password');
      setError('');
      setSuccess('');
    }
  }, [isRecoveryMode]);

  useEffect(() => {
    Animated.spring(logoAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    if (mode === 'update_password') {
      if (!password.trim() || !confirmPass.trim()) {
        setError(t('errorFillFields'));
        return;
      }
      if (password !== confirmPass) {
        setError(t('errorPasswordsMatch'));
        return;
      }
      if (password.length < 6) {
        setError(t('errorPasswordShort'));
        return;
      }
      setLoading(true);
      try {
        const { error: updateErr } = await supabase.auth.updateUser({ password });
        if (updateErr) {
          setError(updateErr.message);
        } else {
          setSuccess(t('successPasswordUpdate'));
          setIsRecoveryMode(false);
          setTimeout(() => {
            router.replace('/(tabs)');
          }, 1500);
        }
      } catch (err: any) {
        setError(err.message || t('errorPasswordUpdateFailed'));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'forgot') {
      if (!email.trim()) {
        setError(t('errorEmailReq'));
        return;
      }
      setLoading(true);
      try {
        // Use the app scheme as the redirect — Supabase appends #access_token=...&type=recovery
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: 'dilmeda://',
        });
        if (resetErr) {
          setError(resetErr.message);
        } else {
          setSuccess('Reset link sent! Check your email and tap the link to set a new password.');
        }
      } catch (err: any) {
        setError(err?.message || t('failedSendResetLink'));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setError(t('errorFullNameReq'));
        return;
      }
      if (!phone.trim()) {
        setError('Phone number is required.');
        return;
      }
    }

    if (!email.trim()) {
      setError(t('errorEmailReq'));
      return;
    }

    if (!password.trim()) {
      setError(t('errorPasswordReq'));
      return;
    }
    if (mode === 'signup' && password !== confirmPass) {
      setError(t('errorPasswordsMatch'));
      return;
    }
    if (password.length < 6) {
      setError(t('errorPasswordShort'));
      return;
    }

    setLoading(true);

    const result = mode === 'signin'
      ? await signIn({ email: email.trim() }, password)
      : await signUp({ email: email.trim() }, password, name.trim(), phone.trim());
    setLoading(false);

    if (result.error) {
      if (
        result.error.toLowerCase().includes('email not confirmed') ||
        result.error.toLowerCase().includes('email_not_confirmed')
      ) {
        setError('');
        setMode('verify_email');
      } else {
        setError(result.error);
      }
    } else {
      if (mode === 'signup') {
        if (result.needsVerification) {
          setMode('verify_email');
        } else {
          router.replace('/(tabs)');
        }
      } else {
        router.replace('/(tabs)');
      }
    }
  };

  const handleResendEmail = async () => {
    if (resendCooldown > 0 || !email.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });
      if (resendErr) {
        setError(resendErr.message);
      } else {
        setSuccess(t('successResendEmail'));
        setResendCooldown(60);
        resendTimer.current = setInterval(() => {
          setResendCooldown(prev => {
            if (prev <= 1) {
              if (resendTimer.current) clearInterval(resendTimer.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (err: any) {
      setError(err.message || t('failedResendEmail'));
    } finally {
      setLoading(false);
    }
  };

  const resetFormState = () => {
    setError('');
    setSuccess('');
    setName('');
    setPhone('');
    setPassword('');
    setConfirmPass('');
  };

  return (
    <View style={styles.root}>
      <ParticleBackground />

      {/* Language Toggle */}
      <View style={styles.langToggleContainer}>
        <TouchableOpacity
          style={[styles.langToggleBtn, lang === 'en' && styles.langToggleBtnActive]}
          onPress={() => setLang('en')}
        >
          <Text style={[styles.langToggleText, lang === 'en' && styles.langToggleTextActive]}>EN</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.langToggleBtn, lang === 'am' && styles.langToggleBtnActive]}
          onPress={() => setLang('am')}
        >
          <Text style={[styles.langToggleText, lang === 'am' && styles.langToggleTextActive]}>AM</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <Animated.View
            style={[
              styles.logoArea,
              {
                opacity: logoAnim,
                transform: [
                  { scale: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
                  { translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) },
                ],
              },
            ]}
          >
            <View style={styles.logoRing}>
              <Image
                source={require('@/assets/images/image.png')}
                style={styles.logoIcon}
              />
            </View>
            <Text style={styles.logoText}>DilMeda</Text>
            <Text style={styles.logoTagline}>{t('tagline')}</Text>
          </Animated.View>

          {/* Card */}
          <View style={styles.card}>
            {/* Mode toggle (Sign In / Sign Up) */}
            {mode !== 'update_password' && mode !== 'verify_email' && mode !== 'forgot' && (
              <View style={styles.modeToggle}>
                <TouchableOpacity
                  style={[styles.modeBtn, mode === 'signin' && styles.modeBtnActive]}
                  onPress={() => { setMode('signin'); resetFormState(); }}
                >
                  <Text style={[styles.modeBtnText, mode === 'signin' && styles.modeBtnTextActive]}>
                    {t('authSignIn')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive]}
                  onPress={() => { setMode('signup'); resetFormState(); }}
                >
                  <Text style={[styles.modeBtnText, mode === 'signup' && styles.modeBtnTextActive]}>
                    {t('authSignUp')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {mode !== 'verify_email' && (
              <>
                <Text style={styles.cardTitle}>
                  {mode === 'signin'
                    ? t('welcomeBack')
                    : mode === 'signup'
                    ? t('joinTournament')
                    : mode === 'forgot'
                    ? t('resetPasswordTitle')
                    : t('setNewPassword')}
                </Text>
                <Text style={styles.cardSub}>
                  {mode === 'signin'
                    ? t('signInSub')
                    : mode === 'signup'
                    ? t('signUpSub')
                    : mode === 'forgot'
                    ? t('forgotSub')
                    : t('setNewSub')}
                </Text>
              </>
            )}

            {/* Full Name (signup only) */}
            {mode === 'signup' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('fullName')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('johnDoePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />
              </View>
            )}

            {/* Email input */}
            {mode !== 'update_password' && mode !== 'verify_email' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('email')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            )}

            {/* Phone number (signup only — required for contact) */}
            {mode === 'signup' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('phoneNumber')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+251911223344"
                  placeholderTextColor={colors.textMuted}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                />
              </View>
            )}

            {/* Password */}
            {mode !== 'verify_email' && mode !== 'forgot' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {mode === 'update_password' ? t('newPassword') : t('passwordLabel')}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                {mode === 'signin' && (
                  <TouchableOpacity
                    onPress={() => { setMode('forgot'); setError(''); setSuccess(''); }}
                    style={styles.forgotBtn}
                  >
                    <Text style={styles.forgotBtnText}>{t('forgotBtn')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Confirm Password */}
            {(mode === 'signup' || mode === 'update_password') && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('confirmPassword')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={confirmPass}
                  onChangeText={setConfirmPass}
                  secureTextEntry
                />
              </View>
            )}

            {error && mode !== 'verify_email' ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {success && mode !== 'verify_email' ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{success}</Text>
              </View>
            ) : null}

            {mode !== 'verify_email' && (
              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <Text style={styles.submitBtnText}>
                  {loading
                    ? t('pleaseWait')
                    : mode === 'signin'
                    ? t('authSignIn')
                    : mode === 'signup'
                    ? t('createAccount')
                    : mode === 'forgot'
                    ? t('sendResetLink')
                    : t('updatePassword')}
                </Text>
              </TouchableOpacity>
            )}

            {/* Google Sign-In — only show on signin/signup */}
            {(mode === 'signin' || mode === 'signup') && (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={[styles.googleBtn, googleLoading && styles.submitBtnDisabled]}
                  onPress={async () => {
                    setGoogleLoading(true);
                    setError('');
                    const result = await signInWithGoogle();
                    setGoogleLoading(false);
                    if (result.error) setError(result.error);
                  }}
                  disabled={googleLoading || loading}
                  activeOpacity={0.85}
                >
                  {!googleLoading && (
                    <Svg width={20} height={20} viewBox="0 0 48 48" style={styles.googleIcon}>
                      <Defs>
                        <ClipPath id="clip">
                          <Rect width={48} height={48} />
                        </ClipPath>
                      </Defs>
                      <G clipPath="url(#clip)">
                        <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                        <Path fill="none" d="M0 0h48v48H0z" />
                      </G>
                    </Svg>
                  )}
                  <Text style={styles.googleBtnText}>
                    {googleLoading ? 'Signing in...' : 'Continue with Google'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {mode === 'verify_email' ? (
              // ── Email Verification Sent Screen ─────────────────────────
              <View style={styles.verifyContainer}>
                <View style={styles.verifyIconWrapper}>
                  <Mail color={colors.gold} size={52} />
                </View>
                <Text style={styles.verifyTitle}>{t('verifyCheckEmail')}</Text>
                <Text style={styles.verifySub}>{t('verifySentLinkTo')}</Text>
                <Text style={styles.verifyEmail}>{email.trim()}</Text>
                <Text style={styles.verifyInstructions}>
                  {t('verifyInstructions')}
                </Text>

                {success ? (
                  <View style={styles.successBox}>
                    <Text style={styles.successText}>{success}</Text>
                  </View>
                ) : null}
                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                {/* Resend button with cooldown */}
                <TouchableOpacity
                  style={[styles.resendBtn, (resendCooldown > 0 || loading) && styles.submitBtnDisabled]}
                  onPress={handleResendEmail}
                  disabled={resendCooldown > 0 || loading}
                >
                  <Text style={styles.resendBtnText}>
                    {loading
                      ? t('sending')
                      : resendCooldown > 0
                      ? `${t('resendIn')} ${resendCooldown}s`
                      : t('resendEmailBtn')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={() => { setMode('signin'); resetFormState(); setResendCooldown(0); if (resendTimer.current) clearInterval(resendTimer.current); }}
                >
                  <Text style={styles.submitBtnText}>{t('backToSignIn')}</Text>
                </TouchableOpacity>
              </View>
            ) : mode === 'forgot' ? (
              <TouchableOpacity
                style={styles.switchMode}
                onPress={() => { setMode('signin'); resetFormState(); }}
              >
                <Text style={styles.switchModeText}>
                  {t('backTo')}
                  <Text style={styles.switchModeLink}> {t('authSignIn')}</Text>
                </Text>
              </TouchableOpacity>
            ) : mode === 'update_password' ? (
              <TouchableOpacity
                style={styles.switchMode}
                onPress={() => { setIsRecoveryMode(false); setMode('signin'); resetFormState(); }}
              >
                <Text style={styles.switchModeText}>
                  {t('cancelAnd')}
                  <Text style={styles.switchModeLink}> {t('authSignIn')}</Text>
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.switchMode}
                onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); resetFormState(); }}
              >
                <Text style={styles.switchModeText}>
                  {mode === 'signin' ? t('dontHaveAccount') : t('alreadyHaveAccount')}
                  <Text style={styles.switchModeLink}>
                    {mode === 'signin' ? ` ${t('authSignUp')}` : ` ${t('authSignIn')}`}
                  </Text>
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 50,
    paddingBottom: 32,
    minHeight: H,
  },

  // ── Logo ──────────────────────────────────────────────────────────
  logoArea: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...shadow.gold,
  },
  logoIcon: { width: 84, height: 84, borderRadius: 42 },
  logoText: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.gold,
    letterSpacing: 2,
    textShadowColor: colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  logoTagline: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
    letterSpacing: 0.5,
  },

  // ── Card ──────────────────────────────────────────────────────────
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },

  // ── Mode toggle ───────────────────────────────────────────────────
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.bgDeep,
    borderRadius: radius.lg,
    padding: 3,
    marginBottom: 16,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: colors.gold },
  modeBtnText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  modeBtnTextActive: { color: colors.bgDeep, fontWeight: '800' },

  // ── Card text ─────────────────────────────────────────────────────
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  cardSub: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 14,
  },

  // ── Inputs ────────────────────────────────────────────────────────
  inputGroup: { marginBottom: 12 },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  optionalTag: { color: colors.textMuted, fontWeight: '400', fontSize: 10 },
  input: {
    backgroundColor: colors.bgDeep,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // ── Feedback ──────────────────────────────────────────────────────
  errorBox: {
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error,
    marginBottom: 10,
  },
  errorText: { color: colors.error, fontSize: 12 },
  successBox: {
    backgroundColor: 'rgba(0,255,136,0.1)',
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.success,
    marginBottom: 10,
  },
  successText: { color: colors.success, fontSize: 12 },

  // ── Submit button ─────────────────────────────────────────────────
  submitBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.full,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 2,
    ...shadow.gold,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: colors.bgDeep, fontSize: 15, fontWeight: '800' },

  // ── OR divider ────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginHorizontal: 10,
    letterSpacing: 1.5,
  },

  // ── Google button ─────────────────────────────────────────────────
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.full,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  googleIcon: {},
  googleBtnText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Switch mode link ──────────────────────────────────────────────
  switchMode: { alignItems: 'center', marginTop: 14 },
  switchModeText: { color: colors.textSecondary, fontSize: 13 },
  switchModeLink: { color: colors.gold, fontWeight: '700' },

  // ── Forgot / resend ───────────────────────────────────────────────
  forgotBtn: { alignSelf: 'flex-end', marginTop: 6 },
  forgotBtnText: { color: colors.gold, fontSize: 12, fontWeight: '600' },
  resendBtn: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: radius.full,
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  resendBtnText: { color: colors.gold, fontSize: 14, fontWeight: '700' },

  // ── Language toggle ───────────────────────────────────────────────
  langToggleContainer: {
    position: 'absolute',
    top: 52,
    right: spacing.lg,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    padding: 2,
    zIndex: 10,
  },
  langToggleBtn: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  langToggleBtnActive: { backgroundColor: colors.gold },
  langToggleText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  langToggleTextActive: { color: colors.bgDeep },

  // ── Email verification screen ─────────────────────────────────────
  verifyContainer: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  verifyIconWrapper: {
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyTitle: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  verifySub: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  verifyEmail: {
    color: colors.neon,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  verifyInstructions: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: spacing.sm,
  },
});

