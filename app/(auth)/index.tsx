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
import { Mail, Phone as PhoneIcon } from 'lucide-react-native';

const { width: W, height: H } = Dimensions.get('window');

export default function AuthScreen() {
  const { signIn, signUp, session, isRecoveryMode, setIsRecoveryMode, verifyOtp, sendPasswordResetOtp } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'update_password' | 'verify_email' | 'verify_otp'>('signin');
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [otpType, setOtpType] = useState<'signup' | 'recovery'>('signup');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
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

  /** Returns the current identifier value (trimmed) */
  const getIdentifier = () => authMethod === 'email' ? email.trim() : phone.trim();

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

    if (mode === 'signup') {
      if (!name.trim()) {
        setError(t('errorFullNameReq'));
        return;
      }
    }

    // Validate identifier
    const identifier = getIdentifier();
    if (!identifier) {
      setError(authMethod === 'email' ? t('errorEmailReq') : t('errorPhoneReq'));
      return;
    }

    if (mode === 'forgot') {
      setLoading(true);
      try {
        if (authMethod === 'email') {
          const Linking = await import('expo-linking');
          const redirectTo = Linking.createURL('/(auth)', { queryParams: { recovery: 'true' } });
          
          const { error: resetErr } = await supabase.auth.resetPasswordForEmail(identifier, {
            redirectTo,
          });
          if (resetErr) {
            setError(resetErr.message);
          } else {
            setSuccess(t('successResetLink'));
          }
        } else {
          // Phone password reset
          const { error: resetErr } = await sendPasswordResetOtp(identifier);
          if (resetErr) {
            setError(resetErr);
          } else {
            setSuccess(t('authPhoneOtpSent'));
            setOtpType('recovery');
            setMode('verify_otp');
            setOtp('');
          }
        }
      } catch (err: any) {
        setError(err?.message || t('failedSendResetLink'));
      } finally {
        setLoading(false);
      }
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
    const idObj = authMethod === 'email'
      ? { email: identifier }
      : { phone: identifier };

    const result = mode === 'signin'
      ? await signIn(idObj, password)
      : await signUp(idObj, password, name.trim());
    setLoading(false);

    if (result.error) {
      // Friendly message when email is not yet confirmed
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
          if (authMethod === 'email') {
            setMode('verify_email');
          } else {
            // For phone signup, Supabase sends OTP — transition to verify_otp
            setSuccess(t('authPhoneOtpSent'));
            setOtpType('signup');
            setMode('verify_otp');
            setOtp('');
          }
        } else {
          router.replace('/(tabs)');
        }
      } else {
        router.replace('/(tabs)');
      }
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      setError(t('errorOtpReq'));
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);

    const identifier = getIdentifier();
    const isPhone = authMethod === 'phone';
    const params = isPhone
      ? { phone: identifier, token: otp.trim(), type: otpType }
      : { email: identifier, token: otp.trim(), type: otpType };

    try {
      const result = await verifyOtp(params);
      if (result.error) {
        setError(result.error);
      } else {
        if (otpType === 'recovery') {
          setSuccess(t('successOtpVerified'));
          setMode('update_password');
          setPassword('');
          setConfirmPass('');
        } else {
          router.replace('/(tabs)');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Verification failed');
    } finally {
      setLoading(false);
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
        // Start 60-second cooldown
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
    setPassword('');
    setConfirmPass('');
    setOtp('');
  };

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

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
            {mode !== 'forgot' && mode !== 'update_password' && mode !== 'verify_email' && (
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
                    : mode === 'verify_otp'
                    ? t('verifyOtpTitle')
                    : t('setNewPassword')}
                </Text>
                <Text style={styles.cardSub}>
                  {mode === 'signin'
                    ? t('signInSub')
                    : mode === 'signup'
                    ? t('signUpSub')
                    : mode === 'forgot'
                    ? t('forgotSub')
                    : mode === 'verify_otp'
                    ? `${t('verifyOtpSub')} ${getIdentifier()}`
                    : t('setNewSub')}
                </Text>
              </>
            )}

            {/* ── Email / Phone method toggle ── */}
            {mode !== 'update_password' && mode !== 'verify_email' && mode !== 'verify_otp' && (
              <View style={styles.methodToggle}>
                <TouchableOpacity
                  style={[styles.methodBtn, authMethod === 'email' && styles.methodBtnActive]}
                  onPress={() => { setAuthMethod('email'); setError(''); }}
                >
                  <View style={styles.methodBtnInner}>
                    <Mail size={16} color={authMethod === 'email' ? colors.gold : colors.textMuted} strokeWidth={2.5} />
                    <Text style={[styles.methodBtnText, authMethod === 'email' && styles.methodBtnTextActive]}>
                      {t('authMethodEmail')}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.methodBtn, authMethod === 'phone' && styles.methodBtnActive]}
                  onPress={() => { setAuthMethod('phone'); setError(''); }}
                >
                  <View style={styles.methodBtnInner}>
                    <PhoneIcon size={16} color={authMethod === 'phone' ? colors.gold : colors.textMuted} strokeWidth={2.5} />
                    <Text style={[styles.methodBtnText, authMethod === 'phone' && styles.methodBtnTextActive]}>
                      {t('authMethodPhone')}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Full Name (signup only) */}
            {mode !== 'verify_email' && mode === 'signup' && (
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

            {/* Email or Phone input */}
            {mode !== 'update_password' && mode !== 'verify_email' && mode !== 'verify_otp' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {authMethod === 'email' ? t('email') : t('phoneNumber')}
                </Text>
                {(authMethod === 'email') ? (
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                ) : (
                  <TextInput
                    style={styles.input}
                    placeholder="+251911223344"
                    placeholderTextColor={colors.textMuted}
                    value={phone}
                    onChangeText={handlePhoneChange}
                    keyboardType="phone-pad"
                  />
                )}
              </View>
            )}

            {/* OTP Verification input */}
            {mode === 'verify_otp' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('otpLabel')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123456"
                  placeholderTextColor={colors.textMuted}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
            )}

            {/* Password */}
            {mode !== 'forgot' && mode !== 'verify_email' && mode !== 'verify_otp' && (
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
                onPress={mode === 'verify_otp' ? handleVerifyOtp : handleSubmit}
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
                    : mode === 'verify_otp'
                    ? t('verifyOtpBtn')
                    : t('updatePassword')}
                </Text>
              </TouchableOpacity>
            )}
            {mode === 'verify_email' ? (
              // ── Email Verification Sent Screen ─────────────────────────
              <View style={styles.verifyContainer}>
                <Text style={styles.verifyIcon}>📬</Text>
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
                      : `📤 ${t('resendEmailBtn')}`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={() => { setMode('signin'); resetFormState(); setResendCooldown(0); if (resendTimer.current) clearInterval(resendTimer.current); }}
                >
                  <Text style={styles.submitBtnText}>{t('backToSignIn')}</Text>
                </TouchableOpacity>
              </View>
            ) : (mode === 'forgot' || mode === 'verify_otp') ? (
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
    flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    padding: spacing.lg, paddingTop: 60, paddingBottom: 40,
    minHeight: H,
  },
  logoArea: { alignItems: 'center', marginBottom: spacing.xl + 8, position: 'relative' },
  logoRing: {
    width: 138, height: 138, borderRadius: 69,
    borderWidth: 3, borderColor: colors.gold,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    ...shadow.gold,
  },
  logoIcon: { width: 130, height: 130, borderRadius: 65 },
  logoText: {
    fontSize: 34, fontWeight: '900', color: colors.gold, letterSpacing: 2,
    textShadowColor: colors.gold, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12,
  },
  logoTagline: { color: colors.textSecondary, fontSize: 13, marginTop: 4, letterSpacing: 0.5 },
  card: {
    width: '100%', maxWidth: 400,
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl, padding: spacing.xl,
    borderWidth: 1, borderColor: colors.border,
    ...shadow.card,
  },
  modeToggle: {
    flexDirection: 'row', backgroundColor: colors.bgDeep, borderRadius: radius.lg,
    padding: 4, marginBottom: spacing.lg,
  },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center' },
  modeBtnActive: { backgroundColor: colors.gold },
  modeBtnText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  modeBtnTextActive: { color: colors.bgDeep, fontWeight: '800' },
  // Email / Phone method toggle
  methodToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  methodBtnActive: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  methodBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  methodBtnText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  methodBtnTextActive: {
    color: colors.gold,
    fontWeight: '800',
  },
  cardTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 4 },
  cardSub: { color: colors.textSecondary, fontSize: 13, marginBottom: spacing.lg },
  inputGroup: { marginBottom: spacing.md },
  inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.bgDeep, borderRadius: radius.md, padding: spacing.md,
    color: colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: colors.border,
  },
  errorBox: {
    backgroundColor: 'rgba(255,68,68,0.1)', borderRadius: radius.md, padding: spacing.sm,
    borderWidth: 1, borderColor: colors.error, marginBottom: spacing.md,
  },
  errorText: { color: colors.error, fontSize: 13 },
  successBox: {
    backgroundColor: 'rgba(0,255,136,0.1)', borderRadius: radius.md, padding: spacing.sm,
    borderWidth: 1, borderColor: colors.success, marginBottom: spacing.md,
  },
  successText: { color: colors.success, fontSize: 13 },
  submitBtn: {
    backgroundColor: colors.gold, borderRadius: radius.full, padding: spacing.md,
    alignItems: 'center', marginTop: 4, ...shadow.gold,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: colors.bgDeep, fontSize: 16, fontWeight: '800' },
  resendBtn: {
    borderWidth: 1.5, borderColor: colors.gold, borderRadius: radius.full,
    paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg,
    alignItems: 'center', backgroundColor: 'transparent',
  },
  resendBtnText: { color: colors.gold, fontSize: 14, fontWeight: '700' },
  switchMode: { alignItems: 'center', marginTop: spacing.md },
  switchModeText: { color: colors.textSecondary, fontSize: 13 },
  switchModeLink: { color: colors.gold, fontWeight: '700' },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  forgotBtnText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '600',
  },
  langToggleContainer: {
    position: 'absolute',
    top: 60,
    right: spacing.lg,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    padding: 2,
    zIndex: 10,
  },
  langToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  langToggleBtnActive: {
    backgroundColor: colors.gold,
  },
  langToggleText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  langToggleTextActive: {
    color: colors.bgDeep,
  },
  // Email verification screen
  verifyContainer: {
    alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm,
  },
  verifyIcon: {
    fontSize: 52, marginBottom: 4,
  },
  verifyTitle: {
    color: colors.gold, fontSize: 22, fontWeight: '900', letterSpacing: 0.3,
  },
  verifySub: {
    color: colors.textSecondary, fontSize: 14, textAlign: 'center',
  },
  verifyEmail: {
    color: colors.neon, fontSize: 15, fontWeight: '800', textAlign: 'center',
  },
  verifyInstructions: {
    color: colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18,
    paddingHorizontal: spacing.sm,
  },
});
