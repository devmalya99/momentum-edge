import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PositionSizingResults } from '@/position-analysis/components/PositionSizingResults';
import { defaultPositionParameters } from '@/position-analysis/schema/inputSchema';

describe('PositionSizingResults', () => {
  it('renders correct position sizing output for valid parameters', () => {
    render(
      <PositionSizingResults
        parameters={{
          ...defaultPositionParameters,
          totalCapital: 100_000,
          stopLossModel: 'percent',
          stopLossPercent: 3,
          winRate: 55,
          averageWin: 2000,
          averageLoss: 1000,
          feesPerTrade: 200,
          taxRate: 20,
        }}
      />,
    );

    // Core UI present
    expect(screen.getByTestId('decision-signal-card')).toBeInTheDocument();
    expect(screen.getByTestId('decision-signal-message')).toHaveTextContent(
      /positive edge after costs/i,
    );
    expect(screen.getByText(/recommended position size/i)).toBeInTheDocument();

    // Exact values (not vague checks)
    expect(screen.getByText('₹33,333')).toBeInTheDocument();
    expect(screen.getByText('33.3% of capital')).toBeInTheDocument();

    // Risk confirmation
    expect(screen.getByText(/max loss/i)).toBeInTheDocument();
    expect(screen.getByText('₹1,000')).toBeInTheDocument();
  });

  it('shows do-not-trade decision when edge is destroyed by costs', () => {
    render(
      <PositionSizingResults
        parameters={{
          ...defaultPositionParameters,
          totalCapital: 100_000,
          stopLossModel: 'percent',
          stopLossPercent: 3,
          winRate: 50,
          averageWin: 1000,
          averageLoss: 1000,
        }}
      />,
    );

    expect(screen.getByTestId('decision-signal-message')).toHaveTextContent(
      /do not trade.*edge destroyed by costs/i,
    );
  });

  it('renders empty state when computation is not possible', () => {
    render(
      <PositionSizingResults
        parameters={{
          ...defaultPositionParameters,
          totalCapital: 100_000,
          stopLossPercent: 0,
        }}
      />,
    );

    // Empty state container
    expect(screen.getByTestId('position-sizing-results-empty')).toBeInTheDocument();

    expect(
      screen.getByText(/enter valid parameters and save to see recommended size and max loss/i),
    ).toBeInTheDocument();
  });
});
