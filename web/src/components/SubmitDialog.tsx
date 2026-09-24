import { useEffect, useState } from 'react';
import { ExternalLink, FilePenLine, GitFork, Keyboard, RefreshCw, X } from 'lucide-react';
import { checkUserFork, type ForkCheckStatus } from '../api/github';
import { REPO_URL } from '../constants/repo';
import {
  TEMPLATE_SKELETON,
  buildForkNewFileUrl,
  buildNewFileUrl,
  buildProjectMarkdown,
  isUrlTooLong,
  parseDraftTags,
  toRepoFileName,
  type ProjectDraft,
} from '../utils/submitTemplate';

const EMPTY_DRAFT: ProjectDraft = {
  title: '',
  author: '',
  authorName: '',
  major: '',
  enrollmentYear: '',
  repoUrl: '',
  homepageUrl: '',
  category: '',
  tags: '',
  summary: '',
  intro: '',
  features: '',
};

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  type?: string;
}

function Field({ label, value, onChange, placeholder, required, hint, type }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="pixel text-[9px] text-muted">
        {label}
        {required && <span className="ml-1 text-brand">*</span>}
      </span>
      <input
        type={type ?? 'text'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="input-brutal px-2.5 py-2 text-[12px]"
      />
      {hint && <span className="mono text-[10px] text-muted">{hint}</span>}
    </label>
  );
}

interface TextAreaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

function TextArea({ label, value, onChange, placeholder, rows = 4 }: TextAreaProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="pixel text-[9px] text-muted">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="input-brutal resize-y px-2.5 py-2 text-[12px]"
      />
    </label>
  );
}

/** 校验失败的错误统一显示在表单顶部 */
function validateDraft(draft: ProjectDraft) {
  const errors: string[] = [];
  const required: Array<[keyof ProjectDraft, string]> = [
    ['title', '项目名称'],
    ['author', 'GitHub 用户名'],
    ['authorName', '真实姓名'],
    ['major', '专业'],
    ['enrollmentYear', '入学年份'],
    ['repoUrl', '仓库地址'],
  ];
  for (const [key, label] of required) {
    if (!draft[key].trim()) errors.push(`请填写${label}`);
  }

  const year = Number(draft.enrollmentYear);
  if (draft.enrollmentYear.trim() && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
    errors.push('入学年份必须是 2000–2100 之间的整数');
  }

  const repoUrl = draft.repoUrl.trim();
  if (repoUrl && !/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+/.test(repoUrl)) {
    errors.push('仓库地址必须是 https://github.com/owner/repo 形式');
  }

  const tags = parseDraftTags(draft.tags);
  if (tags.length > 12) errors.push('标签最多 12 个');
  if (tags.some((tag) => tag.length > 16)) errors.push('单个标签最长 16 个字符');

  if (draft.title.trim().length > 200) errors.push('项目名称最长 200 个字符');
  if (draft.authorName.trim().length > 120) errors.push('真实姓名最长 120 个字符');
  if (draft.major.trim().length > 120) errors.push('专业最长 120 个字符');
  if (draft.summary.trim().length > 600) errors.push('摘要最长 600 个字符');
  if (draft.category.trim().length > 80) errors.push('分类最长 80 个字符');

  return errors;
}

/** 文件名取仓库名，仓库名不合法时退回项目名 */
function draftFileName(draft: ProjectDraft) {
  const repo = draft.repoUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
    .split('/')
    .pop();
  return `${toRepoFileName(repo || draft.title)}.md`;
}

/** 提交入口弹窗：网页填表引导 fork 后自己开 PR，或去 GitHub 手写 */
export function SubmitDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'choose' | 'form'>('choose');
  const [draft, setDraft] = useState<ProjectDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<string[]>([]);
  const [forkState, setForkState] = useState<ForkCheckStatus | 'idle' | 'checking'>('idle');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const patch = (key: keyof ProjectDraft) => (value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const openGithub = (fileName: string, content: string) => {
    const url = buildNewFileUrl(fileName, content);
    if (isUrlTooLong(url)) {
      setErrors(['内容太长，无法一次性带到 GitHub，请精简项目介绍后再提交']);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const openForkEditor = (fileName: string, content: string) => {
    const url = buildForkNewFileUrl(draft.author, fileName, content);
    if (isUrlTooLong(url)) {
      setErrors(['内容太长，无法一次性带到 fork，请精简项目介绍后再提交']);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  // 先确认填写的 GitHub 用户名是否 fork 了本站仓库，未 fork 就先引导 fork
  const runForkCheck = async (fileName: string, content: string) => {
    setForkState('checking');
    const status = await checkUserFork(draft.author);
    setForkState(status);
    if (status === 'has-fork') {
      // 已 fork：到自己在 fork 里的 feature 分支新建文件，提交即开 PR
      openForkEditor(fileName, content);
      return;
    }
    // 未 fork / 检测失败：停留在面板上引导用户先 fork
  };

  const submitForm = async () => {
    const found = validateDraft(draft);
    setErrors(found);
    if (found.length > 0) return;

    const fileName = `repos/${draftFileName(draft)}`;
    const content = buildProjectMarkdown(draft);
    if (forkState === 'has-fork') {
      // 已确认 fork：直接跳到 fork 编辑器（可重复点击）
      openForkEditor(fileName, content);
      return;
    }
    // 首次提交或点「我已 Fork，重新检测」：再查一次 fork 状态
    await runForkCheck(fileName, content);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="dialog-backdrop-in absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="提交项目"
        className="dialog-panel-in panel-brutal relative my-4 w-full max-w-2xl p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="pixel flex items-center gap-2 text-[10px] text-ink">
              <span className="size-3 shrink-0 bg-brand" />
              我也要提交项目
            </h2>
            <p className="mono mt-2 text-[11px] text-muted">
              {mode === 'choose' ? '选择一种提交方式' : '先确认你是否已 fork 本站并拉到 feature 分支'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭提交面板"
            className="btn-brutal btn-brutal-secondary !p-0 size-9"
          >
            <X className="size-4" />
          </button>
        </div>

        {mode === 'choose' ? (
          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={() => setMode('form')}
              className="card-brutal flex w-full items-start gap-3 p-4 text-left"
            >
              <Keyboard className="mt-0.5 size-5 shrink-0 text-brand" />
              <span className="flex flex-col gap-1.5">
                <span className="pixel text-[10px] text-ink">网页填写</span>
                <span className="mono text-[11px] text-muted">
                  在这里填好字段，提交前会引导你先 fork 本站仓库并从 feature 分支提交。
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => openGithub('repos/my-project.md', TEMPLATE_SKELETON)}
              className="card-brutal flex w-full items-start gap-3 p-4 text-left"
            >
              <FilePenLine className="mt-0.5 size-5 shrink-0 text-accent" />
              <span className="flex flex-col gap-1.5">
                <span className="pixel text-[10px] text-ink">去 GitHub 自己写</span>
                <span className="mono text-[11px] text-muted">
                  打开 GitHub 的 Markdown 编辑器，模板已经预填，你补完内容再提交。
                </span>
              </span>
            </button>

            <p className="mono flex items-start gap-2 border-l-[3px] border-brand bg-surface px-3 py-2 text-[11px] text-muted">
              <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-brand" />
              <span>
                两种方式都会提 PR 到 <span className="text-ink">feature</span> 分支，合并后网站会自动更新。
                网页填写会先引导你 fork 本站仓库并切到 feature 分支；去 GitHub 自己写则直接进入 GitHub 的编辑页。
              </span>
            </p>
          </div>
        ) : (
          <>
            {errors.length > 0 && (
              <ul className="mt-4 space-y-1 border-[3px] border-brand bg-surface px-3 py-2">
                {errors.map((message) => (
                  <li key={message} className="mono text-[11px] text-brand">
                    {message}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="项目名称" required value={draft.title} onChange={patch('title')} placeholder="My Project" />
              <Field
                label="GitHub 用户名"
                required
                value={draft.author}
                onChange={patch('author')}
                placeholder="your-github-name"
              />
              <Field label="真实姓名" required value={draft.authorName} onChange={patch('authorName')} placeholder="你的姓名" />
              <Field label="专业" required value={draft.major} onChange={patch('major')} placeholder="Computer Science" />
              <Field
                label="入学年份"
                required
                type="number"
                value={draft.enrollmentYear}
                onChange={patch('enrollmentYear')}
                placeholder="2024"
              />
              <Field
                label="仓库地址"
                required
                value={draft.repoUrl}
                onChange={patch('repoUrl')}
                placeholder="https://github.com/owner/repo"
              />
              <Field label="Demo 地址" value={draft.homepageUrl} onChange={patch('homepageUrl')} placeholder="没有就留空" />
              <Field
                label="分类"
                value={draft.category}
                onChange={patch('category')}
                placeholder="学习辅助 / 效率工具 …"
              />
              <Field
                label="标签"
                value={draft.tags}
                onChange={patch('tags')}
                placeholder="python, cli"
                hint="逗号分隔，最多 12 个，每个最长 16 字符"
              />
              <Field
                label="摘要"
                value={draft.summary}
                onChange={patch('summary')}
                placeholder="一句话说明这个项目"
                hint="最长 600 字，会显示在卡片上"
              />
            </div>

            <div className="mt-3 space-y-3">
              <TextArea
                label="项目介绍"
                value={draft.intro}
                onChange={patch('intro')}
                placeholder="它解决什么问题、适合谁使用"
              />
              <TextArea
                label="Features（每行一条，可留空）"
                value={draft.features}
                onChange={patch('features')}
                rows={3}
                placeholder={'功能一\n功能二'}
              />
            </div>

            {forkState === 'checking' && (
              <p className="mono mt-5 flex items-center gap-2 border-[3px] border-accent bg-surface px-3 py-2 text-[11px] text-ink">
                <RefreshCw className="size-3.5 animate-spin text-accent" />
                正在检查 @{draft.author.trim() || '你'} 是否已 fork 本站并拉好 feature 分支…
              </p>
            )}

            {(forkState === 'no-fork' || forkState === 'error') && (
              <div className="mt-5 border-[3px] border-accent bg-surface p-4">
                <div className="flex items-start gap-2">
                  <GitFork className="mt-0.5 size-4 shrink-0 text-accent" />
                  <div className="flex flex-col gap-1.5">
                    <h3 className="pixel text-[10px] text-ink">
                      {forkState === 'no-fork'
                        ? `@${draft.author.trim() || '该用户'} 还没有 fork 本站仓库`
                        : '暂时无法确认你是否已 fork'}
                    </h3>
                    <p className="mono text-[11px] text-muted">
                      提交前请先完成下面 3 步，再点「我已 Fork」，生成结果会带到你 fork 的 feature 分支上。
                    </p>
                  </div>
                </div>

                <ol className="mono mt-3 space-y-2 text-[11px] text-ink">
                  <li className="flex gap-2">
                    <span className="size-4 shrink-0 border-[2px] border-ink text-center text-[9px] leading-4">1</span>
                    <span>
                      Fork 本站仓库：
                      <a
                        href={REPO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent underline underline-offset-2"
                      >
                        {REPO_URL}
                      </a>
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="size-4 shrink-0 border-[2px] border-ink text-center text-[9px] leading-4">2</span>
                    <span>
                      在 fork 里切到 <span className="text-brand">feature</span> 分支（本地执行{' '}
                      <code className="border border-ink bg-surface px-1">git fetch upstream feature</code>，或直接在 fork
                      网页上查看 feature），确保与本站保持一致。
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="size-4 shrink-0 border-[2px] border-ink text-center text-[9px] leading-4">3</span>
                    <span>
                      回到这里点「我已 Fork」，页面会带你把文件建到 fork 的 feature 分支，提交后开 PR 回本站。
                    </span>
                  </li>
                </ol>

                {forkState === 'error' && (
                  <p className="mono mt-3 text-[10px] text-muted">检测接口暂时不可用，你可先 Fork 再重试检测。</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={submitForm}
                    className="btn-brutal btn-brutal-primary"
                  >
                    我已 Fork，重新检测
                  </button>
                  <a
                    href={REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-brutal btn-brutal-secondary"
                  >
                    Fork 本站仓库
                  </a>
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={submitForm}
                disabled={forkState === 'checking'}
                className="btn-brutal btn-brutal-primary"
              >
                {forkState === 'checking' ? '检查中…' : '生成提交链接'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrors([]);
                  setMode('choose');
                }}
                disabled={forkState === 'checking'}
                className="btn-brutal btn-brutal-secondary"
              >
                返回
              </button>
              <span className="mono text-[10px] text-muted">带 * 为必填，提交前请确认仓库是公开的</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
