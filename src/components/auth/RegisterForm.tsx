'use client';

import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth, googleProvider } from '@/lib/firebase-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // L-2: パスワード 8 文字以上
    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください');
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name) {
        await updateProfile(cred.user, { displayName: name });
      }
      router.push('/calendar');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '不明なエラー';
      if (msg.includes('email-already-in-use')) {
        setError('このメールアドレスは既に登録されています');
      } else if (msg.includes('weak-password')) {
        setError('パスワードが弱すぎます。8文字以上にしてください');
      } else {
        setError('登録に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      router.push('/calendar');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '不明なエラー';
      if (!msg.includes('popup-closed-by-user')) {
        setError('Googleログインに失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleEmailRegister} className="space-y-4">
        <Input
          label="名前（任意）"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
        <Input
          label="メールアドレス"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Input
          label="パスワード（8文字以上）"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" loading={loading}>
          登録
        </Button>
      </form>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">または</span>
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={handleGoogleRegister}
        loading={loading}
      >
        Googleで登録
      </Button>
    </div>
  );
}
