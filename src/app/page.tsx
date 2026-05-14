import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            学生向けカレンダー
          </h1>
          <p className="text-xl text-gray-700 mb-12">
            時間割とバイトシフトを一元管理。空き時間を自動で提案します。
          </p>

          <div className="flex gap-4 justify-center mb-16">
            <Link href="/register">
              <Button size="lg">今すぐ始める</Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" size="lg">
                ログイン
              </Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-8 text-left">
            <div className="card">
              <h3 className="text-lg font-semibold mb-2">時間割管理</h3>
              <p className="text-gray-600">
                授業の時間割を登録・管理。週間・月間ビューで一目で把握できます。
              </p>
            </div>
            <div className="card">
              <h3 className="text-lg font-semibold mb-2">シフト管理</h3>
              <p className="text-gray-600">
                バイトのシフトを簡単登録。時間割と一緒に表示されます。
              </p>
            </div>
            <div className="card">
              <h3 className="text-lg font-semibold mb-2">空き時間提案</h3>
              <p className="text-gray-600">
                予定の合間の空き時間を自動で計算。効率的に時間を使えます。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
