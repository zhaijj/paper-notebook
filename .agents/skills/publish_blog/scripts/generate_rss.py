#!/usr/bin/env python3
"""
generate_rss.py — Generate an RSS 2.0 feed from docs/js/blogs.json.

Usage:
    python3 generate_rss.py --repo-root /path/to/paper-notebook

Can also be imported and called via generate_rss(repo_root).
"""

import argparse
import json
import os
import re
import html
from datetime import datetime


SITE_URL = "https://zhaijj.github.io/paper-notebook"
FEED_TITLE = "Jingjing's Blog"
FEED_DESCRIPTION = "Blog posts on plant genomics, DNA language models, evolution, and AI by Jingjing Zhai."
FEED_LANGUAGE = "en"
AUTHOR = "Jingjing Zhai"


def date_to_rfc822(date_str: str) -> str:
    """Convert YYYY-MM-DD to RFC 822 date format for RSS."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        # RFC 822: e.g. "Mon, 19 Mar 2026 00:00:00 +0000"
        return dt.strftime("%a, %d %b %Y 00:00:00 +0000")
    except ValueError:
        return ""


def escape_xml(text: str) -> str:
    """Escape text for XML/RSS content."""
    return html.escape(text, quote=True)


def generate_rss(repo_root: str) -> str:
    """Generate RSS 2.0 XML from blogs.json and write to docs/feed.xml."""
    docs = os.path.join(repo_root, "docs")
    blogs_json_path = os.path.join(docs, "js", "blogs.json")
    feed_path = os.path.join(docs, "feed.xml")

    # Read blogs
    if not os.path.exists(blogs_json_path):
        print("⚠️  blogs.json not found, skipping RSS generation.")
        return ""

    with open(blogs_json_path, "r", encoding="utf-8") as f:
        blogs = json.load(f)

    # Sort by date descending
    blogs_sorted = sorted(blogs, key=lambda b: b.get("date", ""), reverse=True)

    # Build RSS items
    items = []
    for b in blogs_sorted:
        title = escape_xml(b.get("title", ""))
        description = escape_xml(b.get("description", ""))
        link = f"{SITE_URL}/{b.get('url', '')}"
        pub_date = date_to_rfc822(b.get("date", ""))
        tags = b.get("tags", [])
        categories = "\n".join(
            f"      <category>{escape_xml(t)}</category>" for t in tags
        )
        guid = link

        items.append(f"""    <item>
      <title>{title}</title>
      <link>{link}</link>
      <description>{description}</description>
      <pubDate>{pub_date}</pubDate>
      <guid isPermaLink="true">{guid}</guid>
      <author>{escape_xml(AUTHOR)}</author>
{categories}
    </item>""")

    items_xml = "\n".join(items)
    now_rfc822 = datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S +0000")

    rss_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{escape_xml(FEED_TITLE)}</title>
    <link>{SITE_URL}/blog.html</link>
    <description>{escape_xml(FEED_DESCRIPTION)}</description>
    <language>{FEED_LANGUAGE}</language>
    <lastBuildDate>{now_rfc822}</lastBuildDate>
    <atom:link href="{SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
{items_xml}
  </channel>
</rss>
"""

    with open(feed_path, "w", encoding="utf-8") as f:
        f.write(rss_xml)

    print(f"✅ RSS feed written: {feed_path} ({len(blogs_sorted)} items)")
    return feed_path


def main():
    parser = argparse.ArgumentParser(description="Generate RSS feed from blogs.json")
    parser.add_argument(
        "--repo-root",
        required=True,
        help="Absolute path to the repo root",
    )
    args = parser.parse_args()
    generate_rss(args.repo_root)


if __name__ == "__main__":
    main()
