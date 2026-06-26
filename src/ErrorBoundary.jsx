import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface dark:bg-gray-950 flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
              Une erreur est survenue
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Recharge la page. Si le problème persiste, contacte l'administrateur.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
            >
              Recharger la page
            </button>
            {import.meta.env.DEV && (
              <pre className="mt-6 text-left text-xs bg-gray-100 dark:bg-gray-700 rounded p-3 overflow-auto text-red-600 dark:text-red-400">
                {this.state.error?.toString()}
              </pre>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
