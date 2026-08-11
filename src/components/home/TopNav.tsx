import React from 'react';
import { colors, radius, type } from '../../theme/theme';

interface TopNavProps {
  /** Örn: bugünün Pacific tarihi, formatlanmış string olarak (timezone.ts'den) */
  dateLabel: string;
  hasUnreadNotifications?: boolean;
  onNotificationsClick?: () => void;
  avatarUrl?: string | null;
  avatarInitial?: string;
  onAvatarClick?: () => void;
}

/**
 * Ana ekranın en üstündeki sabit header.
 * Sol: logo + "Family Finance"  |  Orta: bugünün tarihi  |  Sağ: bildirim + avatar
 */
export function TopNav({
  dateLabel,
  hasUnreadNotifications,
  onNotificationsClick,
  avatarUrl,
  avatarInitial,
  onAvatarClick,
}: TopNavProps) {
  return (
    <div style={styles.wrap}>
      <div style={styles.left}>
        <div style={styles.logoMark} aria-hidden>
          ⚡
        </div>
        <span style={styles.title}>Family Finance</span>
      </div>

      <div style={styles.center}>
        <span style={styles.date}>{dateLabel}</span>
      </div>

      <div style={styles.right}>
        <button
          type="button"
          style={styles.iconButton}
          onClick={onNotificationsClick}
          aria-label="Bildirimler"
        >
          🔔
          {hasUnreadNotifications && <span style={styles.notifDot} />}
        </button>

        <button type="button" style={styles.avatarButton} onClick={onAvatarClick} aria-label="Profil">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={styles.avatarImg} />
          ) : (
            <span style={styles.avatarInitial}>{avatarInitial ?? '👤'}</span>
          )}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: 'rgba(5, 7, 13, 0.82)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    borderBottom: `1px solid ${colors.hairline}`,
  },
  left: { display: 'flex', alignItems: 'center', gap: 8, flex: 1 },
  logoMark: {
    width: 26,
    height: 26,
    borderRadius: 8,
    background: colors.neonGreenSoft,
    color: colors.neonGreen,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
  },
  title: { ...type.body, fontWeight: 700, color: colors.textPrimary, fontSize: 14 },
  center: { flex: 1, textAlign: 'center' },
  date: { ...type.caption, color: colors.textSecondary },
  right: { display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' },
  iconButton: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    border: `1px solid ${colors.hairline}`,
    background: colors.bgCard,
    color: colors.textPrimary,
    fontSize: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    background: colors.neonGreen,
    boxShadow: `0 0 8px ${colors.neonGreenGlow}`,
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    border: `1px solid ${colors.hairline}`,
    background: colors.bgCard,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitial: { fontSize: 15 },
};
