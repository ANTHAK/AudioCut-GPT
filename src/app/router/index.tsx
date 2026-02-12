import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { EditorPage } from '@/features/editor/components/EditorPage';

export function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<Layout />}>
                    <Route path="/" element={<EditorPage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
