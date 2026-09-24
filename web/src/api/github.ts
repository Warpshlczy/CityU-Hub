import type { Project } from '../types';
import { REPO_OWNER, REPO_NAME } from '../constants/repo';

/** 从 GitHub 仓库接口补齐的字段 */
interface GithubRepoMeta {
  language: string;
  stars: number;
  forks: number;
  /** 仓库所有者的头像（与解析器产出的 authorAvatar 取法一致） */
  avatar: string;
  /** 仓库 About，用于卡片与详情页的简介 */
  description: string;
}

/** 缓存键带版本号，字段有增减时自动失效旧缓存 */
const CACHE_KEY = 'cityu-hub:github-meta:v3';
/** 缓存 1 小时：star 数按小时刷新，同时避开 GitHub 匿名接口的 60 次/小时限流 */
const CACHE_TTL = 60 * 60 * 1000;
/** 单次最多补这么多仓库，其余等下次访问 */
const MAX_REQUESTS = 20;
const CONCURRENCY = 4;

type MetaCache = Record<string, { meta: GithubRepoMeta; at: number }>;

function readCache(): MetaCache {
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? '{}') as MetaCache;
  } catch {
    return {};
  }
}

function writeCache(cache: MetaCache) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // 隐私模式 / 存储配额不足时忽略
  }
}

/** 取出 owner/repo，取不到返回 null */
function repoSlug(project: Project): string | null {
  if (project.repo && /^[^/\s]+\/[^/\s]+$/.test(project.repo)) {
    return project.repo.replace(/\.git$/, '');
  }
  const match = /github\.com\/([^/?#]+)\/([^/?#]+)/i.exec(project.githubUrl ?? '');
  if (!match) return null;
  return `${match[1]}/${match[2].replace(/\.git$/, '')}`;
}

async function fetchRepoMeta(slug: string, signal?: AbortSignal): Promise<GithubRepoMeta | null> {
  const res = await fetch(`https://api.github.com/repos/${slug}`, {
    signal,
    headers: { accept: 'application/vnd.github+json' },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    language?: string | null;
    stargazers_count?: number;
    forks_count?: number;
    description?: string | null;
    owner?: { avatar_url?: string };
  };
  return {
    language: data.language ?? '',
    stars: data.stargazers_count ?? 0,
    forks: data.forks_count ?? 0,
    avatar: data.owner?.avatar_url ?? '',
    description: data.description ?? '',
  };
}

/**
 * 用 GitHub 仓库接口补齐语言与 stars，结果写入 localStorage 缓存。
 * 缓存超过 1 小时就重新拉一次，star 数因此按小时保持新鲜；
 * 失败（限流 / 断网 / 404）时返回 null，调用方保持原数据不变。
 *
 * ponytail: 刷新挂在页面访问上，没人访问就不刷新；要「无访问也准时」得改成服务端定时任务。
 */
export async function enrichProjectsWithGithub(
  projects: Project[],
  signal?: AbortSignal,
): Promise<Project[] | null> {
  try {
    const cache = readCache();
    const now = Date.now();
    const queue: Array<{ slug: string }> = [];
    const metas = new Map<string, GithubRepoMeta>();

    for (const project of projects) {
      const slug = repoSlug(project);
      if (!slug) continue;

      const cached = cache[slug];
      if (cached && now - cached.at < CACHE_TTL) {
        metas.set(slug, cached.meta);
        continue;
      }
      // 后端已经补齐过也照样重拉：star 数要按小时更新，不能一直用构建时的值
      if (queue.length >= MAX_REQUESTS || queue.some((item) => item.slug === slug)) continue;
      queue.push({ slug });
    }

    let stopped = false;
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length && !stopped) {
        const current = queue[cursor];
        cursor += 1;
        try {
          const meta = await fetchRepoMeta(current.slug, signal);
          if (!meta) continue;
          metas.set(current.slug, meta);
          cache[current.slug] = { meta, at: Date.now() };
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          // 命中限流或网络异常，本轮不再继续请求
          stopped = true;
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, Math.max(1, queue.length)) }, worker),
    );

    if (queue.length > 0) writeCache(cache);
    if (metas.size === 0) return null;

    let changed = false;
    const merged = projects.map((project) => {
      const slug = repoSlug(project);
      const meta = slug ? metas.get(slug) : undefined;
      if (!meta) return project;
      const language = project.language || meta.language;
      const stars = meta.stars || project.stars;
      const forks = meta.forks || project.forks;
      const authorAvatar = project.authorAvatar || meta.avatar;
      const about = project.about || meta.description;
      if (
        language === project.language &&
        stars === project.stars &&
        forks === project.forks &&
        authorAvatar === project.authorAvatar &&
        about === project.about
      ) {
        return project;
      }
      changed = true;
      return { ...project, language, stars, forks, authorAvatar, about };
    });

    return changed ? merged : null;
  } catch {
    return null;
  }
}

export type ForkCheckStatus = 'has-fork' | 'no-fork' | 'error';

interface ForkInList {
  owner?: { login?: string };
}

/**
 * 按 GitHub 用户名查公开 API，判断该用户是否 fork 过本站仓库。
 * 纯前端没有登录态，只能靠表单里填写的用户名来比对，GitHub 公开接口无需 token。
 * 返回 'has-fork' / 'no-fork'；接口失败或限流时返回 'error' 交给调用方降级处理。
 */
export async function checkUserFork(username: string): Promise<ForkCheckStatus> {
  const user = username.trim();
  if (!user || !REPO_OWNER || !REPO_NAME) return 'no-fork';

  // 最多翻几页，避免 fork 数量大时请求过多；公开接口匿名限流每小时 60 次
  const MAX_PAGES = 3;
  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const res = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/forks?per_page=100&page=${page}&sort=newest`,
        { headers: { accept: 'application/vnd.github+json' } },
      );
      if (!res.ok) return 'error';
      const forks = (await res.json()) as ForkInList[];
      if (forks.some((fork) => fork.owner?.login?.toLowerCase() === user.toLowerCase())) {
        return 'has-fork';
      }
      // 一页不满说明没有更多了
      if (forks.length < 100) return 'no-fork';
    }
    return 'no-fork';
  } catch {
    return 'error';
  }
}
