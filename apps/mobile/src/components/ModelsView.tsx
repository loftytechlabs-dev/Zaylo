import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { Theme } from '../theme/theme';
import type { OnDeviceModel, DeviceMemoryProfile, MemoryPagingConfig, DownloadProgress } from '../types';
import { ZAYLO_MODELS, ZayloModel } from '../engine/modelsCatalog';
import { ModelStorage } from '../engine/modelStorage';
import { OnDeviceEngine } from '../engine/onDeviceEngine';
import { Icon } from './common/Icon';

/**
 * Smooth Animated Progress Bar for progressive model weight downloads
 */
const SmoothProgressBar: React.FC<{
  percent: number;
  trackColor: string;
  fillColor: string;
}> = ({ percent, trackColor, fillColor }) => {
  const animatedPercent = useRef(new Animated.Value(percent)).current;

  useEffect(() => {
    Animated.timing(animatedPercent, {
      toValue: Math.max(0, Math.min(100, percent)),
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [percent, animatedPercent]);

  const widthInterpolated = animatedPercent.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.progressBarTrack, { backgroundColor: trackColor }]}>
      <Animated.View
        style={[
          styles.progressBarFill,
          {
            width: widthInterpolated,
            backgroundColor: fillColor,
          },
        ]}
      />
    </View>
  );
};

interface ModelsViewProps {
  theme: Theme;
  activeModel: OnDeviceModel | null;
  profile: DeviceMemoryProfile;
  pagingConfig: MemoryPagingConfig;
  onSelectModel: (model: OnDeviceModel | null) => void;
  onBackToHome: () => void;
  onOpenChat: () => void;
}

type ModelCategory = 'all' | 'installed' | 'compact' | 'flagship' | 'reasoning';

export const ModelsView: React.FC<ModelsViewProps> = ({
  theme,
  activeModel,
  profile,
  pagingConfig,
  onSelectModel,
  onBackToHome,
  onOpenChat,
}) => {
  const [activeCategory, setActiveCategory] = useState<ModelCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [installedIds, setInstalledIds] = useState<string[]>(() =>
    ModelStorage.getInstalledModelIds()
  );
  const [downloadProgressMap, setDownloadProgressMap] = useState<Record<string, DownloadProgress>>({});
  const [availableStorageGb, setAvailableStorageGb] = useState<number>(32.0);

  // Probe live device flash storage
  useEffect(() => {
    ModelStorage.getStorageStatsAsync().then((stats) => {
      if (stats.freeSpaceGb > 0) {
        setAvailableStorageGb(stats.freeSpaceGb);
      }
    });
  }, [installedIds]);

  // Subscribe to installed models updates
  useEffect(() => {
    const unsub = ModelStorage.subscribeToInstalled((ids) => {
      setInstalledIds(ids);
    });
    return unsub;
  }, []);

  // Filter models
  const filteredModels = useMemo(() => {
    let list: ZayloModel[] = ZAYLO_MODELS;
    const currentInstalled = installedIds || [];

    if (activeCategory === 'installed') {
      list = ZAYLO_MODELS.filter((m) => currentInstalled.includes(m.id));
    } else if (activeCategory === 'compact') {
      list = ZAYLO_MODELS.filter((m) => m.sizeMb < 1000);
    } else if (activeCategory === 'flagship') {
      list = ZAYLO_MODELS.filter((m) => m.sizeMb >= 1000);
    } else if (activeCategory === 'reasoning') {
      list = ZAYLO_MODELS.filter((m) => {
        const caps = m.capabilities || [];
        return caps.includes('REASONING') || caps.includes('CHAIN_OF_THOUGHT');
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          (m.name || '').toLowerCase().includes(q) ||
          (m.publisher || '').toLowerCase().includes(q) ||
          (m.parameterCount || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [activeCategory, searchQuery, installedIds]);

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
        // Download complete - immediately activate and load into memory
        setDownloadProgressMap((prev) => {
          const next = { ...prev };
          delete next[model.id];
          return next;
        });
        handleLoadModel(model);
      }
    );
  };

  const handleCancelDownload = (modelId: string) => {
    ModelStorage.cancelDownload(modelId);
    setDownloadProgressMap((prev) => {
      const next = { ...prev };
      delete next[modelId];
      return next;
    });
  };

  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);

  const handleLoadModel = async (model: ZayloModel) => {
    try {
      setLoadingModelId(model.id);
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

      const result = await OnDeviceEngine.loadModel(converted, pagingConfig);
      if (result.success) {
        onSelectModel(converted);
        Alert.alert('Model Loaded', result.message);
      } else {
        Alert.alert('Load Model', result.message);
      }
    } catch (err: any) {
      Alert.alert('Load Model Error', err?.message || 'Failed to initialize model in memory.');
    } finally {
      setLoadingModelId(null);
    }
  };

  const handleUnloadModel = async () => {
    await OnDeviceEngine.unloadModel();
    onSelectModel(null);
  };

  const handleDeleteModel = (modelId: string) => {
    if (activeModel?.id === modelId) {
      onSelectModel(null);
    }
    ModelStorage.deleteModel(modelId);
  };

  // Publisher styling
  const getPublisherColors = (publisher: string) => {
    switch (publisher.toLowerCase()) {
      case 'meta':
        return { bg: theme.pastels.blue.bg, text: theme.pastels.blue.text };
      case 'qwen':
        return { bg: theme.pastels.purple.bg, text: theme.pastels.purple.text };
      case 'microsoft':
        return { bg: theme.pastels.yellow.bg, text: theme.pastels.yellow.text };
      case 'mistral ai':
        return { bg: '#ffedd5', text: '#ea580c' };
      case 'deepseek':
        return { bg: '#e0e7ff', text: '#4338ca' };
      default:
        return { bg: theme.backgroundSecondary, text: theme.textSecondary };
    }
  };

  const totalInstalledSizeMb = useMemo(() => {
    return ZAYLO_MODELS
      .filter((m) => (installedIds || []).includes(m.id))
      .reduce((acc, curr) => acc + curr.sizeMb, 0);
  }, [installedIds]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={[
            styles.backButton,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
            theme.shadows.sm,
          ]}
          onPress={onBackToHome}
          activeOpacity={0.7}
        >
          <Icon name="arrow-left" size={18} color={theme.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            Model Studio
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
            Certified On-Device SLM Library
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.chatShortcutBtn,
            { backgroundColor: theme.floatingNav },
            theme.shadows.sm,
          ]}
          onPress={onOpenChat}
          activeOpacity={0.8}
        >
          <Icon name="message-square" size={14} color="#ffffff" />
          <Text style={styles.chatShortcutText}>Chat</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Device Storage & Model Cache Summary Card */}
      <View
        style={[
          styles.storageCard,
          { backgroundColor: theme.card, borderColor: theme.cardBorder },
          theme.shadows.sm,
        ]}
      >
        <View style={styles.storageCardTop}>
          <View style={styles.storageLeft}>
            <View style={[styles.storageIconBox, { backgroundColor: theme.pastels.blue.bg }]}>
              <Icon name="hard-drive" size={18} color={theme.pastels.blue.text} />
            </View>
            <View>
              <Text style={[styles.storageTitle, { color: theme.textPrimary }]}>
                Flash Storage Allocation
              </Text>
              <Text style={[styles.storageSubtitle, { color: theme.textMuted }]}>
                {installedIds.length} Installed ({totalInstalledSizeMb} MB) • {availableStorageGb} GB Available
              </Text>
            </View>
          </View>

          {activeModel && (
            <View style={[styles.activeModelChip, { backgroundColor: theme.successLight }]}>
              <View style={[styles.activeModelDot, { backgroundColor: theme.success }]} />
              <Text style={[styles.activeModelChipText, { color: theme.success }]}>
                {activeModel.parameters} LOADED
              </Text>
            </View>
          )}
        </View>

        {/* Visual Flash Bar */}
        <SmoothProgressBar
          percent={Math.min(100, Math.max(8, Math.round((totalInstalledSizeMb / 8000) * 100)))}
          trackColor={theme.backgroundSecondary}
          fillColor={theme.pastels.blue.text}
        />
      </View>

      {/* 3. Search Bar */}
      <View
        style={[
          styles.searchBar,
          { backgroundColor: theme.card, borderColor: theme.cardBorder },
          theme.shadows.sm,
        ]}
      >
        <Icon name="search" size={16} color={theme.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: theme.textPrimary }]}
          placeholder="Search models by name, publisher, size..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
            <Icon name="x" size={15} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* 4. Category Filter Chips */}
      <View style={styles.categorySection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {[
            { id: 'all', label: `All Models (${ZAYLO_MODELS.length})` },
            { id: 'installed', label: `Installed (${installedIds.length})` },
            { id: 'compact', label: 'Compact (< 1GB)' },
            { id: 'flagship', label: 'Flagship (3B+)' },
            { id: 'reasoning', label: 'Reasoning & CoT' },
          ].map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryPill,
                  isSelected
                    ? [styles.categoryPillActive, { backgroundColor: theme.floatingNav }, theme.shadows.sm]
                    : [styles.categoryPillInactive, { backgroundColor: theme.card, borderColor: theme.cardBorder }],
                ]}
                onPress={() => setActiveCategory(cat.id as ModelCategory)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryText,
                    {
                      color: isSelected ? '#ffffff' : theme.textPrimary,
                      fontWeight: isSelected ? '700' : '600',
                    },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 5. Models List */}
      <View style={styles.modelsList}>
        {filteredModels.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Icon name="layers" size={28} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Models Found</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
              {activeCategory === 'installed'
                ? 'You have not downloaded any models yet. Switch to "All Models" to browse and download.'
                : 'No models match your search query.'}
            </Text>
          </View>
        ) : (
          filteredModels.map((model) => {
            const isDownloaded = (installedIds || []).includes(model.id);
            const isSelected = activeModel?.id === model.id;
            const progress = downloadProgressMap[model.id];
            const isDownloading = !!progress && progress.status === 'downloading';
            const pubColors = getPublisherColors(model.publisher);

            return (
              <View
                key={model.id}
                style={[
                  styles.modelCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: isSelected ? theme.accent : theme.cardBorder,
                  },
                  isSelected && styles.modelCardSelected,
                  theme.shadows.sm,
                ]}
              >
                {/* Top Badges Row */}
                <View style={styles.topBadgesRow}>
                  <View style={styles.badgesLeft}>
                    <View style={[styles.pubChip, { backgroundColor: pubColors.bg }]}>
                      <Text style={[styles.pubChipText, { color: pubColors.text }]}>
                        {model.publisher}
                      </Text>
                    </View>
                    {model.capabilities && model.capabilities[0] && (
                      <View style={[styles.capChip, { backgroundColor: theme.backgroundSecondary }]}>
                        <Text style={[styles.capChipText, { color: theme.textMuted }]} numberOfLines={1}>
                          {model.capabilities[0]}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={[styles.quantBadge, { backgroundColor: theme.backgroundSecondary }]}>
                    <Text style={[styles.quantBadgeText, { color: theme.textSecondary }]}>
                      {model.quantization}
                    </Text>
                  </View>
                </View>

                {/* Model Name & Tagline */}
                <Text style={[styles.modelName, { color: theme.textPrimary }]} numberOfLines={1}>
                  {model.name}
                </Text>
                <Text style={[styles.modelDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                  {model.description}
                </Text>

                {/* Specs Row */}
                <View style={[styles.specsRow, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
                  <View style={styles.specBox}>
                    <Text style={[styles.specLabel, { color: theme.textMuted }]} numberOfLines={1}>FILE SIZE</Text>
                    <Text style={[styles.specVal, { color: theme.textPrimary }]} numberOfLines={1}>
                      {model.sizeMb} MB
                    </Text>
                  </View>
                  <View style={styles.specBox}>
                    <Text style={[styles.specLabel, { color: theme.textMuted }]} numberOfLines={1}>RAM REQ</Text>
                    <Text style={[styles.specVal, { color: theme.textPrimary }]} numberOfLines={1}>
                      ~{(model.sizeMb * 1.3 / 1024).toFixed(1)} GB
                    </Text>
                  </View>
                  <View style={styles.specBox}>
                    <Text style={[styles.specLabel, { color: theme.textMuted }]} numberOfLines={1}>CONTEXT</Text>
                    <Text style={[styles.specVal, { color: theme.textPrimary }]} numberOfLines={1}>
                      {model.contextLength} ctx
                    </Text>
                  </View>
                  <View style={styles.specBox}>
                    <Text style={[styles.specLabel, { color: theme.textMuted }]} numberOfLines={1}>PARAMS</Text>
                    <Text style={[styles.specVal, { color: theme.textPrimary }]} numberOfLines={1}>
                      {model.parameterCount}
                    </Text>
                  </View>
                </View>

                {/* Active Downloading Progress Section */}
                {isDownloading && (
                  <View style={[styles.downloadingSection, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
                    <View style={styles.downloadProgressHeader}>
                      <View style={styles.downloadStatusLeft}>
                        <View style={[styles.downloadPulseDot, { backgroundColor: theme.accent }]} />
                        <Text style={[styles.downloadProgressTitle, { color: theme.textPrimary }]}>
                          Downloading GGUF Weights
                        </Text>
                      </View>
                      <View style={[styles.percentBadge, { backgroundColor: theme.pastels.blue.bg }]}>
                        <Text style={[styles.percentBadgeText, { color: theme.pastels.blue.text }]}>
                          {progress.percent}%
                        </Text>
                      </View>
                    </View>

                    <View style={styles.progressBarWrapper}>
                      <SmoothProgressBar
                        percent={progress.percent}
                        trackColor={theme.cardBorder}
                        fillColor={theme.accent}
                      />
                    </View>

                    <View style={styles.downloadMetaRow}>
                      <Text style={[styles.downloadBytesText, { color: theme.textSecondary }]}>
                        {progress.downloadedMb} / {progress.totalMb} MB
                      </Text>
                      <Text style={[styles.downloadSpeedText, { color: theme.accent }]} numberOfLines={1}>
                        {progress.speedMbS > 0 ? `${progress.speedMbS} MB/s` : 'Connecting...'}
                        {progress.etaSeconds > 0 ? ` • ${progress.etaSeconds}s left` : ''}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.cancelDownloadBtn, { borderColor: theme.cardBorder }]}
                      onPress={() => handleCancelDownload(model.id)}
                      activeOpacity={0.7}
                    >
                      <Icon name="x" size={12} color={theme.danger} />
                      <Text style={[styles.cancelDownloadText, { color: theme.danger }]}>Cancel Download</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Proper Dedicated Action Section */}
                {!isDownloading && (
                  <View style={styles.properActionsSection}>
                    {isSelected ? (
                      // 1. ACTIVE MODEL
                      <View style={styles.properActionGroup}>
                        <View style={[styles.statusBanner, { backgroundColor: theme.successLight, borderColor: theme.success }]}>
                          <View style={[styles.activeDot, { backgroundColor: theme.success }]} />
                          <Text style={[styles.statusBannerText, { color: theme.success }]}>
                            Active in RAM • Ready for Instant Chat
                          </Text>
                        </View>
                        <View style={styles.properButtonRow}>
                          <TouchableOpacity
                            style={[styles.properPrimaryBtn, { backgroundColor: theme.success }]}
                            onPress={onOpenChat}
                            activeOpacity={0.8}
                          >
                            <Icon name="message-square" size={15} color="#ffffff" />
                            <Text style={styles.properBtnTextWhite}>Open Chat</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.properSecondaryBtn, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}
                            onPress={handleUnloadModel}
                            activeOpacity={0.7}
                          >
                            <Icon name="square" size={13} color={theme.textMuted} />
                            <Text style={[styles.properBtnTextMuted, { color: theme.textMuted }]}>Unload</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : isDownloaded ? (
                      // 2. DOWNLOADED MODEL (NOT ACTIVE)
                      <View style={styles.properActionGroup}>
                        <View style={[styles.statusBanner, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
                          <Icon name="check-circle" size={12} color={theme.success} />
                          <Text style={[styles.statusBannerText, { color: theme.textSecondary }]}>
                            Downloaded on Device Storage ({model.sizeMb} MB)
                          </Text>
                        </View>
                        <View style={styles.properButtonRow}>
                          <TouchableOpacity
                            style={[styles.properPrimaryBtn, { backgroundColor: theme.floatingNav }]}
                            onPress={() => handleLoadModel(model)}
                            activeOpacity={0.8}
                            disabled={loadingModelId === model.id}
                          >
                            {loadingModelId === model.id ? (
                              <>
                                <ActivityIndicator size="small" color="#ffffff" style={{ transform: [{ scale: 0.75 }] }} />
                                <Text style={styles.properBtnTextWhite}>Loading RAM...</Text>
                              </>
                            ) : (
                              <>
                                <Icon name="play" size={14} color="#ffffff" />
                                <Text style={styles.properBtnTextWhite}>Load into RAM</Text>
                              </>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.properDangerBtn, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}
                            onPress={() => handleDeleteModel(model.id)}
                            activeOpacity={0.7}
                          >
                            <Icon name="trash-2" size={14} color={theme.danger} />
                            <Text style={[styles.properBtnTextDanger, { color: theme.danger }]}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      // 3. NOT DOWNLOADED MODEL
                      <View style={{ width: '100%', gap: 6 }}>
                        {progress?.status === 'error' && (
                          <View style={[styles.statusBanner, { backgroundColor: '#fee2e2', borderColor: '#ef4444' }]}>
                            <Icon name="alert-triangle" size={12} color="#dc2626" />
                            <Text style={[styles.statusBannerText, { color: '#dc2626' }]}>
                              Download interrupted. Tap to retry.
                            </Text>
                          </View>
                        )}
                        <TouchableOpacity
                          style={[
                            styles.properDownloadBtn,
                            { backgroundColor: progress?.status === 'error' ? theme.accent : theme.floatingNav },
                          ]}
                          onPress={() => handleStartDownload(model)}
                          activeOpacity={0.8}
                        >
                          <Icon name={progress?.status === 'error' ? 'refresh-cw' : 'download'} size={15} color="#ffffff" />
                          <Text style={styles.properBtnTextWhite}>
                            {progress?.status === 'error'
                              ? `Retry Download (${model.sizeMb} MB)`
                              : `Download Model (${model.sizeMb} MB)`}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 14 : 18,
    paddingBottom: 110,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  chatShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  chatShortcutText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  storageCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  storageCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  storageLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  storageIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storageTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  storageSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  activeModelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  activeModelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeModelChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  storageBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  storageBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  categorySection: {
    marginBottom: 18,
  },
  categoryScroll: {
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  categoryPillActive: {},
  categoryPillInactive: {
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 12,
  },
  modelsList: {
    gap: 16,
  },
  emptyContainer: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 30,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  modelCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 16,
  },
  modelCardSelected: {
    borderColor: '#0284c7',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  topBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgesLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  pubChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pubChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  capChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  capChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  modelName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  quantBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  quantBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  modelDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  specsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  specBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  specLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  specVal: {
    fontSize: 11,
    fontWeight: '700',
  },
  downloadingSection: {
    padding: 12,
    borderRadius: 16,
    marginTop: 6,
    borderWidth: 1,
  },
  downloadProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  downloadStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  downloadPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  downloadProgressTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  percentBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  percentBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  progressBarWrapper: {
    marginBottom: 8,
  },
  downloadMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  downloadBytesText: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  downloadSpeedText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flexShrink: 1,
    textAlign: 'right',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  cancelDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'center',
  },
  cancelDownloadText: {
    fontSize: 11,
    fontWeight: '700',
  },
  properActionsSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
    paddingTop: 10,
  },
  properActionGroup: {
    gap: 8,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBannerText: {
    fontSize: 11,
    fontWeight: '700',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  properButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  properPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 42,
    borderRadius: 14,
  },
  properSecondaryBtn: {
    width: 85,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
  },
  properDangerBtn: {
    width: 85,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
  },
  properDownloadBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 14,
  },
  properBtnTextWhite: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  properBtnTextMuted: {
    fontSize: 12,
    fontWeight: '700',
  },
  properBtnTextDanger: {
    fontSize: 12,
    fontWeight: '700',
  },
});
