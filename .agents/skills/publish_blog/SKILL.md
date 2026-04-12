---
name: Publish Blog Post
description: Converts a local Markdown file into a styled HTML blog post page, registers it in the blog index, updates the blog listing, and commits + pushes to GitHub. Invoke by providing a markdown file path.
---

# Publish Blog Post

## Purpose

When the user provides a path to a local Markdown file, this skill:

1. Reads the Markdown and extracts (or asks for) metadata: title, description, tags, date
2. Runs the Python helper script to convert the Markdown → an HTML post page under `docs/posts/`
3. Updates `docs/js/blogs.json` with the post entry
4. Updates the listing in `docs/blog.html`
5. Commits and pushes to GitHub

## When to Invoke

Invoke this skill when the user says things like:
- "publish this blog post: `/path/to/post.md`"
- "convert this markdown to a blog post"
- "add this blog: `/path/to/file.md`"
- "@publish_blog `/path/to/my-post.md`"

## Instructions for the Agent

### Step 1 — Read the Markdown File

Use `view_file` to read the markdown at the provided path.

If the file starts with YAML front-matter (`---`), parse it to extract optional fields:
```yaml
---
title: "My Post Title"
description: "A short summary"
tags: genomics, AI, maize
date: 2026-03-02
---
```

If any required fields are missing from front-matter AND the user didn't provide them in their message, ask only for what is missing before proceeding:
- **`title`** (required) — the post heading
- **`description`** (required) — one-sentence summary shown in the listing card
- **`tags`** (optional, default empty) — comma-separated topics
- **`date`** (optional, default: today's date in `YYYY-MM-DD`)

### Step 2 — Run the Publisher Script

```bash
cd /Users/zhaijj/Documents/00PostDoc/Buckler_lab/GitHub/paper-notebook

python3 .agents/skills/publish_blog/scripts/publish_blog.py \
  --markdown "/ABSOLUTE/PATH/TO/post.md" \
  --title "The Post Title" \
  --description "One-sentence description" \
  --tags "tag1,tag2,tag3" \
  --date "YYYY-MM-DD" \
  --repo-root "/Users/zhaijj/Documents/00PostDoc/Buckler_lab/GitHub/paper-notebook"
```

The script will:
- Convert Markdown → HTML, saved to `docs/posts/{slug}.html`
- Append/update the entry in `docs/js/blogs.json`
- Update the blog listing in `docs/blog.html` between the `<!-- BLOG_POSTS_START -->` / `<!-- BLOG_POSTS_END -->` markers
- Regenerate the RSS feed at `docs/feed.xml`

### Step 3 — Commit and Push

```bash
cd /Users/zhaijj/Documents/00PostDoc/Buckler_lab/GitHub/paper-notebook

git add docs/posts/ docs/js/blogs.json docs/blog.html docs/feed.xml
git commit -m "feat: publish blog post — {title} ({date})"
git push
```

### Step 4 — Confirm to User

Report back:
- The slug/URL of the new post: `https://zhaijj.github.io/paper-notebook/posts/{slug}.html`
- Total blog posts now live
- The live site updates in ~1 minute after push

## Important Notes

- **Never delete existing posts.** The script deduplicates by slug; re-running with the same title updates the metadata without creating duplicates.
- **Post HTML lives at** `docs/posts/{slug}.html` — do not modify by hand; always re-run the script to regenerate.
- **`blogs.json` schema** for each entry:
  ```json
  {
    "slug": "my-post-title",
    "title": "My Post Title",
    "description": "One sentence.",
    "date": "2026-03-02",
    "tags": ["genomics", "AI"],
    "url": "posts/my-post-title.html"
  }
  ```
- The blog post CSS lives in `docs/css/blog.css`. No extra dependencies needed.
- Markdown support includes: headings, bold/italic, inline code, fenced code blocks, links, images, lists, blockquotes, and horizontal rules.
