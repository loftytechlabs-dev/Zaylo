import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Theme } from '../theme/theme';
import type { OnDeviceModel } from '../types';
import { Icon } from './common/Icon';

interface ChatHeaderProps {
  theme: Theme;
  activeLocalModel: OnDeviceModel | null;
  onOpenModels: () => void;
  onClearChat: () => void;
  onToggleTheme: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  theme,
  activeLocalModel,
  onOpenModels,
  onClearChat,
  onToggleTheme,
}) => {
  const modelLabel = activeLocalModel
    ? activeLocalModel.name
    : 'Select Model to Chat';

  const dotColor = activeLocalModel ? theme.success : theme.warning;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          borderBottomColor: theme.cardBorder,
        },
      ]}
    >
      {/* Brand logo & Title */}
      <View style={styles.brandRow}>
        <View style={[styles.brandIcon, { backgroundColor: theme.accent }]}>
          <Icon name="cpu" size={16} color="#ffffff" />
        </View>
        <Text style={[styles.appTitle, { color: theme.textPrimary }]}>Local AI</Text>
      </View>

      {/* Model Selector Chip */}
      <TouchableOpacity
        style={[
          styles.modelChip,
          {
            backgroundColor: theme.card,
            borderColor: activeLocalModel ? theme.cardBorder : theme.accent,
          },
          theme.shadows.sm,
        ]}
        onPress={onOpenModels}
        activeOpacity={0.7}
      >
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        <Text
          style={[
            styles.modelName,
            { color: activeLocalModel ? theme.textPrimary : theme.accent },
          ]}
          numberOfLines={1}
        >
          {modelLabel}
        </Text>
        <Icon name="chevron-down" size={14} color={theme.textMuted} />
      </TouchableOpacity>

      {/* Right actions */}
      <View style={styles.rightActions}>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
            theme.shadows.sm,
          ]}
          onPress={onClearChat}
          activeOpacity={0.7}
        >
          <Icon name="trash-2" size={15} color={theme.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
            theme.shadows.sm,
          ]}
          onPress={onToggleTheme}
          activeOpacity={0.7}
        >
          <Icon
            name={theme.isDark ? 'sun' : 'moon'}
            size={15}
            color={theme.accent}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: '46%',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  modelName: {
    fontSize: 12,
    fontWeight: '700',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
