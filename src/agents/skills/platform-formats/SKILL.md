---
name: platform-formats
description: >
  Platform dimension specs, file format constraints, safe zones, content limits,
  and render brief schema for social media content rendering and publishing.
  Used by Publisher (output validation), Coder (canvas setup and export), and
  Planner (task decomposition by platform).
metadata:
  author: evan
  version: 1.0.0
  domain: social-media
---

# Platform Formats — Dimensions, Constraints, and Render Briefs

Canonical reference for platform-specific content specifications. All dimension,
file size, and content limit values are current as of June 2026. When platforms
update specs, update this document — agents must not hardcode these values.

## Platform Dimension Table

All dimensions in pixels. Width x Height.

| Platform | Format | Width | Height | Aspect Ratio | Notes |
|----------|--------|-------|--------|--------------|-------|
| Instagram | Feed Post | 1080 | 1080 | 1:1 | Square. Most versatile — works in feed, grid, and explore. |
| Instagram | Carousel | 1080 | 1350 | 4:5 | Portrait. Higher engagement than 1:1. All slides must be same dimensions. |
| Instagram | Story / Reel | 1080 | 1920 | 9:16 | Full-screen vertical. 15-90s for Stories, up to 90s for Reels. |
| TikTok | Video | 1080 | 1920 | 9:16 | Full-screen vertical. Up to 10 min. |
| TikTok | Cover Image | 1080 | 1920 | 9:16 | Static frame shown on profile grid. Must work as standalone image. |
| LinkedIn | Post Image | 1200 | 627 | 1.91:1 | Landscape. Renders in feed at ~552px height. |
| Twitter/X | Post Image | 1600 | 900 | 16:9 | Landscape. Cropped to ~800x418 in timeline; full size on click. |

### Resolution Notes

- All dimensions are at 1x. For Retina/HiDPI, render at 2x (2160x2160 for Instagram
  Feed Post) and export at target dimensions — this prevents subpixel aliasing on text.
- DPI setting in export is irrelevant for screen content. Pixel dimensions are what matter.

## File Format Constraints

| Format | Use When | Max File Size | Notes |
|--------|----------|---------------|-------|
| PNG | Graphics, text overlays, charts, screenshots | 8MB (Instagram), 20MB (general) | Lossless. Required when text readability matters. Use PNG-8 for simple graphics with few colors. |
| JPG | Photographs, complex images without text | 8MB (Instagram), 20MB (general) | Lossy. Quality 85-92 for web. Never use for text-heavy content — compression artifacts on edges. |
| MP4 | Video content | 287MB (TikTok), 250MB (Instagram Reels), 512MB (LinkedIn) | H.264 codec, AAC audio. 30fps minimum, 60fps preferred for motion graphics. |
| WebP | Not recommended | Varies | Inconsistent platform support. Convert to PNG/JPG before upload. |

### Instagram-Specific

- Image: PNG or JPG, max 8MB per image
- Carousel: all slides same format (do not mix PNG and JPG within a carousel)
- Video: MP4, H.264, max 250MB, 3-90 seconds, minimum 720p
- Thumbnail: auto-generated from first frame; no custom thumbnail for Reels

### TikTok-Specific

- Video: MP4, max 287MB, up to 10 minutes
- Cover: selected from video frame or uploaded as separate image (1080x1920 PNG/JPG)
- Minimum resolution: 720x1280

### LinkedIn-Specific

- Image: PNG or JPG, max 10MB per image
- Video: MP4, max 512MB, 3 seconds to 10 minutes
- PDF carousel: up to 300 pages, max 100MB (used as document posts)

### Twitter/X-Specific

- Image: PNG or JPG, max 5MB (PNG), 5MB (JPG), max 4 images per tweet
- GIF: max 15MB, recommended under 5MB for fast loading
- Video: MP4, max 512MB, 0.5s to 140s

## Safe Zone Specifications

Platform UI overlays (status bar, usernames, engagement buttons) obscure portions of
the canvas. Keep critical content (text, key visuals, data) within the safe zone.

### 9:16 Vertical (1080x1920) — Instagram Story/Reel, TikTok

```
+---------------------------+
|     STATUS BAR / CLOCK    |  Top 15% (0-288px): UNSAFE
|       platform header     |  Overlaid by device status bar, platform
|                           |  username, and follow button.
+---------------------------+
|                           |
|                           |
|       SAFE ZONE           |  Middle 65% (288-1536px): SAFE
|    (288px - 1536px)       |  All critical content here.
|                           |
|                           |
+---------------------------+
|    ENGAGEMENT BUTTONS     |  Bottom 20% (1536-1920px): UNSAFE
|   like/comment/share/     |  Overlaid by like, comment, share, and
|   save + caption overlay  |  save buttons. Caption text also renders
|                           |  in this zone on TikTok.
+---------------------------+
```

- **Safe zone**: x=54 to x=1026, y=288 to y=1536 (972px wide, 1248px tall)
- Left/right 5% (54px each side) is partially obscured by rounded corners on some devices
- TikTok right edge has a vertical button column — keep text 120px from right edge

### 1:1 Square (1080x1080) — Instagram Feed Post

```
+---------------------------+
|                           |
|     SAFE ZONE             |  Full canvas is generally safe.
|   (54px - 1026px each     |  Inset 54px (5%) from each edge for
|    direction)             |  visual breathing room and device
|                           |  edge clipping.
+---------------------------+
```

- **Safe zone**: 54px inset on all sides (972px x 972px usable)
- No platform overlay in feed view, but grid view crops to center square

### 4:5 Portrait (1080x1350) — Instagram Carousel

```
+---------------------------+
|                           |  Top 5% (0-68px): buffer zone
+---------------------------+
|                           |
|       SAFE ZONE           |  Middle 90% (68-1282px): SAFE
|    (68px - 1282px)        |
|                           |
+---------------------------+
|   slide indicator dots    |  Bottom 5% (1282-1350px): buffer zone
+---------------------------+
```

- **Safe zone**: 54px from left/right, 68px from top/bottom (972px x 1214px usable)
- Bottom edge shows carousel position dots — keep text above 1282px

### 1.91:1 Landscape (1200x627) — LinkedIn

- **Safe zone**: 60px inset on all sides (1080px x 507px usable)
- LinkedIn crops to center when displayed in some feed contexts

### 16:9 Landscape (1600x900) — Twitter/X

- **Safe zone**: 80px inset on all sides (1440px x 740px usable)
- Timeline crops to approximately 2:1 — center-weighted. Critical content must be in
  center 1600x800 zone to survive timeline crop.

## Content Limits

### Instagram

| Constraint | Limit | Notes |
|------------|-------|-------|
| Carousel slides | 2-20 | All slides same dimensions and format. First slide is the hook. |
| Caption length | 2,200 characters | First 125 chars visible before "more" tap. Lead with the insight. |
| Hashtags | 5 | Current best practice. 3-5 targeted hashtags. More reduces reach. |
| Mentions | 20 per post | Avoid mass-mentioning — triggers spam filters. |
| Alt text | 100 characters | Always provide. Improves accessibility and SEO. |

### TikTok

| Constraint | Limit | Notes |
|------------|-------|-------|
| Caption length | 4,000 characters | First ~80 chars visible without expansion. |
| Hashtags | 3-5 | Fewer, more targeted. Platform uses content signals over hashtags. |
| Video length | Up to 10 minutes | Sweet spot for AI/tech niche: 60-90 seconds. |
| Sounds | 1 per video | Original sound or licensed track. |

### LinkedIn

| Constraint | Limit | Notes |
|------------|-------|-------|
| Post text | 3,000 characters | First ~210 chars visible before "see more." |
| Hashtags | 3-5 | LinkedIn algorithm weights hashtags less than content relevance. |
| Images per post | 20 | Multi-image posts get carousel treatment. |
| Document pages | 300 | PDF carousel. 5-15 slides is the engagement sweet spot. |

### Twitter/X

| Constraint | Limit | Notes |
|------------|-------|-------|
| Tweet text | 280 characters (free), 25,000 (premium) | Design for 280. |
| Images per tweet | 4 | Grid layout: 1=full, 2=side-by-side, 3=1+2, 4=2x2. |
| Hashtags | 1-2 | Twitter penalizes hashtag-heavy tweets. |
| Thread length | No hard limit | 5-10 tweets is the practical engagement window. |

## Render Brief Schema

The render brief is the contract between Publisher (who specifies what to create) and
Coder (who renders it). Every render request must include all required fields. Coder
must reject briefs with missing required fields.

```typescript
interface RenderBrief {
  /** Content format. Determines canvas setup and export behavior. */
  type: "carousel" | "static" | "video-cover";

  /** Target platform. Determines dimensions, safe zones, and export constraints. */
  platform: "instagram" | "tiktok" | "linkedin" | "twitter";

  /**
   * Canvas dimensions in pixels. Must match the platform dimension table.
   * Coder validates these against the platform — rejects mismatches.
   */
  dimensions: {
    width: number;
    height: number;
  };

  /**
   * Slide definitions for carousel type. Required when type is "carousel".
   * Must contain 2-20 entries for Instagram.
   * Each slide specifies its content and layout template.
   */
  slides?: Array<{
    /** Text content for this slide. Markdown-like: **bold**, `code`, etc. */
    content: string;
    /**
     * Layout template name. Standard layouts:
     * - "title"       — centered heading + subtitle
     * - "stat-hero"   — large number + label + optional context line
     * - "two-column"  — left/right split, text or stat in each column
     * - "bullet-list" — heading + 3-6 bullet points
     * - "comparison"  — side-by-side with vs. divider
     * - "quote"       — large quote text + attribution
     * - "cta"         — call to action with heading + subtitle + action text
     */
    layout: "title" | "stat-hero" | "two-column" | "bullet-list" | "comparison" | "quote" | "cta";
  }>;

  /**
   * Brand profile to apply. References brand-guidelines skill.
   * "default" applies the standard dark theme palette, typography, and spacing.
   */
  brand: "default";

  /** Export format. PNG for text/graphics, JPG for photographic content. */
  outputFormat: "png" | "jpg";
}
```

### Validation Rules

Coder must validate every render brief before beginning work:

1. `dimensions` must match an entry in the platform dimension table for the given
   `platform`. If `platform` is "instagram" and `type` is "carousel", dimensions
   must be 1080x1350. Reject mismatches with an error naming the expected dimensions.
2. `slides` is required when `type` is "carousel" and forbidden when `type` is "static"
   or "video-cover".
3. Carousel `slides` array length must be 2-20 for Instagram, no platform limit for
   LinkedIn document posts.
4. Each slide `layout` must be one of the defined layout template names.
5. `outputFormat` must be "png" for any content containing text. "jpg" is only valid
   when the content is purely photographic.

### Platform-to-Dimension Mapping

Quick lookup for brief construction. Use these exact values.

```typescript
const PLATFORM_DIMENSIONS: Record<string, Record<string, { width: number; height: number }>> = {
  instagram: {
    "feed-post":  { width: 1080, height: 1080 },
    "carousel":   { width: 1080, height: 1350 },
    "story":      { width: 1080, height: 1920 },
    "reel":       { width: 1080, height: 1920 },
  },
  tiktok: {
    "video":      { width: 1080, height: 1920 },
    "cover":      { width: 1080, height: 1920 },
  },
  linkedin: {
    "post-image": { width: 1200, height: 627 },
  },
  twitter: {
    "post-image": { width: 1600, height: 900 },
  },
};
```
