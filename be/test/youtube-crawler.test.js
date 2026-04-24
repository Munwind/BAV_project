const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildYouTubeSearchUrl,
  filterEligibleYouTubeVideos,
  mergeYouTubeVideoStats,
  normalizeYouTubeCommentArticle,
} = require('../src/services/crawler-service')

test('buildYouTubeSearchUrl encodes query text for source roster links', () => {
  assert.equal(
    buildYouTubeSearchUrl('CafeF chứng khoán'),
    'https://www.youtube.com/results?search_query=CafeF%20ch%E1%BB%A9ng%20kho%C3%A1n',
  )
})

test('normalizeYouTubeCommentArticle maps comment thread into article-like payload', () => {
  const article = normalizeYouTubeCommentArticle(
    {
      key: 'youtube-cafef-stocks-comments',
      name: 'YouTube CafeF Chứng khoán comments',
      siteUrl: 'https://www.youtube.com',
      query: 'CafeF chứng khoán',
      category: 'video-comments',
    },
    {
      videoId: 'abc123',
      title: 'CafeF nói gì về cổ phiếu ngân hàng',
      channelId: 'channel-1',
      channelTitle: 'CafeF',
      publishedAt: '2026-04-17T08:00:00.000Z',
      thumbnailUrl: 'https://img.youtube.com/vi/abc123/hqdefault.jpg',
    },
    {
      id: 'thread-1',
      snippet: {
        totalReplyCount: 2,
        topLevelComment: {
          id: 'comment-1',
          snippet: {
            authorDisplayName: 'Investor A',
            textDisplay: 'VCB đang được nhắc khá nhiều trong video này.',
            publishedAt: '2026-04-17T09:00:00.000Z',
            likeCount: 5,
          },
        },
      },
    },
  )

  assert.equal(article.guid, 'youtube-comment:thread-1')
  assert.equal(article.title, '[YouTube] CafeF nói gì về cổ phiếu ngân hàng')
  assert.equal(article.descriptionText, 'VCB đang được nhắc khá nhiều trong video này.')
  assert.match(article.articleUrl, /watch\?v=abc123/)
  assert.equal(article.authorName, 'Investor A')
  assert.equal(article.rawItem.platform, 'youtube')
})

test('mergeYouTubeVideoStats attaches comment counts and status to videos', () => {
  const merged = mergeYouTubeVideoStats(
    [
      { videoId: 'abc', title: 'Video A', liveBroadcastContent: 'none' },
      { videoId: 'def', title: 'Video B', liveBroadcastContent: 'none' },
    ],
    [
      { id: 'abc', statistics: { commentCount: '7' }, status: { privacyStatus: 'public', embeddable: true } },
      { id: 'def', statistics: { commentCount: '0' }, status: { privacyStatus: 'public', embeddable: true } },
    ],
  )

  assert.equal(merged[0].commentCount, 7)
  assert.equal(merged[1].commentCount, 0)
  assert.equal(merged[0].privacyStatus, 'public')
})

test('filterEligibleYouTubeVideos keeps only public non-live videos with comments', () => {
  const filtered = filterEligibleYouTubeVideos([
    { videoId: 'ok-1', title: 'Eligible', commentCount: 5, privacyStatus: 'public', embeddable: true, liveBroadcastContent: 'none' },
    { videoId: 'skip-1', title: 'No comments', commentCount: 0, privacyStatus: 'public', embeddable: true, liveBroadcastContent: 'none' },
    { videoId: 'skip-2', title: 'Upcoming', commentCount: 10, privacyStatus: 'public', embeddable: true, liveBroadcastContent: 'upcoming' },
  ])

  assert.deepEqual(filtered.map((item) => item.videoId), ['ok-1'])
})
