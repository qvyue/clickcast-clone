/**
 * ErrorBoundary 组件
 * 功能：捕获子组件的 JavaScript 错误，显示降级 UI，防止整个应用崩溃
 *
 * 使用方式：
 * <ErrorBoundary fallback={<ErrorUI />}>
 *   <VideoEditor />
 * </ErrorBoundary>
 */
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * 编辑器错误边界
 * 捕获渲染错误并显示友好的错误提示
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  /**
   * 捕获错误并更新状态
   */
  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  /**
   * 记录错误信息
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Editor ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  /**
   * 重置错误状态，允许用户重试
   */
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  /**
   * 刷新页面
   */
  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // 如果提供了自定义 fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误 UI
      return (
        <div className="editor-error-boundary">
          <div className="editor-error-boundary-icon">⚠️</div>
          <h1 className="editor-error-boundary-title">Something went wrong</h1>
          <p className="editor-error-boundary-message">
            The editor encountered an unexpected error. This has been logged.
            Please try refreshing the page.
          </p>
          {this.state.error && (
            <details className="editor-error-boundary-details">
              <summary>Error Details</summary>
              <pre>{this.state.error.toString()}</pre>
              {this.state.errorInfo && (
                <pre>{this.state.errorInfo.componentStack}</pre>
              )}
            </details>
          )}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={this.handleReset}>
              Try Again
            </button>
            <button className="btn btn-primary" onClick={this.handleReload}>
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
