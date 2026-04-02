import { Outlet } from 'react-router-dom';

export function Layout() {
    return (
        <div className="min-h-screen flex flex-col">
            <header className="py-8 text-center border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
                <h1 className="text-4xl font-black mb-2 tracking-tight bg-linear-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">AudioCut GPT</h1>
                <p className="text-gray-400 font-medium">利用 GPT 大模型深度解析语音的智能剪辑工作站</p>
            </header>

            <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
                <Outlet />
            </main>

            <footer className="py-6 text-center text-gray-500 text-sm border-t border-gray-800">
                <p>© 2026 AudioCut GPT · AI-Powered Audio Editing</p>
            </footer>
        </div>
    );
}
