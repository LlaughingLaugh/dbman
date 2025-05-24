import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/dashboard/databases');
  // Note: redirect() must be called before any JSX is returned.
  // So, typically, you wouldn't have any JSX here.
  return null;
}
