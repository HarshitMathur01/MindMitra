import { render, screen } from '@testing-library/react';
import TherapistBridge from '@/pages/TherapistBridge';

test('renders hero section', () => {
  render(<TherapistBridge />);
  expect(screen.getByText('Ready to Take the Next Step?')).toBeInTheDocument();
});

test('displays emotional profile when data loaded', async () => {
  render(<TherapistBridge />);
  expect(await screen.findByText('Your Emotional Profile')).toBeInTheDocument();
});

test('consent required before booking', async () => {
  render(<TherapistBridge />);
  expect(await screen.findByText('Privacy & Consent')).toBeInTheDocument();
});
