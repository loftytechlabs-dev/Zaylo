import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  StatusBar,
  TouchableOpacity,
  Text,
  Platform,
  Animated,
} from 'react-native';
import { darkTheme, lightTheme, Theme } from './src/theme/theme';
import type {
  ChatMessage,
  OnDeviceModel,
  MemoryPagingConfig,
  DeviceMemoryProfile,
} from './src/types';
import { DeviceProfiler } from './src/engine/deviceProfiler';
import { MobileMemoryPagingEngine } from './src/engine/memoryPaging';
import { ZAYLO_MODELS } from './src/engine/modelsCatalog';
import { ModelStorage } from './src/engine/modelStorage';
import { OnDeviceEngine } from './src/engine/onDeviceEngine';
import { ModelsView } from './src/components/ModelsView';
import { ChatHeader } from './src/components/ChatHeader';
import { ChatView } from './src/components/ChatView';
import { MessageInput } from './src/components/MessageInput';
import { Icon } from './src/components/common/Icon';

type ActiveScreen = 'chat' | 'models';

export default function App() {
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const theme: Theme = useMemo(
    () => (themeMode === 'light' ? lightTheme : darkTheme),
    [themeMode]
  );
  const toggleTheme = () => {
    setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('chat');
  const screenFadeAnim = useRef(new Animated.Value(1)).current;

  const navigateToScreen = (screen: ActiveScreen) => {
    if (screen === activeScreen) return;
    Animated.timing(screenFadeAnim, {
      toValue: 0.2,
      duration: 80,
      useNativeDriver: true,
    }).start(() => {
      setActiveScreen(screen);
      Animated.timing(screenFadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  const initialProfile = useMemo(() => DeviceProfiler.profileDevice(), []);
  const [profile] = useState<DeviceMemoryProfile>(initialProfile);
  const [pagingConfig, setPagingConfig] = useState<MemoryPagingConfig>(
    initialProfile.pagingConfig
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeLocalModel, setActiveLocalModel] = useState<OnDeviceModel | null>(null);
  const cancelStreamRef = useRef<(() => void) | null>(null);

  // Auto-detect downloaded models on phone storage and load the best one
  useEffect(() => {
    const unsub = ModelStorage.subscribeToInstalled((installedIds) => {
      if (installedIds.length > 0) {
        setActiveLocalModel((prev) => {
          if (prev) return prev;
          const found = ZAYLO_MODELS.find((m) => installedIds.includes(m.id));
          if (found) {
            const converted: OnDeviceModel = {
              id: found.id,
              name: found.name,
              tagline: found.description,
              parameters: found.parameterCount,
              sizeMb: found.sizeMb,
              requiredRamMb: Math.round(found.sizeMb * 1.3),
              minTier: found.sizeMb > 1500 ? 'tier_3_flagship' : 'tier_2_balanced',
              quantization: found.quantization,
              downloadUrl: found.downloadUrl,
              isDownloaded: true,
            };
            const optimized = MobileMemoryPagingEngine.optimizePagingConfig(
              converted,
              profile.availableRamMb
            );
            setPagingConfig(optimized);
            OnDeviceEngine.loadModel(converted, optimized).catch(() => {});
            return converted;
          }
          return null;
        });
      }
    });
    return unsub;
  }, [profile.availableRamMb]);

  const handleSelectModel = (model: OnDeviceModel | null) => {
    setActiveLocalModel(model);
    if (model) {
      const optimized = MobileMemoryPagingEngine.optimizePagingConfig(
        model,
        profile.availableRamMb
      );
      setPagingConfig(optimized);
      OnDeviceEngine.loadModel(model, optimized).catch(() => {});
    } else {
      OnDeviceEngine.unloadModel().catch(() => {});
    }
  };

  const handleSendMessage = async (text: string) => {
    if (activeScreen !== 'chat') {
      navigateToScreen('chat');
    }

    if (cancelStreamRef.current) {
      cancelStreamRef.current();
      cancelStreamRef.current = null;
    }

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const assistantId = `msg_${Date.now()}_a`;
    const initialAssistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    const newHistory = [...messages, userMessage];
    setMessages([...newHistory, initialAssistantMessage]);
    setIsStreaming(true);

    // If no model is downloaded or loaded
    if (!activeLocalModel) {
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    '⚠️ **No local model loaded.**\n\nPlease download a lightweight model like **SmolLM2 (135MB)** or **Qwen 2.5 (491MB)** from the Models tab below to chat completely offline on your phone!',
                  isStreaming: false,
                }
              : m
          )
        );
        setIsStreaming(false);
      }, 300);
      return;
    }

    try {
      const cancelFn = await OnDeviceEngine.generateCompletion(
        newHistory,
        pagingConfig,
        (chunk: string) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m
            )
          );
        },
        (metrics) => {
          setIsStreaming(false);
          cancelStreamRef.current = null;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, isStreaming: false, metrics } : m
            )
          );
        }
      );

      cancelStreamRef.current = cancelFn;
    } catch (err: any) {
      setIsStreaming(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: `\n\n[Inference Error: ${err?.message || String(err)}]`,
                isStreaming: false,
              }
            : m
        )
      );
    }
  };

  const handleStopGeneration = () => {
    if (cancelStreamRef.current) {
      cancelStreamRef.current();
      cancelStreamRef.current = null;
    }
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    );
  };

  const handleClearChat = () => {
    if (cancelStreamRef.current) {
      cancelStreamRef.current();
      cancelStreamRef.current = null;
    }
    setIsStreaming(false);
    setMessages([]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      <Animated.View style={[styles.screenContainer, { opacity: screenFadeAnim }]}>
        {activeScreen === 'chat' && (
          <View style={styles.chatScreenContainer}>
            <ChatHeader
              theme={theme}
              activeLocalModel={activeLocalModel}
              onOpenModels={() => navigateToScreen('models')}
              onClearChat={handleClearChat}
              onToggleTheme={toggleTheme}
            />

            <ChatView
              theme={theme}
              messages={messages}
              isStreaming={isStreaming}
              activeLocalModel={activeLocalModel}
              onSelectPromptSuggestion={handleSendMessage}
              onOpenModelModal={() => navigateToScreen('models')}
              onSelectModel={handleSelectModel}
            />

            <MessageInput
              theme={theme}
              onSendMessage={handleSendMessage}
              onStopGeneration={handleStopGeneration}
              isStreaming={isStreaming}
              onAttachMedia={() => {
                handleSendMessage('[Attached image from camera: diagram.png] Please analyze this image.');
              }}
            />
          </View>
        )}

        {activeScreen === 'models' && (
          <ModelsView
            theme={theme}
            activeModel={activeLocalModel}
            profile={profile}
            pagingConfig={pagingConfig}
            onSelectModel={handleSelectModel}
            onBackToHome={() => navigateToScreen('chat')}
            onOpenChat={() => navigateToScreen('chat')}
          />
        )}
      </Animated.View>

      {/* Clean Dual-Tab Floating Navigation (Chat & Models) */}
      <View
        style={[
          styles.floatingNavBar,
          { backgroundColor: theme.floatingNav },
          theme.shadows.floating,
        ]}
      >
        <TouchableOpacity
          style={[
            styles.navTab,
            activeScreen === 'chat' && [
              styles.navTabActive,
              { backgroundColor: theme.floatingNavActive },
            ],
          ]}
          onPress={() => navigateToScreen('chat')}
          activeOpacity={0.8}
        >
          <Icon
            name="message-square"
            size={18}
            color={activeScreen === 'chat' ? '#ffffff' : theme.floatingNavText}
          />
          <Text
            style={[
              styles.navTabText,
              {
                color:
                  activeScreen === 'chat' ? '#ffffff' : theme.floatingNavText,
              },
            ]}
          >
            Chat
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navTab,
            activeScreen === 'models' && [
              styles.navTabActive,
              { backgroundColor: theme.floatingNavActive },
            ],
          ]}
          onPress={() => navigateToScreen('models')}
          activeOpacity={0.8}
        >
          <Icon
            name="cpu"
            size={18}
            color={activeScreen === 'models' ? '#ffffff' : theme.floatingNavText}
          />
          <Text
            style={[
              styles.navTabText,
              {
                color:
                  activeScreen === 'models' ? '#ffffff' : theme.floatingNavText,
              },
            ]}
          >
            Models
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  chatScreenContainer: {
    flex: 1,
    paddingBottom: 68,
  },
  floatingNavBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 14,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: 32,
    paddingVertical: 6,
    paddingHorizontal: 8,
    zIndex: 999,
  },
  navTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 22,
    borderRadius: 24,
    gap: 8,
  },
  navTabActive: {
    backgroundColor: '#1e293b',
  },
  navTabText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
