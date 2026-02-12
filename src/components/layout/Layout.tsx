import { Outlet } from 'react-router-dom';

export function Layout() {
    return (
        <div className="min-h-screen flex flex-col">
            <header className="py-8 text-center border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
                <h1 className="text-3xl font-bold mb-2">🎵 智能音频剪辑工具</h1>
                <p className="text-gray-400">上传音频 · 自动识别文字 · 精准剪辑</p>
            </header>

            <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
                <Outlet />
            </main>

            <footer className="py-6 text-center text-gray-500 text-sm border-t border-gray-800">
                <p>© 2026 Voice Editor - Power by React 19 & Claude</p>
            </footer>
        </div>
    );
}
