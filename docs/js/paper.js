/**
 * paper.js — Paper detail page
 * Reads ?id= from URL, finds paper in papers.json, renders full view
 */

document.addEventListener('DOMContentLoaded', async () => {
    const base = getBasePath();
    const id = new URLSearchParams(window.location.search).get('id');

    if (!id) { showError('No paper ID specified.'); return; }

    let papers;
    try {
        const res = await fetch(`${base}/js/papers.json`);
        papers = await res.json();
    } catch (e) {
        showError('Could not load paper database.'); return;
    }

    const paper = papers.find(p => p.id === id);
    if (!paper) { showError(`Paper "${id}" not found.`); return; }

    renderPaper(paper, base);
});

function getBasePath() {
    if (window.location.hostname === 'zhaijj.github.io') return '/paper-notebook';
    const path = window.location.pathname;
    if (path.includes('/docs/')) return path.substring(0, path.indexOf('/docs/') + 5);
    return '.';
}

const JOURNAL_SLUGS = {
    'Nature Plants': 'nature-plants',
    'Nature Genetics': 'nature-genetics',
    'Nature Methods': 'nature-methods',
    'Nature Biotechnology': 'nature-biotech',
    'Nature': 'nature',
    'Cell': 'cell',
    'Cell Genomics': 'cell-genomics',
    'Genome Biology': 'genome-biology',
    'PNAS': 'pnas',
    'bioRxiv': 'biorxiv',
    'MBE': 'mbe',
    'arXiv': 'arxiv',
};

const JOURNAL_ACCENTS = {
    'nature-plants': '#4caf50',
    'nature-genetics': '#ab47bc',
    'nature-methods': '#29b6f6',
    'nature-biotech': '#ff7043',
    'nature': '#ef5350',
    'cell': '#ffa726',
    'cell-genomics': '#26c6da',
    'genome-biology': '#66bb6a',
    'pnas': '#5c6bc0',
    'biorxiv': '#ec407a',
    'mbe': '#8d6e63',
    'arxiv': '#ff7043',
    'default': '#8b949e',
};

// ── Read Status (shared localStorage key with app.js) ────────
const LS_KEY = 'paper-notebook-read';

function loadReadStatus() {
    try {
        const stored = localStorage.getItem(LS_KEY);
        return new Set(stored ? JSON.parse(stored) : []);
    } catch { return new Set(); }
}

function saveReadStatus(set) {
    localStorage.setItem(LS_KEY, JSON.stringify([...set]));
}

function setupReadToggleBtn(paperId) {
    const btn = document.getElementById('btn-read-toggle');
    if (!btn) return;

    function refresh() {
        const readSet = loadReadStatus();
        const isRead = readSet.has(paperId);
        btn.innerHTML = isRead
            ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Mark as Unread`
            : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Mark as Read`;
        btn.classList.toggle('btn-read-active', isRead);
    }

    btn.addEventListener('click', () => {
        const readSet = loadReadStatus();
        if (readSet.has(paperId)) { readSet.delete(paperId); } else { readSet.add(paperId); }
        saveReadStatus(readSet);
        refresh();
    });

    refresh();
}

function renderPaper(paper, base) {
    const slug = JOURNAL_SLUGS[paper.journal] || 'default';
    const accent = JOURNAL_ACCENTS[slug] || JOURNAL_ACCENTS.default;

    // Page title
    document.title = `${paper.title} | Jingjing's Paper Notebook`;

    // Accent CSS var
    document.documentElement.style.setProperty('--accent', accent);
    document.documentElement.style.setProperty('--accent-glow', hexToRgba(accent, 0.25));

    // Top hero bar color strip
    const heroBar = document.getElementById('paper-color-bar');
    if (heroBar) heroBar.style.background = `linear-gradient(90deg, ${accent}, transparent)`;

    // Journal badge
    setHTML('paper-journal-badge', `<span class="journal-badge journal-${slug}">${paper.journal}</span>`);

    // Year chip
    setHTML('paper-year', `<span class="card-year">${paper.year}</span>`);

    // Title
    setHTML('paper-title', paper.title);

    // Authors
    setHTML('paper-authors', (paper.authors || []).join(', '));

    // Stars
    setHTML('paper-stars', renderStars(paper.rating || 0));

    // Abstract
    setHTML('paper-abstract', paper.abstract || '<em>No abstract available.</em>');

    // Notes (parse simple markdown)
    setHTML('paper-notes', parseMarkdown(paper.notes || '_No notes yet._'));

    // DOI link
    const doiBtn = document.getElementById('btn-doi');
    if (doiBtn && paper.doi) {
        doiBtn.href = `https://doi.org/${paper.doi}`;
    } else if (doiBtn) {
        doiBtn.style.display = 'none';
    }

    // Read toggle button
    setupReadToggleBtn(paper.id);

    // Sidebar info
    setHTML('info-journal', paper.journal || '—');
    setHTML('info-year', paper.year || '—');
    setHTML('info-doi', paper.doi ? `<a href="https://doi.org/${paper.doi}" target="_blank" style="color:var(--accent);word-break:break-all;">${paper.doi}</a>` : '—');
    setHTML('info-added', paper.addedDate || '—');
    setHTML('info-rating', renderStars(paper.rating || 0));

    // Tags
    const tagsEl = document.getElementById('paper-tags-cloud');
    if (tagsEl && paper.tags) {
        tagsEl.innerHTML = paper.tags.map(t =>
            `<span class="tag">${t}</span>`
        ).join('');
    }

    // NotebookLM deep notes
    const nlmSection = document.getElementById('section-nlm');
    const nlmNotes = document.getElementById('paper-nlm-notes');
    const nlmLink = document.getElementById('nlm-open-link');
    if (nlmSection && paper.notebooklm_notes) {
        nlmSection.style.display = '';
        if (nlmNotes) setHTML('paper-nlm-notes', parseMarkdown(paper.notebooklm_notes));
        if (nlmLink && paper.notebooklm_url) {
            nlmLink.href = paper.notebooklm_url;
        } else if (nlmLink) {
            nlmLink.style.display = 'none';
        }
    }
}

// ── Simple Markdown Parser ────────────────────────────────────
function parseMarkdown(md) {
    if (!md) return '';
    return md
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^- \[ \] (.+)$/gm, '<li class="task-item">$1</li>')
        .replace(/^- \[x\] (.+)$/gm, '<li class="task-item done">$1</li>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/^(?!<[hul])/gm, '')
        .trim();
}

// ── Helpers ───────────────────────────────────────────────────
function setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

function renderStars(rating) {
    return Array.from({ length: 5 }, (_, i) =>
        `<span class="star ${i < rating ? 'filled' : 'empty'}">${i < rating ? '★' : '☆'}</span>`
    ).join('');
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function showError(msg) {
    const main = document.querySelector('main');
    if (main) main.innerHTML = `
    <div class="container" style="padding: 80px 0; text-align:center; color: var(--text-dim);">
      <h2 style="margin-bottom:12px;">Oops</h2>
      <p>${msg}</p>
      <a href="index.html" class="back-link" style="margin:24px auto 0;">← Back to Papers</a>
    </div>`;
}

// ── Utterances Comments ───────────────────────────────────────
function initUtterances() {
    const container = document.getElementById('utterances-container');
    if (!container) return;

    // Determine the current theme
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const utterancesTheme = isDark ? 'github-dark' : 'github-light';

    // Create script element
    const script = document.createElement('script');
    script.src = 'https://utteranc.es/client.js';
    script.setAttribute('repo', 'zhaijj/paper-notebook');
    script.setAttribute('issue-term', 'title');
    script.setAttribute('label', 'comment');
    script.setAttribute('theme', utterancesTheme);
    script.setAttribute('crossorigin', 'anonymous');
    script.async = true;

    container.appendChild(script);
}

// Listen for theme changes to reload Utterances
document.getElementById('theme-toggle')?.addEventListener('click', () => {
    // Give the theme change a tiny delay to apply to the document
    setTimeout(() => {
        const container = document.getElementById('utterances-container');
        if (container && container.querySelector('.utterances')) {
            // Clear existing comments iframe
            container.innerHTML = '';
            // Re-initialize with new theme
            initUtterances();
        }
    }, 10);
});

// Initialize on first load
document.addEventListener('DOMContentLoaded', () => {
    // Other init stuff is in DOMContentLoaded at top, but we can just call it here
    setTimeout(initUtterances, 500); // slight delay to ensure DOM is ready
});
