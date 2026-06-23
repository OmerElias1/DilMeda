import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Linking, KeyboardAvoidingView, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Send, MessageSquare, AlertTriangle, Cpu, CheckCircle, Coins, Trophy, TreePine, Flame, Gift } from 'lucide-react-native';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { colors, spacing, radius, shadow } from '@/constants/theme';

type Props = {
  onClose: () => void;
};

type Message = {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
};

export default function SupportModal({ onClose }: Props) {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [activeTab, setActiveTab] = useState<'chat' | 'report'>('chat');
  
  // AI Chat States
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: t('aiAgentGreeting'),
      timestamp: new Date(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);

  // Issue Report States
  const [category, setCategory] = useState<'bug' | 'payment' | 'tournament' | 'other'>('bug');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccessfully, setSubmittedSuccessfully] = useState(false);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isTyping]);

  // ── Real Gemini AI integration ───────────────────────────────────────────
  const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
  // Support both key query parameter and x-goog-api-key header for the new AQ. format
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const SYSTEM_PROMPT = `You are Meda Bot, the friendly AI support assistant for DilMeda — an Ethiopian mobile gaming app.

DilMeda app facts:
- Games available: Meda Clicker (tap coins), Ad-Avoider (dodge ads), Memory Match (card pairs), Lucky Spin (daily wheel), Tree Grower (water daily), Sky Drifter (flappy bird), Metro Rush (endless runner), Cyber Stack, Rhythm Pulse, Laser Deflector, Color Orbit.
- Tournaments: Players join lobbies by paying an entry fee in points. The player with the most points when the tournament ends wins real prizes (ETB cash, PlayStation 5, etc.).
- Points: Earned by playing games, watching ads, daily spin. Points also used to enter tournaments.
- Daily Streaks: Log in and play every day to build a streak. Higher streaks give bonus multipliers.
- Tree Grower: Water your tree daily for free; watch ads for extra water. Each growth stage gives points.
- Lucky Spin: Once every 24 hours, spin to win 10–100 points instantly.
- Prizes are paid via the phone number saved in Profile > Gamer Credentials.
- Support email: Omereliaskamil@gmail.com

Rules:
- Answer only questions related to DilMeda. If someone asks something unrelated, politely redirect them.
- Keep answers concise (2–4 sentences max) and friendly.
- Support both English and Amharic. Reply in the same language the user writes in.
- Never make up features that don't exist in the app.`;

  const callGemini = async (userText: string): Promise<string> => {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('YOUR_GEMINI_API_KEY')) {
      console.warn('Gemini API key is not configured in .env file.');
      throw new Error('API Key missing');
    }

    // Build conversation history for Gemini (alternating user/model turns)
    const history = messages
      .filter(m => m.id !== 'welcome') // skip the static greeting
      .map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));

    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        ...history,
        { role: 'user', parts: [{ text: userText }] },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300,
      },
    };

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY // Primary header auth for Google Cloud/Auth API keys
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Gemini error:', err);
      throw new Error('AI unavailable');
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      ?? "Sorry, I couldn't generate a response. Please try again!";
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Math.random().toString(),
      sender: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsTyping(true);

    try {
      const reply = await callGemini(text.trim());
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        sender: 'bot',
        text: reply,
        timestamp: new Date(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        sender: 'bot',
        text: lang === 'am'
          ? 'ይቅርታ፣ አሁን ማገናኘት አልቻልኩም። እባክዎ ቆይተው ይሞክሩ።'
          : 'Sorry, I could not connect right now. Please try again in a moment.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Submit Issue Report
  const handleSubmitReport = async () => {
    if (!subject.trim() || !description.trim()) {
      Alert.alert('Error', t('errorFillFields'));
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to submit a report.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Insert report into Supabase
      const { error } = await supabase
        .from('support_reports')
        .insert({
          user_id: user.id,
          category,
          subject: subject.trim(),
          message: description.trim(),
        });

      if (error) throw error;

      // 2. Open email client with mailto pre-filled
      const recipient = 'Omereliaskamil@gmail.com';
      const mailSubject = encodeURIComponent(`[DilMeda Support] - ${category.toUpperCase()}: ${subject}`);
      const mailBody = encodeURIComponent(
        `User ID: ${user.id}\nCategory: ${category}\n\nMessage:\n${description}\n\n---\nSent via DilMeda App Support`
      );
      
      const mailtoUrl = `mailto:${recipient}?subject=${mailSubject}&body=${mailBody}`;

      const supported = await Linking.canOpenURL(mailtoUrl);
      if (supported) {
        await Linking.openURL(mailtoUrl);
      } else {
        Alert.alert(
          'Email App Not Found',
          `Please email your report directly to Omereliaskamil@gmail.com. We have logged your request in our backend database.`
        );
      }

      setSubmittedSuccessfully(true);
      setSubject('');
      setDescription('');
    } catch (err: any) {
      Alert.alert('Submission Failed', err.message || 'Something went wrong while saving your report.');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryLabel = (catKey: typeof category) => {
    switch (catKey) {
      case 'bug': return t('reportCategoryBug');
      case 'payment': return t('reportCategoryPayment');
      case 'tournament': return t('reportCategoryTournament');
      case 'other': return t('reportCategoryOther');
    }
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 20 : 0) }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <ChevronLeft color={colors.textPrimary} size={24} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('supportTitle')}</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Tab Buttons */}
        <View style={styles.tabsWrap}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'chat' && styles.tabBtnActive]}
            onPress={() => setActiveTab('chat')}
          >
            <MessageSquare color={activeTab === 'chat' ? colors.gold : colors.textMuted} size={16} />
            <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>
              {t('chatSupport')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'report' && styles.tabBtnActive]}
            onPress={() => setActiveTab('report')}
          >
            <AlertTriangle color={activeTab === 'report' ? colors.gold : colors.textMuted} size={16} />
            <Text style={[styles.tabText, activeTab === 'report' && styles.tabTextActive]}>
              {t('reportIssue')}
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'chat' ? (
          /* AI Support Chat Panel */
          <View style={styles.chatContainer}>
            <ScrollView
              ref={chatScrollRef}
              style={styles.chatScroll}
              contentContainerStyle={styles.chatContent}
              showsVerticalScrollIndicator={false}
            >
              {messages.map(msg => (
                <View
                  key={msg.id}
                  style={[
                    styles.messageRow,
                    msg.sender === 'user' ? styles.messageUserRow : styles.messageBotRow
                  ]}
                >
                  {msg.sender === 'bot' && (
                    <View style={styles.botAvatar}>
                      <Cpu color={colors.gold} size={15} />
                    </View>
                  )}
                  <View
                    style={[
                      styles.messageBubble,
                      msg.sender === 'user' ? styles.messageUserBubble : styles.messageBotBubble
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        msg.sender === 'user' ? styles.messageUserText : styles.messageBotText
                      ]}
                    >
                      {msg.text}
                    </Text>
                  </View>
                </View>
              ))}

              {isTyping && (
                <View style={[styles.messageRow, styles.messageBotRow]}>
                  <View style={styles.botAvatar}>
                    <Cpu color={colors.gold} size={15} />
                  </View>
                  <View style={[styles.messageBubble, styles.messageBotBubble, styles.typingBubble]}>
                    <ActivityIndicator size="small" color={colors.gold} />
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Quick replies */}
            <View style={styles.quickRepliesContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRepliesContent}>
                <TouchableOpacity
                  style={styles.quickChip}
                  onPress={() => handleSendMessage(lang === 'am' ? 'ነጥብ እንዴት ይሰበሰባል?' : 'How to earn points?')}
                >
                  <Coins color={colors.textSecondary} size={12} />
                  <Text style={styles.quickChipText}>{lang === 'am' ? 'ነጥብ ማግኘት' : 'Points'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickChip}
                  onPress={() => handleSendMessage(lang === 'am' ? 'ውድድሮች እንዴት ይሰራሉ?' : 'How do tournaments work?')}
                >
                  <Trophy color={colors.textSecondary} size={12} />
                  <Text style={styles.quickChipText}>{lang === 'am' ? 'ውድድሮች' : 'Tournaments'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickChip}
                  onPress={() => handleSendMessage(lang === 'am' ? 'ስለ ዛፍ ጨዋታ ንገረኝ' : 'Tell me about the Tree Grower game')}
                >
                  <TreePine color={colors.textSecondary} size={12} />
                  <Text style={styles.quickChipText}>{lang === 'am' ? 'ዛፍ ጨዋታ' : 'Tree Grower'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickChip}
                  onPress={() => handleSendMessage(lang === 'am' ? 'ዕለታዊ ተከታታይ (streak) ጥቅሙ ምንድነው?' : 'How daily streaks work?')}
                >
                  <Flame color={colors.textSecondary} size={12} />
                  <Text style={styles.quickChipText}>{lang === 'am' ? 'ዕለታዊ ተከታታይ' : 'Daily Streaks'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickChip}
                  onPress={() => handleSendMessage(lang === 'am' ? 'ሽልማት እንዴት ይከፈላል?' : 'How are rewards paid?')}
                >
                  <Gift color={colors.textSecondary} size={12} />
                  <Text style={styles.quickChipText}>{lang === 'am' ? 'ሽልማቶች' : 'Rewards'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Input Bar */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.chatInput}
                placeholder={t('enterMessage')}
                placeholderTextColor={colors.textMuted}
                value={inputMessage}
                onChangeText={setInputMessage}
                onSubmitEditing={() => handleSendMessage(inputMessage)}
              />
              <TouchableOpacity
                style={[styles.sendBtn, !inputMessage.trim() && styles.sendBtnDisabled]}
                onPress={() => handleSendMessage(inputMessage)}
                disabled={!inputMessage.trim()}
              >
                <Send color={colors.bgDeep} size={16} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Issue Reporting Panel */
          <ScrollView contentContainerStyle={styles.reportContent}>
            {submittedSuccessfully ? (
              <View style={styles.successCard}>
                <CheckCircle color={colors.success} size={48} />
                <Text style={styles.successTitle}>{t('reportSuccess')}</Text>
                <Text style={styles.successSub}>
                  We have logged this issue in our support database and opened your email client to send details to Omereliaskamil@gmail.com.
                </Text>
                <TouchableOpacity
                  style={styles.newReportBtn}
                  onPress={() => setSubmittedSuccessfully(false)}
                >
                  <Text style={styles.newReportBtnText}>Submit Another Report</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.reportForm}>
                <Text style={styles.formLabel}>{t('selectCategory')}</Text>
                <View style={styles.categoryGrid}>
                  {(['bug', 'payment', 'tournament', 'other'] as const).map(catKey => (
                    <TouchableOpacity
                      key={catKey}
                      style={[
                        styles.categoryChip,
                        category === catKey && styles.categoryChipActive
                      ]}
                      onPress={() => setCategory(catKey)}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          category === catKey && styles.categoryChipTextActive
                        ]}
                      >
                        {getCategoryLabel(catKey)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.formLabel}>{t('subjectLabel')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter brief subject"
                  placeholderTextColor={colors.textMuted}
                  value={subject}
                  onChangeText={setSubject}
                  editable={!submitting}
                />

                <Text style={styles.formLabel}>{t('messageLabel')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Please describe your issue in detail..."
                  placeholderTextColor={colors.textMuted}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={6}
                  editable={!submitting}
                />

                <Text style={styles.emailDisclaimer}>
                  Your report will be saved to our database and prepared as an email to Omereliaskamil@gmail.com
                </Text>

                <TouchableOpacity
                  style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                  onPress={handleSubmitReport}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={colors.bgDeep} />
                  ) : (
                    <Text style={styles.submitBtnText}>{t('sendReport')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  title: { color: colors.gold, fontSize: 18, fontWeight: '800' },
  
  // Segmented Tabs
  tabsWrap: {
    flexDirection: 'row', backgroundColor: '#0D0618', borderRadius: radius.md,
    margin: spacing.md, padding: 4, borderWidth: 1, borderColor: '#3D1F6E50',
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: radius.sm,
  },
  tabBtnActive: { backgroundColor: '#1E0C32', borderWidth: 1, borderColor: colors.gold + '30' },
  tabText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  tabTextActive: { color: colors.gold },

  // Chat panel
  chatContainer: { flex: 1 },
  chatScroll: { flex: 1 },
  chatContent: { padding: spacing.md, gap: spacing.md },
  messageRow: { flexDirection: 'row', marginVertical: 2, alignItems: 'flex-end', gap: spacing.sm },
  messageUserRow: { justifyContent: 'flex-end' },
  messageBotRow: { justifyContent: 'flex-start' },
  botAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,215,0,0.12)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
  },
  messageBubble: { padding: 12, borderRadius: radius.lg, maxWidth: '80%', ...shadow.card },
  messageUserBubble: { backgroundColor: colors.gold, borderBottomRightRadius: 2 },
  messageBotBubble: { backgroundColor: '#1C0D3280', borderBottomLeftRadius: 2, borderWidth: 1, borderColor: '#3D1F6E50' },
  typingBubble: { paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  messageText: { fontSize: 13, lineHeight: 18 },
  messageUserText: { color: colors.bgDeep, fontWeight: '700' },
  messageBotText: { color: colors.textPrimary, fontWeight: '600' },

  // Quick replies
  quickRepliesContainer: { paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border },
  quickRepliesContent: { paddingHorizontal: spacing.md, gap: spacing.sm },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0D0618', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.full, borderWidth: 1, borderColor: '#3D1F6E60',
  },
  quickChipText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },

  // Chat Input
  inputContainer: {
    flexDirection: 'row', padding: spacing.md, gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg,
  },
  chatInput: {
    flex: 1, backgroundColor: '#0D0618', borderWidth: 1.5, borderColor: '#3D1F6E60',
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10,
    color: colors.textPrimary, fontSize: 13,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.gold,
    alignItems: 'center', justifyContent: 'center', ...shadow.gold,
  },
  sendBtnDisabled: { opacity: 0.5 },

  // Reporting Form panel
  reportContent: { padding: spacing.md },
  reportForm: { gap: spacing.md },
  formLabel: { color: colors.textPrimary, fontWeight: '800', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1, borderColor: '#3D1F6E60', backgroundColor: '#0D0618',
  },
  categoryChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  categoryChipText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  categoryChipTextActive: { color: colors.bgDeep },
  input: {
    backgroundColor: '#0D0618', borderWidth: 1.5, borderColor: '#3D1F6E60',
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    color: colors.textPrimary, fontSize: 14,
  },
  textArea: { textAlignVertical: 'top', minHeight: 120 },
  emailDisclaimer: { color: colors.textMuted, fontSize: 11, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },
  submitBtn: {
    backgroundColor: colors.gold, paddingVertical: spacing.md, borderRadius: radius.md,
    alignItems: 'center', marginTop: spacing.md, ...shadow.gold,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: colors.bgDeep, fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },

  // Success screen
  successCard: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md, paddingTop: 40 },
  successTitle: { color: colors.success, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  successSub: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  newReportBtn: { backgroundColor: '#1C0D3280', borderWidth: 1.5, borderColor: '#3D1F6E60', paddingVertical: 12, paddingHorizontal: 20, borderRadius: radius.md, marginTop: spacing.md },
  newReportBtnText: { color: colors.gold, fontWeight: '800', fontSize: 13 },
});
