import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ExternalLink, GitFork, Lock, RefreshCw, Send } from 'lucide-react';
import { checkUserFork, type ForkCheckStatus } from '../api/github';
import { Header } from '../components/Header';
import { REPO_URL } from '../constants/repo';
import { setRouteMeta } from '../utils/seo';
import {
  buildForkNewFileUrl,
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

// Brutalist 像素风 fork 指引示意图（text_to_image 生成，示意而非真实 GitHub 界面）
const FORK_ILLUSTRATION =
  'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=' +
  encodeURIComponent(
    'Retro pixel art instructional diagram of GitHub forking: a repository page with a big FORK button highlighted in neon magenta, ' +
      'a branch selector dropdown showing the feature branch, arrows pointing from fork button to a branch list labeled feature, ' +
      'hard 3px black borders, chunky pixels, neon magenta and purple on dark background, brutalist design, no text labels, clean layout',
  ) +
  '&image_size=landscape_4_3';

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  type?: string;
  disabled?: boolean;
}

function Field({ label, value, onChange, placeholder, required, hint, type, disabled }: FieldProps) {
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
        disabled={disabled}
        className="input-brutal px-2.5 py-2 text-[12px] disabled:bg-muted/20 disabled:text-smoke disabled:opacity-60"
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

interface StepProps {
  username: string;
  onUsernameChange: (value: string) => void;
  onConfirm: (username: string) => void;
}

/** 步骤一：填写 GitHub 用户名并确认已 fork，通过后才允许进入表单 */
function ForkGate({ username, onUsernameChange, onConfirm }: StepProps) {
  const [forkState, setForkState] = useState<ForkCheckStatus | 'idle' | 'checking'>('idle');
  const [hint, setHint] = useState('');

  const check = async () => {
    const user = username.trim();
    if (!user) {
      setHint('请先填写你的 GitHub 用户名');
      return;
    }
    if (!/^[a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d])){0,38}$/.test(user)) {
      setHint('GitHub 用户名格式不正确');
      return;
    }
    setHint('');
    setForkState('checking');
    const status = await checkUserFork(user);
    setForkState(status);
    if (status === 'has-fork') onConfirm(user);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <div className="border-[3px] border-line bg-surface p-4">
          <div className="flex items-start gap-2">
            <GitFork className="mt-0.5 size-4 shrink-0 text-accent" />
            <div className="flex flex-col gap-1.5">
              <h3 className="pixel text-[10px] text-ink">第一步：先 Fork 本站仓库并切到 feature 分支</h3>
              <p className="mono text-[11px] text-muted">
                提交前需要你自己的 fork，提交会发生在它上面的 <span className="text-brand">feature</span> 分支。
                按下面 3 步完成后再回来验证。
              </p>
            </div>
          </div>

          <ol className="mono mt-3 space-y-2 text-[11px] text-ink">
            <li className="flex gap-2">
              <span className="size-4 shrink-0 border-2 border-ink text-center text-[9px] leading-4">1</span>
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
              <span className="size-4 shrink-0 border-2 border-ink text-center text-[9px] leading-4">2</span>
              <span>
                在 fork 里切到 <span className="text-brand">feature</span> 分支。本地执行{' '}
                <code className="border border-ink bg-surface px-1">git fetch upstream feature</code>
                ，或直接在 fork 网页上查看 feature 分支，确保它与本站一致。
              </span>
            </li>
            <li className="flex gap-2">
              <span className="size-4 shrink-0 border-2 border-ink text-center text-[9px] leading-4">3</span>
              <span>
                填好下面的 GitHub 用户名，点「确认已 fork」。验证通过会锁定用户名，然后进入表单填写。
              </span>
            </li>
          </ol>

          <img
            src={FORK_ILLUSTRATION}
            alt="fork 并切换到 feature 分支的示意图"
            loading="lazy"
            className="mt-3 w-full border-2 border-line object-cover"
          />
        </div>

        <div className="flex flex-col gap-3 border-[3px] border-line bg-surface p-4 sm:flex-row sm:items-center">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="pixel text-[9px] text-muted">
              GitHub 用户名<span className="ml-1 text-brand">*</span>
            </span>
            <input
              type="text"
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              placeholder="your-github-name"
              disabled={forkState === 'checking'}
              autoComplete="username"
              className="input-brutal px-2.5 py-2 text-[12px]"
            />
          </label>
          <button
            type="button"
            onClick={check}
            disabled={forkState === 'checking'}
            className="btn-brutal btn-brutal-rainbow h-11 shrink-0"
          >
            {forkState === 'checking' ? (
              <>
                <RefreshCw className="size-4 animate-spin" /> 验证中…
              </>
            ) : (
              <>
                <Check className="size-4" /> 确认已 fork
              </>
            )}
          </button>
        </div>

        {hint && (
          <p className="mono border-l-[3px] border-brand bg-surface px-3 py-2 text-[11px] text-brand">{hint}</p>
        )}

        {forkState === 'no-fork' && (
          <div className="border-[3px] border-accent bg-surface p-4">
            <p className="mono text-[11px] text-ink">
              @{username.trim()} 还没有 fork 本站仓库。请先完成上面的第 1、2 步，再回来点「确认已 fork」重新验证。
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" onClick={check} className="btn-brutal btn-brutal-primary">
                我已 Fork，重新验证
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

        {forkState === 'error' && (
          <div className="border-[3px] border-accent bg-surface p-4">
            <p className="mono text-[11px] text-ink">暂时无法确认是否已 fork（接口可能限流或不可用）。</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" onClick={check} className="btn-brutal btn-brutal-primary">
                重新验证
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
      </div>
    </div>
  );
}

/** 步骤二：完整表单。用户名已在上一步验证并锁定，提交直接生成 fork 分支上的新建文件链接 */
function SubmitForm({ confirmedUser, onRestart }: { confirmedUser: string; onRestart: () => void }) {
  const [draft, setDraft] = useState<ProjectDraft>({ ...EMPTY_DRAFT, author: confirmedUser });
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<{ url: string } | null>(null);

  const patch = (key: keyof ProjectDraft) => (value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const generate = () => {
    const found = validateDraft(draft);
    setErrors(found);
    if (found.length > 0) return;

    const fileName = `repos/${draftFileName(draft)}`;
    const content = buildProjectMarkdown(draft);
    const url = buildForkNewFileUrl(confirmedUser, fileName, content);
    if (isUrlTooLong(url)) {
      setErrors(['内容太长，无法一次性带到 fork，请精简项目介绍后再提交']);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    setDone({ url });
  };

  if (done) {
    return (
      <div className="space-y-4">
        <p className="mono text-[12px] text-ink">
          已在新的标签页打开你 fork 的 <span className="text-brand">feature</span> 分支新建文件。内容已预填，你确认无误后提交，即会开 PR 回本站。
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={done.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-brutal btn-brutal-primary"
          >
            <ExternalLink className="size-4" /> 在 GitHub 打开
          </a>
          <button
            type="button"
            onClick={() => {
              setDone(null);
              setDraft({ ...EMPTY_DRAFT, author: confirmedUser });
              setErrors([]);
            }}
            className="btn-brutal btn-brutal-secondary"
          >
            再提交一个
          </button>
          <button type="button" onClick={onRestart} className="btn-brutal btn-brutal-secondary">
            重新验证 fork
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-[3px] border-brand bg-surface px-3 py-2">
        <Lock className="size-4 shrink-0 text-brand" />
        <span className="mono text-[11px] text-muted">
          已确认 <span className="text-ink">@{confirmedUser}</span> 已 fork 本站，用户名已锁定不可修改。
        </span>
        <button
          type="button"
          onClick={onRestart}
          className="mono ml-auto text-[10px] text-accent underline underline-offset-2"
        >
          更换用户名
        </button>
      </div>

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
        <Field label="GitHub 用户名" required value={draft.author} onChange={() => {}} disabled hint={`锁定为 @${confirmedUser}，更换请点上方「更换用户名」`} />
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
        <Field label="分类" value={draft.category} onChange={patch('category')} placeholder="学习辅助 / 效率工具 …" />
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

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={generate} className="btn-brutal btn-brutal-primary">
          <Send className="size-4" /> 生成提交链接
        </button>
        <button type="button" onClick={onRestart} className="btn-brutal btn-brutal-secondary">
          上一步
        </button>
        <span className="mono text-[10px] text-muted">带 * 为必填，提交前请确认仓库是公开的</span>
      </div>
    </div>
  );
}

/** 独立的提交页面：先引导 fork 并验证用户名，通过后再填表 */
export function SubmitPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [confirmedUser, setConfirmedUser] = useState<string | null>(null);

  useEffect(() => {
    setRouteMeta({
      title: '提交项目 · CityU Hub',
      description: '提交你的开源项目到 CityU Hub：先 fork 本站仓库并切到 feature 分支，验证后填写表单。',
      path: window.location.pathname,
    });
  }, []);

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mono mb-4 inline-flex items-center gap-1.5 text-[11px] text-muted hover:text-ink"
        >
          <ArrowLeft className="size-3.5" /> 返回首页
        </button>

        <div className="panel-brutal p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="size-3 shrink-0 bg-brand" />
            <h2 className="pixel text-[10px] text-ink">我也要提交项目</h2>
          </div>

          {/* 步骤指示器 */}
          <ol className="mono mt-3 flex items-center gap-2 text-[10px] text-muted">
            <li className={confirmedUser ? 'text-ink' : 'text-brand'}>
              {confirmedUser ? '✓' : '1'} fork 验证
            </li>
            <span className="h-[2px] w-6 bg-line" aria-hidden />
            <li className={confirmedUser ? 'text-brand' : 'text-smoke/50'}>
              {confirmedUser ? '2' : ''} 填写表单
            </li>
          </ol>

          <div className="mt-4">
            {confirmedUser ? (
              <SubmitForm confirmedUser={confirmedUser} onRestart={() => setConfirmedUser(null)} />
            ) : (
              <ForkGate
                username={username}
                onUsernameChange={setUsername}
                onConfirm={setConfirmedUser}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}