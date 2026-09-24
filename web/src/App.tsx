import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { trackVisit } from './api/stats';
import { PixelPet } from './components/PixelPet';
import { TargetCursor } from './components/TargetCursor';
import { WelcomeDialog } from './components/WelcomeDialog';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { SubmitPage } from './pages/SubmitPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

/** 接口不可用或开了 Do Not Track 时内部跳过 */
function SiteAnalytics() {
  useEffect(() => {
    trackVisit();
  }, []);
  return null;
}

// 老链接兼容：旧版用 HashRouter，分享地址形如 /#/project/xxx。
// 改成真实路径后 hash 不再被解析，这里补一次跳转，免得老分享失效。
function LegacyHashRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#/')) return;
    const path = hash.slice(1).split('?')[0];
    if (!path) return;
    navigate(path, { replace: true });
  }, [navigate]);
  return null;
}

export default function App() {
  return (
    // 每个项目要有独立真实 URL 才利于爬虫分别收录；深链接刷新由 Vercel rewrite 兜底（见 vercel.json）
    <BrowserRouter>
      <ScrollToTop />
      <SiteAnalytics />
      <LegacyHashRedirect />
      <TargetCursor targetSelector="a, button, .cursor-target" />
      <PixelPet />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/project/:id" element={<ProjectDetailPage />} />
        <Route path="/submit" element={<SubmitPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {/* 放在路由之外：直接落在详情页分享链接时也要能弹出来 */}
      <WelcomeDialog />
    </BrowserRouter>
  );
}
