import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

function MessageInput({
  onSendMessage,
  onTyping,
}: {
  onSendMessage: (content: string) => void;
  onTyping?: () => void;
}) {
  const { t } = useLanguage();
  const [message, setMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    onTyping?.();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const addEmoji = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    setShowEmoji(false);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flex: 1, gap: 12, position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setShowEmoji(!showEmoji)}
          title="Emoji"
        >
          😀
        </button>
        {showEmoji && (
          <div className="emoji-picker">
            {['😀', '😂', '🥰', '😍', '😎', '🤔', '👍', '👎', '❤️', '🎉', '🔥', '💯', '👏', '🙏', '😱', '🤝'].map(
              (emoji, i) => (
                <button key={i} type="button" className="emoji-btn" onClick={() => addEmoji(emoji)}>
                  {emoji}
                </button>
              ),
            )}
          </div>
        )}
      </div>
      <input
        type="text"
        className="message-input"
        placeholder={t('placeholder')}
        value={message}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
        maxLength={1000}
      />
      <button type="submit" className="send-btn" disabled={!message.trim()}>
        {t('send')}
      </button>
    </form>
  );
}

export default MessageInput;
