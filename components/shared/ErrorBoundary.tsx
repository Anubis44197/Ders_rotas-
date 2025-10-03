import React from 'react';
import { AlertTriangle } from '../icons';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <div className="flex items-center space-x-3 text-red-800">
                        <AlertTriangle className="w-6 h-6" />
                        <div>
                            <h3 className="font-semibold">Bir hata oluştu</h3>
                            <p className="text-sm text-red-600">
                                {this.state.error?.message || 'Bilinmeyen bir hata meydana geldi'}
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;