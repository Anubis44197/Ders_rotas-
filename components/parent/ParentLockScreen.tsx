import React, { useState, useEffect } from 'react';
import { ParentLockScreenProps } from '../../types';
import { Lock } from '../icons';

const ParentLockScreen: React.FC<ParentLockScreenProps> = ({ onUnlock, error }) => {
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (password.length === 4) {
            onUnlock(password);
        }
    }, [password, onUnlock]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onUnlock(password);
    };

    return (
        <div className="flex items-center justify-center h-[calc(100vh-81px)] bg-slate-50">
            <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-xl shadow-lg text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full">
                    <Lock className="w-8 h-8 text-slate-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Ebeveyn Paneli Kilitli</h2>
                <p className="text-slate-500">Devam etmek için lütfen şifrenizi girin.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••"
                        autoFocus
                        className="w-full px-4 py-2 text-center text-lg tracking-widest bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    {error && <p className="text-sm text-red-500">{error}</p>}
                </form>
            </div>
        </div>
    );
};

export default ParentLockScreen;