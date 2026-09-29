import assert from 'node:assert/strict';
import { test } from 'node:test';
import { slugify, uniqueId } from '../src/lib/slug.js';

test('slugify 保留英文数字与中文，其余转连字符', () => {
  assert.equal(slugify('Octo/Hello_World'), 'octo-hello-world');
  assert.equal(slugify("It's  a  demo!"), 'its-a-demo');
  assert.equal(slugify('城大 Hub'), '城大-hub');
  assert.equal(slugify('v1.2.3'), 'v1.2.3');
});

test('slugify 结果为空时用稳定的哈希兜底', () => {
  const first = slugify('!!!');
  assert.match(first, /^project-[0-9a-f]{8}$/);
  assert.equal(slugify('!!!'), first);
  assert.notEqual(slugify('???'), first);
});

test('slugify 限制长度且不以分隔符结尾', () => {
  const slug = slugify(`${'a'.repeat(59)}-bbbb`, { maxLength: 60 });
  assert.ok(slug.length <= 60);
  assert.doesNotMatch(slug, /[-.]$/);
});

test('uniqueId 在冲突时追加序号', () => {
  assert.equal(uniqueId('foo', ['bar']), 'foo');
  assert.equal(uniqueId('foo', new Set(['foo', 'foo-2'])), 'foo-3');
});
