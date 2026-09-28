import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hasQualifiers,
  parseQuery,
  removeQualifier,
  toQualifierChips,
} from '../src/utils/searchParser.ts';

test('parseQuery 拆出限定符与自由文本', () => {
  const { qualifiers, terms, freeText } = parseQuery('author:alice tag:NLP 情感 Lang:Python');
  assert.deepEqual(qualifiers, { author: ['alice'], tag: ['NLP'], lang: ['Python'], category: [] });
  assert.deepEqual(terms, ['情感']);
  assert.equal(freeText, '情感');
});

test('parseQuery 同一限定符可重复，完全相同的值只保留一次', () => {
  const { qualifiers } = parseQuery('tag:NLP tag:情感分析 tag:nlp');
  assert.deepEqual(qualifiers.tag, ['NLP', '情感分析']);
});

test('parseQuery 未知前缀按自由文本处理', () => {
  const { qualifiers, terms } = parseQuery('http://example.com foo:bar');
  assert.equal(hasQualifiers(qualifiers), false);
  assert.deepEqual(terms, ['http://example.com', 'foo:bar']);
});

test('parseQuery 忽略空值，并解码百分号编码', () => {
  assert.equal(hasQualifiers(parseQuery('tag:').qualifiers), false);
  assert.deepEqual(parseQuery('category:AI%2F%E6%9C%BA%E5%99%A8').qualifiers.category, ['AI/机器']);
  // 非法的百分号序列原样保留，而不是抛错
  assert.deepEqual(parseQuery('tag:100%').qualifiers.tag, ['100%']);
});

test('parseQuery 空查询', () => {
  assert.deepEqual(parseQuery('   '), {
    qualifiers: { author: [], tag: [], lang: [], category: [] },
    terms: [],
    freeText: '',
  });
});

test('removeQualifier 删除指定限定符或其中一个值', () => {
  assert.equal(removeQualifier('author:alice tag:a tag:b 关键词', 'tag', 'a'), 'author:alice tag:b 关键词');
  assert.equal(removeQualifier('author:alice tag:a tag:b', 'tag'), 'author:alice');
  assert.equal(removeQualifier('tag:A', 'tag', 'a'), '');
  assert.equal(removeQualifier('foo:bar', 'tag'), 'foo:bar');
});

test('toQualifierChips 按固定顺序输出 chip', () => {
  assert.deepEqual(toQualifierChips('lang:Rust tag:x author:bob'), [
    { key: 'author', value: 'bob' },
    { key: 'tag', value: 'x' },
    { key: 'lang', value: 'Rust' },
  ]);
});
