import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Compass } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/feedback';

export function RouteError() {
  const error = useRouteError();
  const isChunkError = error instanceof Error && /dynamically imported module|Loading chunk/i.test(error.message);
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <ErrorState
        title={isChunkError ? 'Ứng dụng vừa được cập nhật' : 'Trang gặp lỗi'}
        message={isChunkError ? 'Hãy tải lại trang để dùng phiên bản mới.' : 'Đã có lỗi không mong muốn. Bạn có thể tải lại trang.'}
        onRetry={() => window.location.reload()}
      />
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
      <div className="mb-4 rounded-xl bg-primary-soft p-3 text-primary">
        <Compass className="h-6 w-6" aria-hidden />
      </div>
      <h1 className="text-2xl font-semibold">Không tìm thấy trang</h1>
      <p className="mt-2 text-sm text-muted">Đường dẫn có thể đã thay đổi hoặc không tồn tại.</p>
      <ButtonLink to="/" className="mt-6">
        Về trang chủ
      </ButtonLink>
    </div>
  );
}
