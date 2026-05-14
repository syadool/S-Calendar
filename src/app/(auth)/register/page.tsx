import Link from 'next/link'
import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <div className="card">
      <h2 className="text-2xl font-bold text-center mb-6">新規登録</h2>
      <RegisterForm />
      <p className="mt-4 text-center text-sm text-gray-600">
        すでにアカウントをお持ちの方は
        <Link href="/login" className="text-primary-600 hover:underline ml-1">
          ログイン
        </Link>
      </p>
    </div>
  )
}
