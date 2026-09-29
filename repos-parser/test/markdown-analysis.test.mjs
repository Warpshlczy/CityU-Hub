import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeReadme, fillProjectContent, toPlainText } from '../src/lib/markdown.js';

test('toPlainText 去掉行内标记、图片与代码块', () => {
  assert.equal(toPlainText('**粗** [链接](https://a.test) ![图](x.png) `c`\n```js\nx\n```'), '粗 链接 c');
});

test('analyzeReadme 取一级标题，摘要跳过徽章与图片行', () => {
  const result = analyzeReadme(
    [
      '# My Tool',
      '',
      '[![build](https://img.shields.io/x.svg)](https://ci.test)',
      '',
      '![logo](logo.png)',
      '',
      'A command line tool that renders markdown notes into slide decks quickly.',
      '',
      '## Install',
    ].join('\n'),
  );
  assert.equal(result.title, 'My Tool');
  assert.equal(result.summary, 'A command line tool that renders markdown notes into slide decks quickly.');
  assert.equal(result.hasBadges, true);
  assert.equal(result.firstImage?.url, 'logo.png');
  assert.deepEqual(result.headings.map((heading) => heading.text), ['My Tool', 'Install']);
});

test('analyzeReadme 没有一级标题时用 setext 标题，再用首行文本', () => {
  assert.equal(analyzeReadme('Setext Title\n=====\n\nbody').title, 'Setext Title');
  assert.equal(analyzeReadme('just some text without headings here').title, 'just some text without headings here');
});

test('analyzeReadme 对超长摘要在句末截断', () => {
  const sentence = 'This sentence is deliberately long enough to matter. ';
  const { summary } = analyzeReadme(sentence.repeat(10));
  assert.ok(summary.length <= 220);
  assert.match(summary, /\.$/);
});

test('fillProjectContent 只在介绍为空时补 README，Features 为空时补简介', () => {
  assert.equal(fillProjectContent('已有介绍', { readme: '# R' }), '已有介绍');
  assert.equal(fillProjectContent('', { readme: '# R' }), '# R');
  assert.equal(
    fillProjectContent('介绍\n\n## Features\n', { description: '简介' }),
    '介绍\n\n## Features\n\n简介',
  );
});
