import { useState, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

function VoiceRecorder({ onSendVoice }: { onSendVoice: (url: string, duration: string) => void }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      mediaRecorderRef.current = recorder;

      chunksRef.current = [];

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await uploadAudio(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Microphone access denied or not available');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadAudio = async (blob: Blob) => {
    const formData = new FormData();
    formData.append('voice', blob, 'voice.webm');

    try {
      const response = await fetch(`${API_URL}/upload/voice`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data: unknown = await response.json();
      if (
        typeof data === 'object' &&
        data !== null &&
        'success' in data &&
        (data as { success: boolean }).success &&
        'url' in data &&
        typeof (data as { url: unknown }).url === 'string'
      ) {
        const duration = Math.round(blob.size / 10000);
        onSendVoice((data as { url: string }).url, `${duration}s`);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <button
      className={`icon-btn ${isRecording ? 'recording' : ''}`}
      onClick={isRecording ? stopRecording : () => void startRecording()}
      title={isRecording ? 'Stop Recording' : t('voiceMessage')}
    >
      {isRecording ? '⏹' : '🎤'}
    </button>
  );
}

export default VoiceRecorder;
