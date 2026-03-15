import type { CSSProperties } from 'react';

import {
  getPlayerInitials,
  getSeatToneClass,
} from '../lib/playerPresentation.js';

interface PlayerAvatarProps {
  name: string;
  seatIndex: number;
  artworkUrl?: string | undefined;
  size?: 'sm' | 'md' | 'lg';
  timerProgress?: number | undefined;
  timerTone?: 'steady' | 'warning' | 'critical' | 'paused' | undefined;
  className?: string | undefined;
}

export function PlayerAvatar({
  name,
  seatIndex,
  artworkUrl,
  size = 'md',
  timerProgress,
  timerTone,
  className,
}: PlayerAvatarProps) {
  const clampedProgress =
    timerProgress === undefined
      ? undefined
      : Math.min(Math.max(timerProgress, 0), 1);

  return (
    <div
      className={`player-avatar ${getSeatToneClass(seatIndex)} player-avatar-${size} ${clampedProgress !== undefined ? `has-timer-ring timer-${timerTone ?? 'steady'}` : ''} ${className ?? ''}`.trim()}
      style={
        clampedProgress !== undefined
          ? ({
              '--avatar-timer-progress': `${clampedProgress * 360}deg`,
            } as CSSProperties)
          : undefined
      }
      aria-hidden="true"
    >
      <div className="player-avatar-frame">
        {artworkUrl ? (
          <img className="player-avatar-image" src={artworkUrl} alt="" />
        ) : (
          <span className="player-avatar-initials">
            {getPlayerInitials(name)}
          </span>
        )}
      </div>
    </div>
  );
}
