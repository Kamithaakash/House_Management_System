import { Component } from 'react'

// Catches any unexpected render/chunk error so the user never sees a blank white screen.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold text-slate-800">Page needs a quick refresh</h1>
          <p className="mt-2 text-sm text-slate-600">
            A new version of Vimana may have been published. Tap below to reload.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 min-h-12 w-full rounded-lg bg-indigo-600 px-4 font-medium text-white"
          >
            Reload app
          </button>
        </main>
      )
    }
    return this.props.children
  }
}
