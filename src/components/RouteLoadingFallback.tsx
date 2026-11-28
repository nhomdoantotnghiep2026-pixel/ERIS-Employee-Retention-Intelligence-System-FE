import { useLanguage } from "../context/LanguageContext"
import { LoadingState } from "./ui/page-state"

export function RouteLoadingFallback() {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto mb-5 flex w-full max-w-5xl items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full border-2 border-orange-500 bg-white text-lg font-black text-orange-600 shadow-sm">
          e
        </span>
        <div>
          <p className="font-bold tracking-tight text-slate-950">ERIS</p>
          <p className="text-xs font-medium text-slate-600">
            {tr("Hệ thống hỗ trợ giữ chân nhân viên", "Employee retention intelligence")}
          </p>
        </div>
      </div>

      <LoadingState
        title={tr("Đang mở chức năng", "Opening workspace")}
        description={tr(
          "ERIS đang tải đúng dữ liệu và giao diện cho vai trò của bạn.",
          "ERIS is loading the data and workspace for your role.",
        )}
      />
    </main>
  )
}
