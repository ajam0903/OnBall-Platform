// OnBallMobile/src/components/ErrorBoundary.jsx
import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Mobile Error caught by boundary:', error, errorInfo);

        this.setState({
            error: error,
            errorInfo: errorInfo
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="mobile-safe-area h-full flex flex-col items-center justify-center p-4 bg-red-900 text-white">
                    <div className="text-center">
                        <h2 className="text-xl font-bold mb-4">Something went wrong</h2>
                        <p className="mb-4 text-red-200">The app encountered an error.</p>
                        
                        <button
                            onClick={() => this.setState({ hasError: false })}
                            className="btn bg-white text-red-900 hover:bg-gray-100"
                        >
                            Try Again
                        </button>
                        
                        <details className="mt-4 text-left bg-red-800 p-4 rounded">
                            <summary className="cursor-pointer mb-2 font-medium">Error Details</summary>
                            <pre className="text-xs whitespace-pre-wrap">
                                {this.state.error && this.state.error.toString()}
                                {this.state.errorInfo && this.state.errorInfo.componentStack}
                            </pre>
                        </details>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;