import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import TitleSettingsScreen from '../TitleSettingsScreen.jsx';

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllEnvs(); });
function open(url) {
  render(<MemoryRouter initialEntries={[url]}><TitleSettingsScreen /></MemoryRouter>);
}
it('keeps the normal profile editor and hides diagnostic controls by default', () => {
  localStorage.setItem('dev.p2pCapture', '1');
  open('/settings');
  expect(screen.getByLabelText('プレイヤー名')).toBeTruthy();
  expect(screen.queryByTestId('dev-tier-panel')).toBeNull();
  expect(screen.queryByText('JSONL Export')).toBeNull();
});
it('requires explicit debug opt-in in development and retains working controls', () => {
  vi.stubEnv('DEV', true);
  open('/settings?debug=1');
  const panel = within(screen.getByTestId('dev-tier-panel'));
  fireEvent.click(panel.getByRole('button', { name: 'Capture Disabled' }));
  expect(localStorage.getItem('dev.p2pCapture')).toBe('1');
  expect(panel.getByRole('button', { name: 'Capture Enabled' })).toBeTruthy();
  expect(panel.getByRole('button', { name: 'JSONL Export' })).toBeTruthy();
});
it('does not expose developer settings in production even with debug requested', () => {
  vi.stubEnv('DEV', false);
  open('/settings?debug=1');
  expect(screen.queryByTestId('dev-tier-panel')).toBeNull();
  expect(screen.getByLabelText('プレイヤー名')).toBeTruthy();
});
