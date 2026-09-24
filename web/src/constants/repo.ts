// 本站仓库地址；换仓库只改这里
export const REPO_URL = 'https://github.com/Warpshlczy/CityU-Hub';

// 从 REPO_URL 拆出 owner 与仓库名，供 fork 检测 / fork 链接等逻辑复用
export const REPO_OWNER = REPO_URL.match(/github\.com\/([^/?#]+)\/([^/?#]+)/i)?.[1] ?? '';
export const REPO_NAME = REPO_URL.match(/github\.com\/([^/?#]+)\/([^/?#]+)/i)?.[2] ?? '';
