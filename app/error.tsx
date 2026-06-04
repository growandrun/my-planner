"use client";
import { useEffect } from "react";

export default function GlobalError({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 콘솔에도 찍어둠 (개발 도구로 확인 가능)
    console.error("[App error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-neutral-900 border border-red-500/40 rounded-xl p-5 max-w-md w-full space-y-3">
        <h2 className="font-bold text-lg text-red-400">⚠️ 오류가 발생했습니다</h2>
        <p className="text-sm text-neutral-300 break-words">{error?.message || String(error)}</p>
        {error?.digest && (
          <p className="text-[10px] text-neutral-500">digest: {error.digest}</p>
        )}
        <div className="flex gap-2 pt-2">
          <button onClick={reset} className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded text-sm">
            다시 시도
          </button>
          <button onClick={() => location.reload()} className="bg-neutral-700 px-3 py-2 rounded text-sm">
            새로고침
          </button>
        </div>
      </div>
    </div>
  );
}
