import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

/** 顶栏提交按钮；窄屏只留图标，避免挤占搜索栏 */
export function SubmitProject() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate('/submit')}
      aria-label="Submit"
      title="我也要提交项目（先 fork 本站再填表）"
      className="chip-brutal flex h-11 shrink-0 items-center gap-2 px-3 text-[9px]"
    >
      <Plus className="size-4 text-brand" />
      <span className="pixel hidden sm:inline">SUBMIT</span>
    </button>
  );
}