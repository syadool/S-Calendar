'use client';

import { useState } from 'react';
import type { FreeSlot } from '@/types/api';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { addDays, formatDate } from '@/lib/date';

export default function FreeTimePage() {
  const [loading, setLoading] = useState(false);
  const [freeSlots, setFreeSlots] = useState<FreeSlot[]>([]);

  const today = new Date();
  const nextWeek = addDays(today, 7);

  const [startDate, setStartDate] = useState(formatDate(today));
  const [endDate, setEndDate] = useState(formatDate(nextWeek));
  const [minDuration, setMinDuration] = useState(30); // M-5: デフォルト 30 分

  async function handleSearch() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        minDuration: minDuration.toString(),
      });
      const data = await apiFetch<{ freeSlots: FreeSlot[] }>(`/api/free-slots?${params}`);
      setFreeSlots(data.freeSlots ?? []);
    } catch (error) {
      console.error('Failed to fetch free slots:', error);
      alert('空き時間の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">空き時間提案</h1>

      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">検索条件</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="開始日"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="終了日"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              最小時間（分）
            </label>
            <select
              className="input"
              value={minDuration}
              onChange={(e) => setMinDuration(parseInt(e.target.value, 10))}
            >
              <option value={30}>30分</option>
              <option value={60}>1時間</option>
              <option value={90}>1.5時間</option>
              <option value={120}>2時間</option>
              <option value={180}>3時間</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={handleSearch} loading={loading}>
            空き時間を検索
          </Button>
        </div>
      </div>

      {loading && (
        <div className="card text-center py-12">
          <Spinner size="lg" className="mb-4" />
          <p className="text-gray-600">計算中...</p>
        </div>
      )}

      {!loading && freeSlots.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">空き時間（{freeSlots.length}件）</h2>
          <div className="space-y-3">
            {freeSlots.map((slot, i) => (
              <div
                key={i}
                className="p-4 bg-green-50 border border-green-200 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{slot.displayText}</p>
                    <p className="text-sm text-gray-600 mt-1">{slot.date}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      {Math.floor(slot.duration / 60)}時間
                      {slot.duration % 60 > 0 && `${slot.duration % 60}分`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && freeSlots.length === 0 && startDate && endDate && (
        <div className="card text-center py-12">
          <p className="text-gray-600">
            指定期間に条件に合う空き時間が見つかりませんでした。
          </p>
        </div>
      )}
    </div>
  );
}
