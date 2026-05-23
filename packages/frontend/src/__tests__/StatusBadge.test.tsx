import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../components/common/StatusBadge.js';

describe('StatusBadge', () => {
  it('renders the LIVE label', () => {
    render(<StatusBadge status="LIVE" />);
    expect(screen.getByLabelText(/feed status LIVE/i)).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('renders ~REALTIME for REALTIME', () => {
    render(<StatusBadge status="REALTIME" />);
    expect(screen.getByText('~REALTIME')).toBeInTheDocument();
  });

  it('appends a stale marker when ageMs is over the threshold', () => {
    render(<StatusBadge status="SNAPSHOT" ageMs={10 * 60_000} />);
    expect(screen.getByText(/stale/)).toBeInTheDocument();
  });
});
