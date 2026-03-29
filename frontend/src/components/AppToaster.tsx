'use client';

import { Toaster } from 'sonner';

export function AppToaster() {
  return (
    <Toaster
      theme="dark"
      position="top-center"
      offset={72}
      toastOptions={{
        classNames: {
          toast:
            '!bg-[#161614] !border-[#222220] !text-[#F4F3EF] !shadow-lg',
          success: '!border-[#34A853]/40',
          error: '!border-[#e05252]/40',
        },
      }}
    />
  );
}
