import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/themeContext';
import type { BadgeMeta } from '../api';

interface Props {
  badges: BadgeMeta[];
  onDone: () => void;
}

export default function BadgeToast({ badges, onDone }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  const badge = badges[index];

  useEffect(() => {
    if (!badge) return;
    setVisible(true);
    const hideTimer = setTimeout(() => setVisible(false), 3200);
    const nextTimer = setTimeout(() => {
      if (index + 1 < badges.length) {
        setIndex(i => i + 1);
      } else {
        onDone();
      }
    }, 3800);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(nextTimer);
    };
  }, [index, badge, badges.length, onDone]);

  if (!badge) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 80,
        right: 24,
        zIndex: 9999,
        transition: 'opacity 0.5s, transform 0.5s',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-16px)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: theme === 'light' ? '#fffbeb' : '#1c1a0f',
          border: `2px solid ${theme === 'light' ? '#d97706' : '#fbbf24'}`,
          borderRadius: 16,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
          maxWidth: 320,
        }}
      >
        <span style={{ fontSize: 36, lineHeight: 1 }}>{badge.icon}</span>
        <div>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: theme === 'light' ? '#d97706' : '#fbbf24',
            textTransform: 'uppercase',
            marginBottom: 2,
          }}>
            {t('achievements.toast_label', 'Achievement Unlocked!')}
          </div>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: theme === 'light' ? '#111' : '#fff',
          }}>
            {t(badge.title_key, badge.id)}
          </div>
          <div style={{
            fontSize: 12,
            color: theme === 'light' ? '#555' : '#aaa',
            marginTop: 2,
          }}>
            {t(badge.desc_key, '')}
          </div>
        </div>
      </div>
    </div>
  );
}
