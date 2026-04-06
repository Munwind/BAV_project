const POSITIVE_KEYWORDS = [
  'tang',
  'lai',
  'ky luc',
  'mo rong',
  'tich cuc',
  'binh thuong',
  'thuan loi',
  'tang truong',
  'cao ky luc',
]

const NEGATIVE_KEYWORDS = [
  'giam',
  'khoi to',
  'thiet hai',
  'no ',
  'bat thuong',
  'giai the',
  'rui ro',
  'ap luc',
  'nguy co',
  'dieu tra',
  'bo ngoai so sach',
  'khong hieu qua',
]

function stripVietnamese(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
}

function normalizeText(value = '') {
  return stripVietnamese(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function countOccurrences(haystack, needle) {
  if (!haystack || !needle) {
    return 0
  }

  let count = 0
  let start = 0
  let index = haystack.indexOf(needle, start)

  while (index !== -1) {
    count += 1
    start = index + needle.length
    index = haystack.indexOf(needle, start)
  }

  return count
}

function getSentimentSignal(text) {
  const normalized = normalizeText(text)
  const positiveHits = POSITIVE_KEYWORDS.filter((keyword) => normalized.includes(keyword)).length
  const negativeHits = NEGATIVE_KEYWORDS.filter((keyword) => normalized.includes(keyword)).length
  return positiveHits - negativeHits
}

module.exports = {
  normalizeText,
  countOccurrences,
  getSentimentSignal,
}
