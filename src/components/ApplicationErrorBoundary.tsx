import { Component, type ErrorInfo, type ReactNode } from "react"
import { Home } from "lucide-react"
import { Link, useLocation } from "react-router-dom"

import { useLanguage } from "../context/LanguageContext"
import { useRole } from "../context/RoleContext"
import { ROLE_HOME } from "../workflows/access"
import { ErrorStatePanel } from "./ui/page-state"
import { Button } from "./ui/button"

type ApplicationErrorBoundaryProps = {
  children: ReactNode
  resetKey: string
}

type ApplicationErrorBoundaryState = {
  error: Error | null
}

class ApplicationErrorBoundary extends Component<
  ApplicationErrorBoundaryProps,
  ApplicationErrorBoundaryState
> {
  state: ApplicationErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ERIS] Unhandled route error", error, info.componentStack)
  }

  componentDidUpdate(previousProps: ApplicationErrorBoundaryProps) {
    if (
      this.state.error &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ error: null })
    }
  }

  retry = () => {
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    return <ApplicationErrorFallback onRetry={this.retry} />
  }
}

function ApplicationErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { language } = useLanguage()
  const { user, isAuthenticated } = useRole()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const destination = isAuthenticated ? ROLE_HOME[user.role] : "/login"

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <ErrorStatePanel
        title={tr("Không thể hiển thị chức năng này", "This workspace could not be displayed")}
        description={tr(
          "Dữ liệu của bạn chưa bị thay đổi. Hãy thử mở lại màn hình hoặc trở về trang chính.",
          "Your data has not been changed. Try opening the workspace again or return to your home page.",
        )}
        retryLabel={tr("Thử mở lại", "Try again")}
        onRetry={onRetry}
        secondaryAction={
          <Button asChild type="button" variant="outline" size="lg">
            <Link to={destination}>
              <Home className="size-4" />
              {tr("Về trang chính", "Go to home")}
            </Link>
          </Button>
        }
      />
    </main>
  )
}

export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  const resetKey = `${location.pathname}${location.search}`

  return (
    <ApplicationErrorBoundary resetKey={resetKey}>
      {children}
    </ApplicationErrorBoundary>
  )
}
