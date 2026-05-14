// L-3: next-auth.d.ts は不要。AuthUser を定義
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
