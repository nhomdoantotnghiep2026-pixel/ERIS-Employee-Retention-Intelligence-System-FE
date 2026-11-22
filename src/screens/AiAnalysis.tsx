import { useEffect, useState } from "react"
import { FileDown, RefreshCw } from "lucide-react"

import { AppShell } from "../components/AppShell"

import { Button, SectionHeader } from "../components/ui"

import { useLanguage } from "../context/LanguageContext"

import {
  getAiModel,
  listAiEmployees,
  getApiErrorMessage,
  type AiEmployee,
} from "../services/api"

import { IndividualAnalysis } from "../components/ai-workspace/IndividualAnalysis"

import "../components/ai-workspace/workspace.css"

export default function AiAnalysis() {
  const { t } = useLanguage()

  const [employees, setEmployees] = useState<AiEmployee[]>([])

  const [error, setError] = useState("")

  const [loading, setLoading] = useState(true)

  const [reload, setReload] = useState(0)

  useEffect(() => {
    let live = true

    setLoading(true)
    setError("")

    Promise.all([listAiEmployees(), getAiModel()])
      .then(([response]) => {
        if (live) setEmployees(response.data)
      })
      .catch((e) => {
        if (live)
          setError(
            getApiErrorMessage(
              e,
              "Không tải được dữ liệu phân tích. Vui lòng thử lại.",
            ),
          )
      })

      .finally(() => {
        if (live) setLoading(false)
      })

    return () => {
      live = false
    }
  }, [reload])

  return (
    <AppShell breadcrumb={["Quản lý nhân tài", "Đánh giá mức độ gắn kết"]}>
      <SectionHeader
        title={t("Hồ sơ sức khỏe nhân sự & Kế hoạch giữ chân")}
        description={t(
          "Đánh giá rủi ro thôi việc và đề xuất lộ trình giữ chân dựa trên dữ liệu làm việc thực tế.",
        )}
      >
        <Button variant="secondary" onClick={() => setReload(v => v + 1)}><RefreshCw size={16} />{t("Cập nhật dữ liệu từ HRIS")}</Button>
        <Button variant="secondary" onClick={() => window.print()}><FileDown size={16} />{t("Tải tóm tắt nhân sự (PDF)")}</Button>
      </SectionHeader>
      <div className="ai-workspace text-slate-900">
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {t(error)}
            <Button
              className="ml-3"
              variant="secondary"
              onClick={() => setReload((v) => v + 1)}
            >
              {t("Thử lại")}
            </Button>
          </div>
        )}
        {loading ? (
          <p role="status" className="py-8">
            {t("Đang tải dữ liệu…")}
          </p>
        ) : (
          <IndividualAnalysis
            employees={employees}
            initial={{}}
            onSelectionChange={() => {}}
          />
        )}
      </div>
    </AppShell>
  )
}
