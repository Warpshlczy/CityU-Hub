import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFrontmatterDocument } from '../src/lib/frontmatter.js';

const REQUIRED = {
  title: 'Demo',
  author: 'octo',
  authorName: 'Octo Cat',
  major: 'CS',
  enrollmentYear: '2024',
  repoUrl: 'https://github.com/octo/demo',
};

function doc(overrides = {}, body = '正文') {
  const fields = { ...REQUIRED, ...overrides };
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value}`);
  return `---\n${lines.join('\n')}\n---\n\n${body}\n`;
}

test('填满必填字段后套用默认值', () => {
  const { meta, body } = parseFrontmatterDocument(doc());
  assert.equal(meta.enrollmentYear, 2024);
  assert.equal(meta.category, 'other');
  assert.equal(meta.status, 'active');
  assert.equal(meta.featured, false);
  assert.equal(meta.homepageUrl, '');
  assert.deepEqual(meta.tags, []);
  assert.equal(body.trim(), '正文');
});

test('兼容 CRLF 换行', () => {
  const { meta } = parseFrontmatterDocument(doc().replace(/\n/g, '\r\n'));
  assert.equal(meta.title, 'Demo');
});

test('tags 去重、转小写，接受逗号分隔字符串', () => {
  assert.deepEqual(parseFrontmatterDocument(doc({ tags: '[React, react, NLP]' })).meta.tags, ['react', 'nlp']);
  assert.deepEqual(parseFrontmatterDocument(doc({ tags: 'a, B' })).meta.tags, ['a', 'b']);
});

test('缺少 front matter、必填字段或存在未知字段时报错', () => {
  assert.throws(() => parseFrontmatterDocument('没有 front matter'), /缺少 YAML front matter/);
  assert.throws(() => parseFrontmatterDocument(doc({ title: undefined })), /title 必须是非空字符串/);
  assert.throws(() => parseFrontmatterDocument(doc({ repoUrl: undefined })), /必须填写 repoUrl/);
  assert.throws(() => parseFrontmatterDocument(doc({ nickname: 'x' })), /未支持的字段：nickname/);
});

test('校验取值范围与类型', () => {
  assert.throws(() => parseFrontmatterDocument(doc({ enrollmentYear: 'abc' })), /enrollmentYear/);
  assert.throws(() => parseFrontmatterDocument(doc({ enrollmentYear: 2101 })), /enrollmentYear/);
  assert.throws(() => parseFrontmatterDocument(doc({ status: 'deleted' })), /status 只能是/);
  assert.throws(() => parseFrontmatterDocument(doc({ featured: 'yes' })), /featured 必须是布尔值/);
  assert.throws(() => parseFrontmatterDocument(doc({ repoUrl: 'ftp://github.com/a/b' })), /http\/https/);
  assert.throws(
    () => parseFrontmatterDocument(doc({ tags: `[${Array.from({ length: 13 }, (_, i) => `t${i}`).join(', ')}]` })),
    /最多 12 个/,
  );
  assert.throws(() => parseFrontmatterDocument(doc({ tags: `[${'x'.repeat(17)}]` })), /长度不能超过 16/);
});
