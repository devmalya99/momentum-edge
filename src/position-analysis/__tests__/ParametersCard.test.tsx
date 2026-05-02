import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ParametersCard } from '@/position-analysis/components/ParametersCard';
import { defaultPositionParameters } from '@/position-analysis/schema/inputSchema';

describe('ParametersCard', () => {
  it('renders header, description, and all parameter fields from the design', () => {
    render(<ParametersCard />);

    expect(screen.getByRole('heading', { name: /parameters/i })).toBeInTheDocument();
    expect(screen.getByText(/adjust your strategy metrics in real-time/i)).toBeInTheDocument();

    expect(screen.getByLabelText(/win rate/i)).toBeInTheDocument();
    expect(screen.getByTestId('input-win-rate')).toHaveValue(String(defaultPositionParameters.winRate));

    expect(screen.getByLabelText(/average win/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/average loss/i)).toBeInTheDocument();

    expect(screen.getByLabelText(/total capital/i)).toBeInTheDocument();

    const stopSection = screen.getByTestId('stop-loss-section');
    expect(within(stopSection).getByText(/stop-loss model for position sizing/i)).toBeInTheDocument();
    expect(screen.getByTestId('toggle-percent-stop')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-absolute-stop')).toBeInTheDocument();

    expect(screen.getByLabelText(/fees per trade/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tax rate/i)).toBeInTheDocument();

    expect(screen.getByTestId('button-save-simulation')).toHaveTextContent(/save simulation/i);
  });

  it('switches stop-loss model and updates the stop field label and persisted absolute value on save', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ParametersCard onSave={onSave} />);

    expect(screen.getByLabelText(/stop loss % \(e\.g\. 3 for 3%\)/i)).toBeInTheDocument();

    await user.click(screen.getByTestId('toggle-absolute-stop'));

    expect(screen.getByLabelText(/stop loss ₹ \(absolute amount\)/i)).toBeInTheDocument();

    const stopInput = screen.getByTestId('input-stop-loss');
    await user.clear(stopInput);
    await user.type(stopInput, '500');

    await user.click(screen.getByTestId('button-save-simulation'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        stopLossModel: 'absolute',
        stopLossAbsolute: 500,
      }),
    );
  });

  it('calls onSave with parsed parameters when validation passes', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ParametersCard onSave={onSave} />);

    await user.click(screen.getByTestId('button-save-simulation'));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining(defaultPositionParameters));
  });

  it('shows validation errors when win rate is out of range', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ParametersCard onSave={onSave} />);

    const win = screen.getByTestId('input-win-rate');
    await user.clear(win);
    await user.type(win, '150');

    await user.click(screen.getByTestId('button-save-simulation'));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot exceed 100/i)).toBeInTheDocument();
  });
});
