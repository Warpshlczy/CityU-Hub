import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRepoUrl } from '../src/lib/github.js';

const base = { owner: 'octo', repo: 'hello', repoUrl: 'https://github.com/octo/hello' };

test('parseRepoUrl 识别常见写法', () => {
  for (const input of [
    'https://github.com/octo/hello',
    'https://www.github.com/octo/hello/',
    'http://github.com/octo/hello.git',
    'https://github.com/octo/hello?tab=readme#top',
    'git@github.com:octo/hello.git',
    'github.com/octo/hello',
    'octo/hello',
  ]) {
    assert.deepEqual(parseRepoUrl(input), { ...base, ref: null, subPath: '' }, input);
  }
});

test('parseRepoUrl 解析 tree/blob 的分支与子路径', () => {
  assert.deepEqual(parseRepoUrl('https://github.com/octo/hello/tree/dev/src/lib'), {
    ...base,
    ref: 'dev',
    subPath: 'src/lib',
  });
});

test('parseRepoUrl 拒绝非 GitHub 与残缺地址', () => {
  for (const input of [
    'https://gitlab.com/octo/hello',
    'git@gitlab.com:octo/hello.git',
    'https://github.com/octo',
    'https://github.com/',
    'https://github.com/-bad/hello',
    'octo/hello/extra',
    '',
    '   ',
    null,
    undefined,
    42,
  ]) {
    assert.equal(parseRepoUrl(input), null, String(input));
  }
});

test('parseRepoUrl 拒绝超长输入', () => {
  assert.equal(parseRepoUrl(`https://github.com/octo/${'a'.repeat(2100)}`), null);
});
