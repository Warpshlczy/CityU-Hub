import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';

// 光标与像素猫只是装饰，拆成独立 chunk，不占首屏加载
const TargetCursor = lazy(() =>
  import('./components/TargetCursor').then((module) => ({ default: module.TargetCursor })),
);
const PixelPet = lazy(() => import('./components/PixelPet').then((module) => ({ default: module.PixelPet })));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    // 纯静态部署到 GitHub Pages，使用 HashRouter 保证深链接刷新可用
    <HashRouter>
      <ScrollToTop />
      {/* 全站目标锁定光标：链接、按钮与卡片都会触发框选 */}
      <Suspense fallback={null}>
        <TargetCursor targetSelector="a, button, .cursor-target" />
        {/* 像素宠物：在页面里漫步、奔跑，并会和卡片/按钮互动 */}
        <PixelPet />
      </Suspense>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/project/:id" element={<ProjectDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
