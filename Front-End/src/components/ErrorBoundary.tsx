import { Component, ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: unknown) {
    console.error('ErrorBoundary caught', err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <h2 className="text-xl font-semibold">Something went wrong.</h2>
          <p className="text-slate-600 mt-1">Please refresh the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
