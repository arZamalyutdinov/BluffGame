import { useEffect, useMemo, useState } from 'react';

import {
  ALL_CLAIMS,
  type Claim,
  claimToKey,
  claimToLabel,
  compareClaims,
} from '@bluff-game/shared';

interface ClaimComposerProps {
  lastClaim?: Claim;
  disabled?: boolean;
  onSubmit: (claimKey: string) => void;
}

export function ClaimComposer({
  lastClaim,
  disabled = false,
  onSubmit,
}: ClaimComposerProps) {
  const availableClaims = useMemo(
    () =>
      ALL_CLAIMS.filter(
        (claim) => !lastClaim || compareClaims(claim, lastClaim) > 0,
      ),
    [lastClaim],
  );
  const [selectedClaimKey, setSelectedClaimKey] = useState(
    availableClaims[0] ? claimToKey(availableClaims[0]) : '',
  );

  useEffect(() => {
    setSelectedClaimKey(
      availableClaims[0] ? claimToKey(availableClaims[0]) : '',
    );
  }, [availableClaims]);

  if (availableClaims.length === 0) {
    return (
      <div className="composer-card muted-panel">
        No stronger claims remain. The next player must challenge.
      </div>
    );
  }

  return (
    <form
      className="composer-card"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(selectedClaimKey);
      }}
    >
      <label className="field-label">
        Your next claim
        <select
          className="text-input"
          value={selectedClaimKey}
          onChange={(event) => setSelectedClaimKey(event.target.value)}
          disabled={disabled}
        >
          {availableClaims.map((claim) => {
            const claimKey = claimToKey(claim);

            return (
              <option key={claimKey} value={claimKey}>
                {claimToLabel(claim)}
              </option>
            );
          })}
        </select>
      </label>

      <button
        type="submit"
        className="primary-button"
        disabled={disabled || !selectedClaimKey}
      >
        Submit claim
      </button>
    </form>
  );
}
