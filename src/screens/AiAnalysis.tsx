import { useEffect, useState } from "react"

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
    <AppShell breadcrumb={["Retention", "AI analysis"]}>
      <SectionHeader
        title={t("Phân tích AI nhân viên")}
        description={t(
          "Kiểm tra dữ liệu và xem kết quả hỗ trợ cho từng nhân viên.",
        )}
      />
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
