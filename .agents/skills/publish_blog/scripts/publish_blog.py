#!/usr/bin/env python3
"""
publish_blog.py — Convert a Markdown blog post to a styled HTML page
and register it in docs/js/blogs.json.

Usage:
    python3 publish_blog.py \
        --markdown /path/to/post.md \
        --title "My Post Title" \
        --description "One-sentence summary" \
        --tags "genomics,AI" \
        --date "2026-03-02" \
        --repo-root /path/to/paper-notebook
"""

import argparse
import json
import os
import re
import sys
from datetime import date


# ---------------------------------------------------------------------------
# Minimal Markdown → HTML converter (no external deps)
# ---------------------------------------------------------------------------

def parse_table_row(row: str) -> list:
    """Split a markdown table row into cell strings."""
    # Strip leading/trailing | and whitespace, then split on |
    row = row.strip()
    if row.startswith('|'):
        row = row[1:]
    if row.endswith('|'):
        row = row[:-1]
    return [cell.strip() for cell in row.split('|')]


def is_table_separator(row: str) -> bool:
    """Return True if the row is a markdown table separator (e.g. |---|---|)."""
    return bool(re.match(r'^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$', row.strip()))


def md_to_html(md: str) -> str:
    """Convert a subset of Markdown to HTML."""
    lines = md.split('\n')
    html_lines = []
    in_code = False
    in_ul = False
    in_ol = False
    in_blockquote = False

    def close_list():
        nonlocal in_ul, in_ol
        if in_ul:
            html_lines.append('</ul>')
            in_ul = False
        if in_ol:
            html_lines.append('</ol>')
            in_ol = False

    def close_blockquote():
        nonlocal in_blockquote
        if in_blockquote:
            html_lines.append('</blockquote>')
            in_blockquote = False

    def inline(text: str) -> str:
        """Handle inline formatting."""
        # Code spans
        text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
        # Bold + italic
        text = re.sub(r'\*\*\*(.+?)\*\*\*', r'<strong><em>\1</em></strong>', text)
        # Bold
        text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
        # Italic
        text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
        # Links
        text = re.sub(r'\[([^\]]+)\]\(([^\)]+)\)', r'<a href="\2" target="_blank" rel="noopener">\1</a>', text)
        # Images
        text = re.sub(r'!\[([^\]]*)\]\(([^\)]+)\)', r'<img src="\2" alt="\1" style="max-width:100%;border-radius:8px;margin:1rem 0;">', text)
        return text

    i = 0
    while i < len(lines):
        line = lines[i]

        # Fenced code blocks
        if line.startswith('```'):
            if in_code:
                html_lines.append('</code></pre>')
                in_code = False
            else:
                close_list()
                close_blockquote()
                lang = line[3:].strip()
                lang_class = f' class="language-{lang}"' if lang else ''
                html_lines.append(f'<pre><code{lang_class}>')
                in_code = True
            i += 1
            continue

        if in_code:
            # Escape HTML inside code blocks
            escaped = line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            html_lines.append(escaped)
            i += 1
            continue

        # Headings
        m = re.match(r'^(#{1,6})\s+(.*)', line)
        if m:
            close_list()
            close_blockquote()
            level = len(m.group(1))
            text = inline(m.group(2))
            slug = slugify_heading(m.group(2))
            html_lines.append(f'<h{level} id="{slug}">{text}</h{level}>')
            i += 1
            continue

        # Horizontal rule
        if re.match(r'^[-*_]{3,}$', line.strip()):
            close_list()
            close_blockquote()
            html_lines.append('<hr>')
            i += 1
            continue

        # Blockquote
        if line.startswith('> '):
            close_list()
            if not in_blockquote:
                html_lines.append('<blockquote>')
                in_blockquote = True
            html_lines.append(f'<p>{inline(line[2:])}</p>')
            i += 1
            continue
        else:
            close_blockquote()

        # Unordered list
        m = re.match(r'^[-*+]\s+(.*)', line)
        if m:
            if not in_ul:
                close_list()
                html_lines.append('<ul>')
                in_ul = True
            html_lines.append(f'<li>{inline(m.group(1))}</li>')
            i += 1
            continue

        # Ordered list
        m = re.match(r'^\d+\.\s+(.*)', line)
        if m:
            if not in_ol:
                close_list()
                html_lines.append('<ol>')
                in_ol = True
            html_lines.append(f'<li>{inline(m.group(1))}</li>')
            i += 1
            continue

        close_list()

        # Markdown table: collect all consecutive table lines
        if line.startswith('|') or (line.strip() and re.match(r'^\|', line)):
            # Gather consecutive table lines
            table_lines = []
            j = i
            while j < len(lines) and (lines[j].startswith('|') or (lines[j].strip().startswith('|'))):
                table_lines.append(lines[j])
                j += 1
            if len(table_lines) >= 2:
                close_blockquote()
                html_lines.append('<table>')
                header_done = False
                body_open = False
                for tl in table_lines:
                    if is_table_separator(tl):
                        if not header_done:
                            html_lines.append('</thead>')
                            html_lines.append('<tbody>')
                            header_done = True
                            body_open = True
                        continue
                    cells = parse_table_row(tl)
                    if not header_done:
                        html_lines.append('<thead><tr>')
                        for cell in cells:
                            html_lines.append(f'  <th>{inline(cell)}</th>')
                        html_lines.append('</tr>')
                    else:
                        html_lines.append('<tr>')
                        for cell in cells:
                            html_lines.append(f'  <td>{inline(cell)}</td>')
                        html_lines.append('</tr>')
                if body_open:
                    html_lines.append('</tbody>')
                elif not header_done:
                    html_lines.append('</thead>')
                html_lines.append('</table>')
                i = j
                continue

        # Empty line
        if line.strip() == '':
            html_lines.append('')
            i += 1
            continue

        # Plain paragraph
        html_lines.append(f'<p>{inline(line)}</p>')
        i += 1

    close_list()
    close_blockquote()
    if in_code:
        html_lines.append('</code></pre>')

    return '\n'.join(html_lines)


# ---------------------------------------------------------------------------
# HTML template
# ---------------------------------------------------------------------------

POST_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en" data-theme="light">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} | Jingjing's Paper Notebook</title>
  <meta name="description" content="{description}" />
  <link rel="stylesheet" href="../css/style.css" />
  <link rel="stylesheet" href="../css/blog.css" />
  <link rel="icon"
    href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✍️</text></svg>" />
  <script>
    (function () {{ var t = localStorage.getItem('pn-theme') || 'light'; document.documentElement.setAttribute('data-theme', t); }})();
  </script>
  <script defer src="https://cloud.umami.is/script.js" data-website-id="b220f945-a9de-4c7d-89d8-818713c63ea1"></script>
</head>

<body>

  <!-- NAVBAR -->
  <nav class="navbar">
    <div class="container navbar-inner">
      <a href="../index.html" class="logo">
        <div class="logo-icon">📚</div>
        <div>
          <span class="logo-text">Paper Notebook</span>
          <span class="logo-sub">Jingjing Zhai</span>
        </div>
      </a>
      <ul class="nav-links">
        <li><a href="../index.html">Home</a></li>
        <li><a href="../blog.html" class="nav-active">Blog</a></li>
        <li><a href="https://github.com/zhaijj/paper-notebook" target="_blank">GitHub</a></li>
        <li>
          <button id="theme-toggle" class="theme-toggle" aria-label="Switch to dark mode">
            <span class="toggle-icon">🌙</span>
            <span class="toggle-label">Dark</span>
          </button>
        </li>
      </ul>
    </div>
  </nav>

  <!-- POST HERO -->
  <header class="hero">
    <div class="container">
      <a href="../blog.html" class="back-link" style="display:inline-flex;align-items:center;gap:6px;margin-bottom:1.5rem;font-size:0.875rem;color:var(--accent);text-decoration:none;">
        ← All Posts
      </a>
      <div class="hero-eyebrow">{tags_display}</div>
      <h1>{title}</h1>
      <p>{description}</p>
      <div style="margin-top:1rem;font-size:0.875rem;color:var(--text-dim);">
        {date} · by Jingjing Zhai
      </div>
    </div>
  </header>

  <main>
    <div class="container">
      <article class="blog-post-content">
        {content_html}
      </article>

      <!-- REACTION BAR -->
      <div class="reaction-bar" id="reaction-bar" data-slug="{slug}">
        <span class="reaction-label">Was this useful?</span>
        <div class="reaction-buttons">
          <button class="reaction-btn" data-emoji="👍" title="Helpful">👍 <span class="reaction-count"></span></button>
          <button class="reaction-btn" data-emoji="❤️" title="Love it">❤️ <span class="reaction-count"></span></button>
          <button class="reaction-btn" data-emoji="🌱" title="Interesting">🌱 <span class="reaction-count"></span></button>
          <button class="reaction-btn" data-emoji="🤯" title="Mind-blowing">🤯 <span class="reaction-count"></span></button>
        </div>
      </div>

      <!-- COMMENTS (Giscus) -->
      <div class="comments-section">
        <h3 class="comments-title">💬 Discussion</h3>
        <script src="https://giscus.app/client.js"
          data-repo="zhaijj/paper-notebook"
          data-repo-id="R_kgDONi0ydQ"
          data-category="General"
          data-category-id="DIC_kwDONi0ydc4CsO9k"
          data-mapping="pathname"
          data-strict="0"
          data-reactions-enabled="0"
          data-emit-metadata="0"
          data-input-position="top"
          data-theme="preferred_color_scheme"
          data-lang="en"
          data-loading="lazy"
          crossorigin="anonymous"
          async>
        </script>
      </div>
    </div>
  </main>

  <!-- FOOTER -->
  <footer class="footer">
    <div class="container">
      <p>
        Maintained by <a href="https://github.com/zhaijj" target="_blank">Jingjing Zhai</a> ·
        Built with 💚 and plain HTML ·
        <a href="https://github.com/zhaijj/paper-notebook" target="_blank">View on GitHub</a>
      </p>
    </div>
  </footer>

  <script src="../js/theme.js"></script>
  <script>
    // Emoji reactions — Supabase-backed live counts + localStorage for personal highlight
    (function () {{
      var SB_URL = 'https://njcxyuzvoolfmgiempid.supabase.co';
      var SB_KEY = 'sb_publishable_Vtj9I-RWxjw1OiqzV2iT7Q_UIy6W3N1';
      var bar = document.getElementById('reaction-bar');
      if (!bar) return;
      var slug = bar.dataset.slug;
      var localKey = 'pn-react-' + slug;
      var saved = localStorage.getItem(localKey);
      var btns = bar.querySelectorAll('.reaction-btn');

      function updateUI(chosen) {{
        btns.forEach(function (btn) {{
          btn.classList.toggle('active', btn.dataset.emoji === chosen);
        }});
      }}
      if (saved) updateUI(saved);

      // Fetch live counts from Supabase
      fetch(SB_URL + '/rest/v1/reactions?select=emoji,count&slug=eq.' + encodeURIComponent(slug), {{
        headers: {{ 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }}
      }})
      .then(function (r) {{ return r.json(); }})
      .then(function (data) {{
        var counts = {{}};
        data.forEach(function (row) {{ counts[row.emoji] = row.count; }});
        btns.forEach(function (btn) {{
          var span = btn.querySelector('.reaction-count');
          if (span) span.textContent = counts[btn.dataset.emoji] > 0 ? counts[btn.dataset.emoji] : '';
        }});
      }});

      btns.forEach(function (btn) {{
        btn.addEventListener('click', function () {{
          var emoji = btn.dataset.emoji;
          if (saved === emoji) {{
            localStorage.removeItem(localKey);
            saved = null;
            updateUI(null);
          }} else {{
            var prev = saved;
            localStorage.setItem(localKey, emoji);
            saved = emoji;
            updateUI(emoji);
            btn.classList.add('pop');
            setTimeout(function () {{ btn.classList.remove('pop'); }}, 300);
            if (typeof umami !== 'undefined') {{ umami.track('reaction', {{ emoji: emoji, post: slug }}); }}
            // Increment in Supabase (atomic via RPC)
            fetch(SB_URL + '/rest/v1/rpc/increment_reaction', {{
              method: 'POST',
              headers: {{
                'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY,
                'Content-Type': 'application/json'
              }},
              body: JSON.stringify({{ p_slug: slug, p_emoji: emoji }})
            }});
            // Optimistic count update
            btns.forEach(function (b) {{
              var span = b.querySelector('.reaction-count');
              if (!span) return;
              var cur = parseInt(span.textContent) || 0;
              if (b.dataset.emoji === emoji) span.textContent = cur + 1;
            }});
          }}
        }});
      }});
    }})();
  </script>

</body>

</html>
"""


# ---------------------------------------------------------------------------
# blog.html listing updater
# ---------------------------------------------------------------------------

def rebuild_blog_listing(blogs: list, blog_html_path: str):
    """Re-render the post cards section in blog.html."""

    if not blogs:
        cards_html = '''\
      <div class="no-results" style="padding: 4rem 0; text-align: center;">
        <p style="font-size: 3rem; margin-bottom: 1rem;">🚧</p>
        <p style="font-size: 1.25rem; font-weight: 600; color: var(--text); margin-bottom: 0.5rem;">No posts yet</p>
        <p style="color: var(--text-dim);">Check back soon — blog posts are on the way!</p>
      </div>'''
    else:
        sorted_blogs = sorted(blogs, key=lambda b: b.get('date', ''), reverse=True)
        card_items = []
        for b in sorted_blogs:
            tag_chips = ''.join(
                f'<span class="filter-btn" style="cursor:default;">{t.strip()}</span>'
                for t in b.get('tags', [])
            )
            card_items.append(f'''\
      <article class="blog-card">
        <div class="blog-card-meta">{b.get('date','')} · {' · '.join(b.get('tags',[]))}</div>
        <h2 class="blog-card-title"><a href="posts/{b['slug']}.html">{b['title']}</a></h2>
        <p class="blog-card-desc">{b.get('description','')}</p>
        <a href="posts/{b['slug']}.html" class="btn btn-outline" style="margin-top:0.75rem;">Read →</a>
      </article>''')
        cards_html = '\n'.join(card_items)

    # Replace the section between markers in blog.html
    with open(blog_html_path, 'r', encoding='utf-8') as f:
        content = f.read()

    marker_start = '<!-- BLOG_POSTS_START -->'
    marker_end = '<!-- BLOG_POSTS_END -->'

    if marker_start not in content:
        # Inject markers around the no-results div if they don't exist yet
        content = content.replace(
            '<div class="container">\n      <div class="no-results"',
            f'<div class="container">\n      {marker_start}\n      <div class="no-results"'
        )
        # Find the closing div after no-results block
        end_idx = content.find('</div>\n    </div>\n  </main>')
        if end_idx != -1:
            content = content[:end_idx + 6] + '\n      ' + marker_end + content[end_idx + 6:]

    new_section = f'{marker_start}\n{cards_html}\n      {marker_end}'
    content = re.sub(
        re.escape(marker_start) + r'.*?' + re.escape(marker_end),
        new_section,
        content,
        flags=re.DOTALL
    )

    # Also update the hero description
    placeholder = 'A space for longer-form writing on plant genomics, DNA language models, and AI \u2014 coming soon.'
    if blogs:
        post_word = 'post' if len(blogs) == 1 else 'posts'
        new_desc = f'{len(blogs)} {post_word} published on plant genomics, DNA language models, and AI.'
    else:
        new_desc = placeholder
    content = re.sub(
        r'(<p>)(A space for longer-form writing[^<]*|[0-9]+ post[s]? published[^<]*)(</p>)',
        f'\\g<1>{new_desc}\\g<3>',
        content
    )

    with open(blog_html_path, 'w', encoding='utf-8') as f:
        f.write(content)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def slugify_heading(text: str) -> str:
    """Text-based slug for HTML heading IDs (may contain Unicode, used as #fragment only)."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '-', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return text.strip('-')


def make_date_slug(date_str: str, posts_dir: str) -> str:
    """Generate a clean ASCII slug like 2026-03-19-01.

    Counts existing posts whose filename starts with date_str to determine
    the next two-digit index.
    """
    existing = []
    if os.path.isdir(posts_dir):
        existing = [
            f for f in os.listdir(posts_dir)
            if f.startswith(date_str) and f.endswith('.html')
        ]
    idx = len(existing) + 1
    return f'{date_str}-{idx:02d}'


def main():
    parser = argparse.ArgumentParser(description='Publish a Markdown blog post to the website.')
    parser.add_argument('--markdown', required=True, help='Path to the source .md file')
    parser.add_argument('--title', required=True, help='Post title')
    parser.add_argument('--description', required=True, help='Short one-sentence description')
    parser.add_argument('--tags', default='', help='Comma-separated tags')
    parser.add_argument('--date', default=str(date.today()), help='Publication date YYYY-MM-DD')
    parser.add_argument('--repo-root', required=True, help='Absolute path to the repo root')
    args = parser.parse_args()

    repo = args.repo_root.rstrip('/')
    docs = f'{repo}/docs'
    posts_dir = f'{docs}/posts'
    blogs_json_path = f'{docs}/js/blogs.json'
    blog_html_path = f'{docs}/blog.html'

    # Make posts dir
    os.makedirs(posts_dir, exist_ok=True)

    # Read markdown
    with open(args.markdown, 'r', encoding='utf-8') as f:
        md_content = f.read()

    # Strip YAML front-matter if present
    md_content = re.sub(r'^---\n.*?\n---\n', '', md_content, flags=re.DOTALL)

    # Convert
    content_html = md_to_html(md_content)

    # Build slug — ASCII date-based (YYYY-MM-DD-NN)
    slug = make_date_slug(args.date, posts_dir)

    # Tags
    tags = [t.strip() for t in args.tags.split(',') if t.strip()]
    tags_display = ' · '.join(tags) if tags else '✍️ Blog'

    # Render post HTML
    post_html = POST_TEMPLATE.format(
        title=args.title,
        description=args.description,
        date=args.date,
        tags_display=tags_display,
        content_html=content_html,
        slug=slug,
    )

    # Write post file
    post_path = f'{posts_dir}/{slug}.html'
    with open(post_path, 'w', encoding='utf-8') as f:
        f.write(post_html)
    print(f'✅ Post written: {post_path}')

    # Update blogs.json
    if os.path.exists(blogs_json_path):
        with open(blogs_json_path, 'r', encoding='utf-8') as f:
            blogs = json.load(f)
    else:
        blogs = []

    # Dedup by slug
    existing_slugs = {b['slug'] for b in blogs}
    if slug in existing_slugs:
        print(f'⚠️  Post "{slug}" already exists in blogs.json — updating metadata.')
        blogs = [b for b in blogs if b['slug'] != slug]

    new_entry = {
        'slug': slug,
        'title': args.title,
        'description': args.description,
        'date': args.date,
        'tags': tags,
        'url': f'posts/{slug}.html',
    }
    blogs.append(new_entry)

    with open(blogs_json_path, 'w', encoding='utf-8') as f:
        json.dump(blogs, f, indent=2, ensure_ascii=False)
    print(f'✅ blogs.json updated ({len(blogs)} total posts)')

    # Rebuild blog.html listing
    rebuild_blog_listing(blogs, blog_html_path)
    print(f'✅ blog.html listing updated')

    print(f'\n📝 Post URL: posts/{slug}.html')
    print(f'📋 Total posts: {len(blogs)}')


if __name__ == '__main__':
    main()
