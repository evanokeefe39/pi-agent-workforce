# Apify Configuration for Social Media Research

## TikTok Profile Scraping

Actor: `clockworks/tiktok-profile-scraper`
Cost: $0.004/result

Input:
```json
{
  "profiles": ["username1", "username2"],
  "resultsPerPage": 30,
  "profileSorting": "latest",
  "downloadSubtitlesOptions": "DOWNLOAD_SUBTITLES",
  "shouldDownloadVideos": false
}
```

Enable `shouldDownloadVideos: true` when you need video analysis (stores MP4s
in KV store with publicly accessible URLs for NIM video_url analysis).

### REST API field flattening

When fetching dataset items via REST API, ALWAYS include the flatten parameter
for nested fields:

```
GET /datasets/{id}/items?fields=authorMeta.name,authorMeta.fans,...&flatten=authorMeta,videoMeta
```

Without `flatten`, nested fields like `authorMeta.name` will be missing from
the response. This is a common bug.

### Key fields to request

```
authorMeta.name, authorMeta.fans, authorMeta.video, authorMeta.heart,
authorMeta.createTime, createTimeISO, playCount, diggCount, shareCount,
collectCount, commentCount, videoMeta.duration, videoMeta.coverUrl,
videoMeta.downloadAddr, webVideoUrl, text, hashtags
```

## TikTok Hashtag Scraping

Actor: `clockworks/tiktok-scraper`

Input:
```json
{
  "hashtags": ["#claudecode", "#vibecoding", "#aiautomation"],
  "resultsPerPage": 50
}
```

## Video Analysis Pipeline

1. Scrape with `shouldDownloadVideos: true`
2. Videos stored in run's KV store
3. URL format: `https://api.apify.com/v2/key-value-stores/{id}/records/{key}.mp4`
4. These URLs work with NIM video analysis (`video_url` content type)
5. NIM model: `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`
6. Rate limit: 40 RPM (upgradable to 200 RPM free via NVIDIA Developer Forums)

## Subtitle/Transcript Access

When `downloadSubtitlesOptions: "DOWNLOAD_SUBTITLES"` is set:
- VTT files stored in run's KV store
- Key format: `subtitle-{account}-{YYYYMMDDHHMMSS}-{videoId}-{lang}.vtt`
- Parse VTT: strip timestamps and markup, merge cues into clean text

## Cost Estimates

| Operation | Cost per item |
|-----------|--------------|
| Profile scrape (1 post) | $0.004 |
| Hashtag scrape (1 post) | ~$0.004 |
| Transcript add-on | $0.041/started minute |
| Video download | included in scrape cost |
