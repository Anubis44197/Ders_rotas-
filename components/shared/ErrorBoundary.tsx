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
                <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-100">
                    <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-200">
                                <AlertTriangle className="h-6 w-6" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-xl font-black">Uygulama acilirken bir veri hatasi yakalandi</h1>
                                <p className="mt-2 text-sm leading-6 text-slate-300">
                                    Beyaz ekran yerine bu kurtarma ekrani gosteriliyor. Sayfayi yenileyebilir ya da bu tarayicidaki yerel DersRotasi verisini temizleyip temiz baslangic yapabilirsiniz.
                                </p>
                                <p className="mt-3 rounded-2xl bg-black/20 px-3 py-2 text-xs text-rose-100">
                                    {this.state.error?.message || 'Bilinmeyen bir hata meydana geldi'}
                                </p>
                                <div className="mt-5 flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={() => window.location.reload()}
                                        className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950"
                                    >
                                        Yeniden dene
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            window.localStorage.clear();
                                            window.location.reload();
                                        }}
                                        className="rounded-2xl border border-rose-300/50 px-4 py-2 text-sm font-bold text-rose-100"
                                    >
                                        Yerel veriyi temizle
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
