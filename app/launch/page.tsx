'use client';

import { LaunchFeature } from '@/components/launch-feature';
import { AuthGuard } from '@/components/auth-guard';
import { useRouter } from 'next/navigation';

export default function LaunchPage() {
  const router = useRouter();

  const handleLaunchComplete = () => {
    router.push('/dashboard');
  };

  return (
    <AuthGuard>
      <LaunchFeature onComplete={handleLaunchComplete} />
    </AuthGuard>
  );
}