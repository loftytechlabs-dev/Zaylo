import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { Theme } from '../theme/theme';
import { Icon } from './common/Icon';

interface MessageInputProps {
  theme: Theme;
  onSendMessage: (text: string) => void;
  onStopGeneration: () => void;
  isStreaming: boolean;
  onAttachMedia?: () => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  theme,
  onSendMessage,
  onStopGeneration,
  isStreaming,
  onAttachMedia,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (inputText.trim() && !isStreaming) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            borderTopColor: theme.cardBorder,
          },
        ]}
      >
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: theme.inputBg,
              borderColor: theme.inputBorder,
            },
            theme.shadows.sm,
          ]}
        >
          {/* Attachment / Camera Action */}
          <TouchableOpacity
            style={styles.attachButton}
            onPress={onAttachMedia}
            activeOpacity={0.7}
          >
            <Icon name="paperclip" size={18} color={theme.textMuted} />
          </TouchableOpacity>

          {/* Text Input */}
          <TextInput
            style={[styles.textInput, { color: theme.textPrimary }]}
            placeholder="Message local AI..."
            placeholderTextColor={theme.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={4000}
            editable={!isStreaming}
          />

          {/* Send or Stop Button */}
          {isStreaming ? (
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: theme.danger }]}
              onPress={onStopGeneration}
              activeOpacity={0.8}
            >
              <View style={styles.stopSquare} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: theme.accent },
                !inputText.trim() && [styles.sendButtonDisabled, { backgroundColor: theme.cardBorder }],
              ]}
              onPress={handleSend}
              disabled={!inputText.trim()}
              activeOpacity={0.8}
            >
              <Icon name="arrow-up" size={16} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Engine status caption */}
        <View style={styles.captionContainer}>
          <Icon
            name="cpu"
            size={11}
            color={theme.accent}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.captionText, { color: theme.textMuted }]}>
            100% On-Device Offline AI (llama.rn)
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minHeight: 52,
  },
  attachButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    maxHeight: 110,
    paddingHorizontal: 10,
    paddingVertical: 8,
    letterSpacing: -0.2,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.35,
  },
  stopSquare: {
    width: 12,
    height: 12,
    backgroundColor: '#ffffff',
    borderRadius: 3,
  },
  captionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  captionText: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '500',
  },
});
