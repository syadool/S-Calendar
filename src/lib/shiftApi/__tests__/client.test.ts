import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase-client', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('test-token'),
    },
  },
}));

import { fetchShiftEvents, ShiftApiUnauthorizedError } from '../client';

describe('fetchShiftEvents', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SHIFT_API_BASE = 'http://localhost:3000';
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetches with Authorization Bearer header', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ events: [] }),
    });

    await fetchShiftEvents({ from: '2026-05-01', to: '2026-05-31' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/shifts?'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-token' },
      })
    );
  });

  it('throws ShiftApiUnauthorizedError on 401', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({}),
    });

    await expect(
      fetchShiftEvents({ from: '2026-05-01', to: '2026-05-31' })
    ).rejects.toBeInstanceOf(ShiftApiUnauthorizedError);
  });
});
