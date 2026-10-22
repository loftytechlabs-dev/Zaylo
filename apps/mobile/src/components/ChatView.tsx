import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  ActivityIndicator,
} from 'react-native';
import type { Theme } from '../theme/theme';
import type { ChatMessage, HybridMode, OnDeviceModel, DownloadProgress } from '../types';
import { ZAYLO_MODELS, ZayloModel } from '../engine/modelsCatalog';
import { ModelStorage } from '../engine/modelStorage';
import { ZLogo } from './common/ZLogo';
import { Icon } from './common/Icon';

interface ChatViewProps {
  theme: Theme;
  messages: ChatMessage[];
  isStreaming: boolean;
  activeLocalModel?: OnDeviceModel | null;
  onSelectPromptSuggestion: (prompt: string) => void;
  onOpenModelModal?: () => void;
  onSelectModel?: (model: OnDeviceModel) => void;
}

interface ChatSuggestion {
  iconName: string;
  text: string;
}

const CHAT_SUGGESTIONS: ChatSuggestion[] = [
  { iconName: 'code', text: 'Help me refactor a function for performance' },
  { iconName: 'terminal', text: 'Explain the difference between TCP and UDP' },
  { iconName: 'database', text: 'How do database indexes improve query speed?' },
  { iconName: 'file-text', text: 'Draft a clean technical release note' },
];

/**
 * Animated Pulsing Token Streaming Cursor
 */
const BlinkingCursor: React.FC<{ color: string }> = ({ color }) => {
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.15,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacityAnim]);

  return (
    <Animated.Text style={{ color, opacity: opacityAnim, fontWeight: '800' }}>
      {' ▋'}
    </Animated.Text>
  );
};

/**
 * Animated Suggestion Chip with Tactile Spring Scale
 */
const SuggestionChipItem: React.FC<{
  item: ChatSuggestion;
  theme: Theme;
  onPress: () => void;
}> = ({ item, theme, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          styles.suggestionChip,
          {
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
          },
          theme.shadows.sm,
        ]}
        onPressIn={() =>
          Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start()
        }
        onPressOut={() =>
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 6,
            tension: 70,
            useNativeDriver: true,
          }).start()
        }
        onPress={onPress}
        activeOpacity={0.85}
      >
        <View
          style={[
            styles.suggestionIconBox,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <Icon name={item.iconName} size={15} color={theme.accent} />
        </View>
        <Text
          style={[styles.suggestionText, { color: theme.textPrimary }]}
          numberOfLines={2}
        >
          {item.text}
        </Text>
        <Icon name="arrow-up-right" size={14} color={theme.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
};

/**
 * Animated Message Bubble Row with Smooth Spring Entrance
 */
const MessageRowItem: React.FC<{
  message: ChatMessage;
  theme: Theme;
}> = ({ message, theme }) => {
  const isUser = message.role === 'user';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <Animated.View
      style={[
        styles.messageRow,
        isUser ? styles.userRow : styles.assistantRow,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {message.imageUri && (
        <Image source={{ uri: message.imageUri }} style={styles.attachedImage} />
      )}

      <View
        style={[
          styles.bubble,
          isUser
            ? [
                styles.userBubble,
                {
                  backgroundColor: theme.userBubble,
                },
                theme.shadows.sm,
              ]
            : [
                styles.assistantBubble,
                {
                  backgroundColor: theme.assistantBubble,
                  borderColor: theme.assistantBorder,
                },
                theme.shadows.sm,
              ],
        ]}
      >
        <Text
          style={[
            styles.messageText,
            { color: isUser ? theme.userText : theme.assistantText },
          ]}
        >
          {message.content}
          {message.isStreaming && <BlinkingCursor color={theme.accent} />}
        </Text>
      </View>

      {!isUser && message.metrics && (
        <View
          style={[
            styles.metricsBadge,
            {
              backgroundColor: theme.cardElevated,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <Icon
            name={
              message.metrics.backendUsed === 'on_device_paged'
                ? 'cpu'
                : 'monitor'
            }
            size={11}
            color={theme.accent}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.metricsText, { color: theme.textMuted }]}>
            {message.metrics.tokensPerSec} tok/s • {message.metrics.ttftMs}ms TTFT
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

export const ChatView: React.FC<ChatViewProps> = ({
  theme,
  messages,
  isStreaming,
  activeLocalModel,
  onSelectPromptSuggestion,
  onOpenModelModal,
  onSelectModel,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [downloadProgressMap, setDownloadProgressMap] = useState<Record<string, DownloadProgress>>({});

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, isStreaming]);

  const handleStartDownload = (model: ZayloModel) => {
    ModelStorage.startDownload(
      model,
      (progress) => {
        setDownloadProgressMap((prev) => ({
          ...prev,
          [model.id]: progress,
        }));
      },
      () => {
        // Download complete - activate model immediately
        setDownloadProgressMap((prev) => {
          const next = { ...prev };
          delete next[model.id];
          return next;
        });
        const converted: OnDeviceModel = {
          id: model.id,
          name: model.name,
          tagline: model.description,
          parameters: model.parameterCount,
          sizeMb: model.sizeMb,
          requiredRamMb: Math.round(model.sizeMb * 1.3),
          minTier: model.sizeMb > 1500 ? 'tier_3_flagship' : 'tier_2_balanced',
          quantization: model.quantization,
          downloadUrl: model.downloadUrl,
          isDownloaded: true,
        };
        if (onSelectModel) {
          onSelectModel(converted);
        }
      }
    );
  };

  if (messages.length === 0) {
    // Top mobile-first starter models
    const starterModels = ZAYLO_MODELS.slice(0, 2);

    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.emptyContentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.emptyHeroCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            },
            theme.shadows.md,
          ]}
        >
          <View style={styles.emptyLogoWrapper}>
            <ZLogo
              size={36}
              variant={theme.isDark ? 'white' : 'dark'}
              withContainer
              containerBg={theme.isDark ? '#1a1d26' : '#f1f5f9'}
              containerStyle={{
                borderWidth: 1,
                borderColor: theme.cardBorder,
                marginBottom: 16,
              }}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
            {activeLocalModel ? activeLocalModel.name : 'On-Device Mobile AI'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
            {activeLocalModel
              ? 'Zero-cloud execution on phone hardware with native C++ llama.rn.'
              : 'Download a lightweight AI model directly to your phone to chat 100% offline with zero cloud latency.'}
          </Text>

          {!activeLocalModel && (
            <View style={styles.starterModelsSection}>
              {starterModels.map((m) => {
                const isDownloaded = ModelStorage.isModelDownloaded(m.id);
                const progress = downloadProgressMap[m.id];
                const isDownloading = progress?.status === 'downloading';

                return (
                  <View
                    key={m.id}
                    style={[
                      styles.starterCard,
                      {
                        backgroundColor: theme.backgroundSecondary,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <View style={styles.starterCardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.starterCardTitle, { color: theme.textPrimary }]}>
                          {m.name}
                        </Text>
                        <Text style={[styles.starterCardDesc, { color: theme.textMuted }]}>
                          {m.sizeMb} MB • {m.quantization} • {m.parameterCount}
                        </Text>
                      </View>
                      {isDownloaded ? (
                        <TouchableOpacity
                          style={[styles.starterBtn, { backgroundColor: theme.success }]}
                          onPress={() => {
                            const converted: OnDeviceModel = {
                              id: m.id,
                              name: m.name,
                              tagline: m.description,
                              parameters: m.parameterCount,
                              sizeMb: m.sizeMb,
                              requiredRamMb: Math.round(m.sizeMb * 1.3),
                              minTier: m.sizeMb > 1500 ? 'tier_3_flagship' : 'tier_2_balanced',
                              quantization: m.quantization,
                              downloadUrl: m.downloadUrl,
                              isDownloaded: true,
                            };
                            if (onSelectModel) onSelectModel(converted);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.starterBtnText}>Load & Chat</Text>
                        </TouchableOpacity>
                      ) : isDownloading ? (
                        <View style={styles.starterDownloadingBadge}>
                          <ActivityIndicator size="small" color={theme.accent} />
                          <Text style={[styles.starterProgressText, { color: theme.accent }]}>
                            {progress.percent}%
                          </Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.starterBtn, { backgroundColor: theme.floatingNav }]}
                          onPress={() => handleStartDownload(m)}
                          activeOpacity={0.8}
                        >
                          <Icon name="download" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                          <Text style={styles.starterBtnText}>Download</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {isDownloading && (
                      <View style={styles.starterProgressBarWrapper}>
                        <View style={[styles.starterProgressBarTrack, { backgroundColor: theme.cardBorder }]}>
                          <View
                            style={[
                              styles.starterProgressBarFill,
                              {
                                width: `${progress.percent}%`,
                                backgroundColor: theme.accent,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.starterProgressMeta, { color: theme.textMuted }]}>
                          {progress.downloadedMb} / {progress.totalMb} MB {progress.speedMbS > 0 ? `• ${progress.speedMbS} MB/s` : ''}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {onOpenModelModal && (
                <TouchableOpacity
                  style={[styles.browseAllBtn, { borderColor: theme.cardBorder }]}
                  onPress={onOpenModelModal}
                  activeOpacity={0.8}
                >
                  <Icon name="layers" size={14} color={theme.textPrimary} style={{ marginRight: 6 }} />
                  <Text style={[styles.browseAllText, { color: theme.textPrimary }]}>
                    Browse All 7 Mobile Models
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {activeLocalModel && (
          <View style={styles.suggestionsWrapper}>
            <Text style={[styles.suggestionsLabel, { color: theme.textMuted }]}>
              SUGGESTIONS
            </Text>
            {CHAT_SUGGESTIONS.map((item, idx) => (
              <SuggestionChipItem
                key={idx}
                item={item}
                theme={theme}
                onPress={() => onSelectPromptSuggestion(item.text)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      ref={scrollViewRef}
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.messagesContainer}
      showsVerticalScrollIndicator={false}
    >
      {messages.map((message) => (
        <MessageRowItem key={message.id} message={message} theme={theme} />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContentContainer: {
    padding: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  emptyHeroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyLogoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 290,
  },
  selectModelCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 22,
    marginTop: 18,
  },
  selectModelCtaText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  suggestionsWrapper: {
    gap: 10,
  },
  suggestionsLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  suggestionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  messagesContainer: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
  },
  messageRow: {
    marginBottom: 18,
    maxWidth: '85%',
  },
  userRow: {
    alignSelf: 'flex-end',
  },
  assistantRow: {
    alignSelf: 'flex-start',
  },
  attachedImage: {
    width: 200,
    height: 130,
    borderRadius: 16,
    marginBottom: 8,
  },
  bubble: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  userBubble: {
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    borderWidth: 1.5,
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  metricsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  metricsText: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  starterModelsSection: {
    width: '100%',
    marginTop: 18,
    gap: 10,
  },
  starterCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  starterCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  starterCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  starterCardDesc: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  starterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  starterBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  starterDownloadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  starterProgressText: {
    fontSize: 12,
    fontWeight: '700',
  },
  starterProgressBarWrapper: {
    marginTop: 10,
  },
  starterProgressBarTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
  },
  starterProgressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  starterProgressMeta: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  },
  browseAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  browseAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
