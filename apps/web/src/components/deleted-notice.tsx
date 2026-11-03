'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useToast } from '@/components/toast';

/** /login?deleted=1 로 들어오면 계정 삭제 완료 토스트를 한 번 보여 주고 주소의 표시를 지운다 */
export function DeletedNotice() {
  const params = useSearchParams();
  const toast = useToast();
  const shown = useRef(false);
  const deleted = params.get('deleted') === '1';

  useEffect(() => {
    if (!deleted || shown.current) return;
    shown.current = true;
    toast.show('계정을 삭제했어요');
    window.history.replaceState(null, '', '/login');
  }, [deleted, toast]);

  return null;
}
