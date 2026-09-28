import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatNumber, formatRelativeTime } from '../src/utils/formatNumber.ts';
import { languageColor } from '../src/utils/language.ts';
import { slugify } from '../src/utils/slugify.ts';

test('formatNumber 在千和百万处缩写，并去掉多余的 .0', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(999), '999');
  assert.equal(formatNumber(1000), '1k');
  assert.equal(formatNumber(1234), '1.2k');
  assert.equal(formatNumber(1_000_000), '1M');
  assert.equal(formatNumber(2_560_000), '2.6M');
  assert.equal(formatNumber(Number.NaN), '0');
});

test('formatRelativeTime 按时间跨度选择单位', () => {
  const now = new Date('2026-06-30T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  assert.equal(formatRelativeTime(ago(10_000), now), '刚刚');
  assert.equal(formatRelativeTime(ago(5 * minute), now), '5分钟前');
  assert.equal(formatRelativeTime(ago(3 * hour), now), '3小时前');
  assert.equal(formatRelativeTime(ago(3 * day), now), '3天前');
  assert.equal(formatRelativeTime(ago(65 * day), now), '2个月前');
  assert.equal(formatRelativeTime(ago(800 * day), now), '2年前');
  assert.equal(formatRelativeTime('not a date', now), '未知');
});

test('slugify 保留中文并在结果为空时回退', () => {
  assert.equal(slugify('  Hello, 世界! '), 'hello-世界');
  assert.equal(slugify('***'), 'item');
});

test('languageColor 对未知语言使用兜底色', () => {
  assert.equal(languageColor('Python'), '#3572a5');
  assert.equal(languageColor('Brainfuck'), languageColor(''));
});
