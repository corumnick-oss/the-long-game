import { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSendFeedback } from '../hooks/useProfile';

export function FeedbackModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const { mutate: sendFeedback, isPending, isError, reset } = useSendFeedback();

  const resetForm = () => {
    setSubject('');
    setMessage('');
    setSent(false);
    reset();
  };

  const close = () => {
    onClose();
    setTimeout(resetForm, 350);
  };

  const submit = () => {
    if (!message.trim()) return;
    sendFeedback({ subject: subject.trim() || undefined, message: message.trim() }, {
      onSuccess: () => {
        setSent(true);
        setTimeout(close, 1800);
      },
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <Pressable style={{ flex: 1 }} onPress={close} />
          <View style={{
            backgroundColor: '#111',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 8,
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ flex: 1, color: '#fff', fontSize: 18, fontWeight: '600' }}>Send Feedback</Text>
              <TouchableOpacity onPress={close} hitSlop={8}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {sent ? (
              <View style={{ alignItems: 'center', paddingVertical: 36 }}>
                <Ionicons name="checkmark-circle" size={52} color="#22c55e" />
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600', marginTop: 14 }}>Message sent!</Text>
                <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 6 }}>Thanks — Nick will get back to you.</Text>
              </View>
            ) : (
              <>
                <TextInput
                  placeholder="Subject (optional)"
                  placeholderTextColor="#4b5563"
                  value={subject}
                  onChangeText={setSubject}
                  returnKeyType="next"
                  style={{
                    backgroundColor: '#1e1e1e',
                    color: '#fff',
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    height: 48,
                    marginBottom: 10,
                    fontSize: 15,
                  }}
                />
                <TextInput
                  placeholder="Describe your question, bug, or suggestion..."
                  placeholderTextColor="#4b5563"
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  style={{
                    backgroundColor: '#1e1e1e',
                    color: '#fff',
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    height: 130,
                    textAlignVertical: 'top',
                    marginBottom: 14,
                    fontSize: 15,
                  }}
                />
                {isError ? (
                  <Text style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>
                    Failed to send. Check your connection and try again.
                  </Text>
                ) : null}
                <TouchableOpacity
                  onPress={submit}
                  disabled={isPending || !message.trim()}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: message.trim() ? '#3b82f6' : '#1d3a6b',
                    borderRadius: 12,
                    height: 50,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isPending
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ color: message.trim() ? '#fff' : '#4b5563', fontWeight: '600', fontSize: 16 }}>Send</Text>
                  }
                </TouchableOpacity>
                <View style={{ height: 20 }} />
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
