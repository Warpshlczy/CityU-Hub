import { REPO_URL, REPO_NAME } from '../constants/repo';

// 项目一律提到 feature 分支，再由 feature-to-main 工作流合入 main
export const SUBMIT_BRANCH = 'feature';

// 预填内容走 query 传递，超过约 6KB 会 414 URI Too Long（完整模板编码后约 11KB），
// 所以只留字段骨架，字段含义让人去看仓库里的 repos/_template.md。
export const TEMPLATE_SKELETON = `---
# 字段含义与取值见仓库里的 repos/_template.md（简中 / 繁中 / English）
# 提交时请删掉这几行注释，注释不影响构建
title: My Project
author: your-github-name
authorName: 你的姓名
major: 你的专业
enrollmentYear: 2024
repoUrl: https://github.com/owner/repository
homepageUrl: ''
tags:
  - example
category: other
featured: false
status: active
---

在这里介绍你的项目：它解决什么问题、适合谁使用，以及最重要的功能。

## Features

- 功能一
- 功能二
`;

// 实测约 6000 字节的 query 可用，8000 起会失败
const MAX_PREFILL_URL = 6000;

export interface ProjectDraft {
  title: string;
  author: string;
  authorName: string;
  major: string;
  enrollmentYear: string;
  repoUrl: string;
  homepageUrl: string;
  category: string;
  tags: string;
  summary: string;
  intro: string;
  features: string;
}

// 生成合法的 repos/<name>.md 文件名；也是不填 id 时的默认 id
export function toRepoFileName(raw: string) {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5.-]+/g, '-')
    .replace(/[-.]{2,}/g, '-')
    .replace(/^[-.]+/, '')
    .slice(0, 80)
    .replace(/[-.]+$/, '');
  return cleaned || 'my-project';
}

// 无写权限时 GitHub 会自动 fork
export function buildNewFileUrl(fileName: string, content: string) {
  return `${REPO_URL}/new/${SUBMIT_BRANCH}?filename=${encodeURIComponent(fileName)}&value=${encodeURIComponent(content)}`;
}

// 在用户自己的 fork 上、feature 分支新建文件；配合 fork 引导流程使用
export function buildForkNewFileUrl(forkOwner: string, fileName: string, content: string) {
  const owner = forkOwner.trim();
  return `https://github.com/${owner}/${REPO_NAME}/new/${SUBMIT_BRANCH}?filename=${encodeURIComponent(fileName)}&value=${encodeURIComponent(content)}`;
}

// URL 过长 GitHub 会返回 414，超限就不跳转，改为提示用户精简
export function isUrlTooLong(url: string) {
  return url.length > MAX_PREFILL_URL;
}

// YAML 双引号标量：转义反斜杠与引号，免得标题里的 : # 破坏 front matter
function yamlString(value: string) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function parseDraftTags(raw: string) {
  return [
    ...new Set(
      raw
        .split(/[,，\s]+/)
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

// 拼成能直接过 repo.schema.json 校验的 Markdown
export function buildProjectMarkdown(draft: ProjectDraft) {
  const tags = parseDraftTags(draft.tags);
  const homepageUrl = draft.homepageUrl.trim();

  const front: string[] = [
    '---',
    `title: ${yamlString(draft.title.trim())}`,
    `author: ${yamlString(draft.author.trim())}`,
    `authorName: ${yamlString(draft.authorName.trim())}`,
    `major: ${yamlString(draft.major.trim())}`,
    `enrollmentYear: ${Number(draft.enrollmentYear)}`,
    `repoUrl: ${yamlString(draft.repoUrl.trim())}`,
    `homepageUrl: ${homepageUrl ? yamlString(homepageUrl) : "''"}`,
  ];
  if (draft.summary.trim()) front.push(`summary: ${yamlString(draft.summary.trim())}`);
  if (tags.length > 0) front.push(`tags: [${tags.map(yamlString).join(', ')}]`);
  if (draft.category.trim()) front.push(`category: ${yamlString(draft.category.trim())}`);
  front.push('featured: false', 'status: active', '---');

  const body: string[] = [draft.intro.trim()];
  const features = draft.features
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
  if (features.length > 0) {
    body.push('', '## Features', '', ...features.map((item) => `- ${item}`));
  }

  return `${front.join('\n')}\n\n${body.join('\n').trim()}\n`;
}
