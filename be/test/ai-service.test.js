const test = require('node:test')
const assert = require('node:assert/strict')

const { classifyInteractionMode } = require('../src/services/ai-service')

test('classifyInteractionMode marks greetings as smalltalk', () => {
  assert.equal(classifyInteractionMode('xin chao'), 'smalltalk')
  assert.equal(classifyInteractionMode('xin chào'), 'smalltalk')
  assert.equal(classifyInteractionMode('chao ban'), 'smalltalk')
  assert.equal(classifyInteractionMode('cam on nhe'), 'smalltalk')
})

test('classifyInteractionMode keeps market questions in analysis mode', () => {
  assert.equal(classifyInteractionMode('Hien tai dang co nhung tin tuc gi quan trong?'), 'analysis')
  assert.equal(classifyInteractionMode('Tom tat sentiment cua Traphaco hom nay'), 'analysis')
})
