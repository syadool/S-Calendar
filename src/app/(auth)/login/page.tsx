import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="card">
      <h2 className="text-2xl font-bold text-center mb-6">ログイン</h2>
      <LoginForm />
      <p className="mt-4 text-center text-sm text-gray-600">
        アカウントをお持ちでない方は
        <Link href="/register" className="text-primary-600 hover:underline ml-1">
          新規登録
        </Link>
      </p>
    </div>
  )
}
