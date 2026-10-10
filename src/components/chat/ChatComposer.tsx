import {
  Camera,
  ImageIcon,
  Mic,
  SendHorizontal,
  X,
} from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';

import { ensureAccess } from '@/features/media/permissionPrompt';
import type { LocalMedia } from '@/features/media/pickMedia';
import { useAppTheme } from '@/theme';

import { VoiceRecorderBar } from './VoiceRecorderBar';

export const MESSAGE_INPUT_MAX_LENGTH = 1000;
const LINE_HEIGHT = 20;
const MAX_LINES = 5;
const INPUT_PADDING_Y = 11;

export type ComposerReply = { id: string; name: string; preview: string };
export type ComposerEdit = { id: string; body: string };

type Props = {
  onSend: (text: string) => void;
  onTyping: () => void;
  onCamera: () => void;
  onPickImage: () => void;
  onPickGif: () => void;
  onVoiceSend: (file: LocalMedia) => void;
  /** A problem worth telling the user about (e.g. recording failed). */
  onError: (message: string) => void;
  reply: ComposerReply | null;
  onCancelReply: () => void;
  /** Editing one of my messages: the input holds its text and send saves the edit. */
  editing?: ComposerEdit | null;
  onSubmitEdit?: (text: string) => void;
  onCancelEdit?: () => void;
  onInputFocus?: () => void;
  bottomInset: number;
  /** Prefilled and focused once (e.g. "Hi 👋" after a match). */
  initialText?: string;
};

/** Pinned message bar: camera, growing input, voice / photo / GIF, or send once there's text. */
export function ChatComposer({
  onSend,
  onTyping,
  onCamera,
  onPickImage,
  onPickGif,
  onVoiceSend,
  onError,
  reply,
  onCancelReply,
  editing = null,
  onSubmitEdit,
  onCancelEdit,
  onInputFocus,
  bottomInset,
  initialText,
}: Props) {
  const { scheme, colors } = useAppTheme();
  const [text, setText] = useState(initialText ?? '');
  const [recording, setRecording] = useState(false);
  const inputRef = useRef<TextInputInstance>(null);
  const draftBeforeEdit = useRef('');
  const latestText = useRef(text);
  latestText.current = text;
  const canSend = text.trim().length > 0;

  const prefilled = useRef(Boolean(initialText));
  useEffect(() => {
    if (!prefilled.current) return;
    prefilled.current = false;
    const timer = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, []);

  const replyId = reply?.id;
  useEffect(() => {
    if (replyId) inputRef.current?.focus();
  }, [replyId]);

  const editId = editing?.id;
  const editBody = editing?.body;
  useEffect(() => {
    if (!editId) return;
    draftBeforeEdit.current = latestText.current;
    setText(editBody ?? '');
    inputRef.current?.focus();
  }, [editId, editBody]);

  const cancelEdit = () => {
    setText(draftBeforeEdit.current);
    draftBeforeEdit.current = '';
    onCancelEdit?.();
  };

  const send = () => {
    if (!canSend) return;
    if (editing) {
      onSubmitEdit?.(text);
      setText(draftBeforeEdit.current);
      draftBeforeEdit.current = '';
      return;
    }
    onSend(text);
    setText('');
  };

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.background,
          paddingBottom: 8 + bottomInset,
        },
      ]}
    >
      {editing && !recording ? (
        <View style={[styles.reply, { borderBottomColor: colors.border }]}>
          <View style={[styles.replyMark, { backgroundColor: colors.primary }]} />
          <View style={styles.replyText}>
            <Text
              style={[styles.replyTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              Editing message
            </Text>
            <Text
              style={[styles.replyBody, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {editing.body}
            </Text>
          </View>
          <Pressable
            onPress={cancelEdit}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Cancel editing"
          >
            <X size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      ) : null}
      {reply && !editing && !recording ? (
        <View style={[styles.reply, { borderBottomColor: colors.border }]}>
          <View style={[styles.replyMark, { backgroundColor: colors.primary }]} />
          <View style={styles.replyText}>
            <Text
              style={[styles.replyTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              Replying to {reply.name}
            </Text>
            <Text
              style={[styles.replyBody, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {reply.preview}
            </Text>
          </View>
          <Pressable
            onPress={onCancelReply}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Cancel reply"
          >
            <X size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.row}>
        {recording ? (
          <VoiceRecorderBar
            onCancel={() => setRecording(false)}
            onError={onError}
            onSend={file => {
              setRecording(false);
              onVoiceSend(file);
            }}
          />
        ) : (
          <View
            style={[
              styles.pill,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <Pressable
              onPress={onCamera}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Camera"
              style={({ pressed }) => [
                styles.camera,
                { backgroundColor: colors.button },
                pressed && styles.pressed,
              ]}
            >
              <Camera size={19} color={colors.onButton} />
            </Pressable>
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={value => {
                setText(value);
                if (value.trim()) onTyping();
              }}
              onFocus={onInputFocus}
              placeholder="Message…"
              placeholderTextColor={colors.textSecondary}
              selectionColor={colors.primary}
              keyboardAppearance={scheme}
              multiline
              maxLength={MESSAGE_INPUT_MAX_LENGTH}
              style={[styles.input, { color: colors.text }]}
              accessibilityLabel="Message"
            />
            {canSend ? (
              <Pressable
                onPress={send}
                accessibilityRole="button"
                accessibilityLabel="Send"
                style={({ pressed }) => [
                  styles.send,
                  { backgroundColor: colors.button },
                  pressed && styles.pressed,
                ]}
              >
                <SendHorizontal size={18} color={colors.onButton} />
              </Pressable>
            ) : (
              <View style={styles.tools}>
                <Tool
                  label="Record voice message"
                  onPress={async () => {
                    if (await ensureAccess('microphone')) setRecording(true);
                  }}
                >
                  <Mic size={22} color={colors.text} />
                </Tool>
                <Tool label="Send a photo" onPress={onPickImage}>
                  <ImageIcon size={22} color={colors.text} />
                </Tool>
                <Tool label="Send a GIF" onPress={onPickGif}>
                  <View style={[styles.gif, { borderColor: colors.text }]}>
                    <Text
                      style={[styles.gifText, { color: colors.text }]}
                      allowFontScaling={false}
                    >
                      GIF
                    </Text>
                  </View>
                </Tool>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function Tool({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 6, paddingHorizontal: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  reply: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 6,
    paddingBottom: 8,
    marginBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  replyMark: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  replyText: { flex: 1, minWidth: 0 },
  replyTitle: { fontSize: 13, fontWeight: '700' },
  replyBody: { fontSize: 13, marginTop: 1 },
  pill: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    borderWidth: 1,
    padding: 4,
  },
  camera: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: LINE_HEIGHT * MAX_LINES + INPUT_PADDING_Y * 2,
    paddingHorizontal: 10,
    paddingTop: Platform.OS === 'ios' ? 9 : 8,
    paddingBottom: Platform.OS === 'ios' ? 9 : 8,
    fontSize: 15,
    lineHeight: LINE_HEIGHT,
    textAlignVertical: 'center',
  },
  tools: { flexDirection: 'row', alignItems: 'center', height: 38, paddingRight: 4 },
  tool: {
    width: 36,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gif: {
    borderWidth: 1.8,
    borderRadius: 5,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  gifText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.92 }] },
});
