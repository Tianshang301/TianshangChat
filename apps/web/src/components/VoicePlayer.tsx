import React, { useState, useRef, useEffect } from 'react';

function VoicePlayer({
  audioUrl,
  duration: propDuration,
}: {
  audioUrl: string;
  duration?: string | number | null;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onLoaded = () => {
      setDuration(audio.duration || 0);
      setIsLoaded(true);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onError = () => {
      console.error('VoicePlayer: failed to load', audioUrl);
    };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.src = '';
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [audioUrl]);

  const updateProgress = (): void => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      animRef.current = requestAnimationFrame(updateProgress);
    }
  };

  const togglePlay = (): void => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
      setIsPlaying(false);
    } else {
      void audio.play().catch(() => {});
      animRef.current = requestAnimationFrame(updateProgress);
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>): void => {
    const audio = audioRef.current;
    if (!audio || !progressRef.current || !duration) return;

    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);

    if (!isPlaying) {
      void audio.play().catch(() => {});
      animRef.current = requestAnimationFrame(updateProgress);
      setIsPlaying(true);
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (s: number | null): string => {
    if (s == null || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="voice-player">
      <button
        className={`voice-btn ${isPlaying ? 'playing' : ''}`}
        onClick={togglePlay}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '\u23F8' : '\u25B6'}
      </button>
      <div className="voice-progress" ref={progressRef} onClick={handleSeek}>
        <div className="voice-progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>
      <span className="voice-time">
        {isLoaded ? formatTime(currentTime) : '0:00'}
        &nbsp;/&nbsp;
        {isLoaded ? formatTime(duration) : (propDuration ?? '0:00')}
      </span>
    </div>
  );
}

export default VoicePlayer;
