/**
 * app.js — Paper Notes Notebook
 * Loads papers.json, renders cards, handles search + filter
 */

// ── Journal config ──────────────────────────────────────────
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

// ── State ────────────────────────────────────────────────────
let allPapers = [];
let activeJournal = 'all';
let activeTag = null;
let searchQuery = '';

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // Determine the base path for GitHub Pages vs local
    const base = getBasePath();
    allPapers = await loadPapers(base);
    renderStats();
    renderJournalFilters();
    renderCards();
    setupSearch();
});

function getBasePath() {
    // If on GitHub Pages
    if (window.location.hostname === 'zhaijj.github.io') {
        return '/paper-notebook';
    }

    // For local file:/// viewing, we need the path up to /docs
    const path = window.location.pathname;
    if (path.includes('/docs/')) {
        return path.substring(0, path.indexOf('/docs/') + 5);
    }

    return '.';
    return '.';
}

async function loadPapers(base) {
    try {
        const res = await fetch(`${base}/js/papers.json`);
        if (!res.ok) throw new Error('Failed to fetch papers.json');
        return await res.json();
    } catch (e) {
        console.error('Could not load papers:', e);
        return [];
    }
}

// ── Stats ─────────────────────────────────────────────────────
function renderStats() {
    const count = document.getElementById('stat-count');
    const journalCount = document.getElementById('stat-journals');
    const yearEl = document.getElementById('stat-year');
    if (count) count.textContent = allPapers.length;
    if (journalCount) {
        journalCount.textContent = new Set(allPapers.map(p => p.journal)).size;
    }
    const years = allPapers.map(p => p.year).filter(Boolean);
    if (yearEl && years.length) yearEl.textContent = Math.max(...years);
}

// ── Journal Filter Chips ──────────────────────────────────────
function renderJournalFilters() {
    const wrap = document.getElementById('journal-filters');
    if (!wrap) return;

    const journals = ['all', ...new Set(allPapers.map(p => p.journal))];
    wrap.innerHTML = '';

    journals.forEach(j => {
        const slug = j === 'all' ? 'all' : (JOURNAL_SLUGS[j] || 'default');
        const accent = JOURNAL_ACCENTS[slug] || JOURNAL_ACCENTS.default;
        const chip = document.createElement('button');
        chip.className = 'filter-chip' + (j === 'all' || j === activeJournal ? ' active' : '');
        chip.textContent = j === 'all' ? 'All Journals' : j;
        if (chip.classList.contains('active') && j !== 'all') {
            chip.style.background = accent;
            chip.style.borderColor = accent;
        } else if (j === 'all' && activeJournal === 'all') {
            chip.style.background = 'rgba(88,166,255,0.2)';
            chip.style.borderColor = 'rgba(88,166,255,0.5)';
            chip.style.color = '#58a6ff';
        }
        chip.addEventListener('click', () => {
            activeJournal = j;
            renderJournalFilters();
            renderCards();
        });
        wrap.appendChild(chip);
    });
}

// ── Search ────────────────────────────────────────────────────
function setupSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;
    input.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderCards();
    });
}

// ── Filter logic ──────────────────────────────────────────────
function filterPapers() {
    return allPapers.filter(p => {
        const journalMatch = activeJournal === 'all' || p.journal === activeJournal;
        const tagMatch = !activeTag || (p.tags && p.tags.includes(activeTag));
        const q = searchQuery;
        const searchMatch = !q ||
            p.title.toLowerCase().includes(q) ||
            (p.authors && p.authors.join(' ').toLowerCase().includes(q)) ||
            (p.tags && p.tags.join(' ').toLowerCase().includes(q)) ||
            (p.abstract && p.abstract.toLowerCase().includes(q));
        return journalMatch && tagMatch && searchMatch;
    });
}

// ── Render Cards ──────────────────────────────────────────────
function renderCards() {
    const grid = document.getElementById('papers-grid');
    if (!grid) return;

    const papers = filterPapers();
    grid.innerHTML = '';

    if (!papers.length) {
        grid.innerHTML = `
      <div class="no-results">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <h3>No papers found</h3>
        <p>Try adjusting your search or filters.</p>
      </div>`;
        return;
    }

    papers.forEach((paper, i) => {
        const slug = JOURNAL_SLUGS[paper.journal] || 'default';
        const accent = JOURNAL_ACCENTS[slug] || JOURNAL_ACCENTS.default;
        const detailUrl = `paper.html?id=${paper.id}`;

        const card = document.createElement('a');
        card.className = 'paper-card';
        card.href = detailUrl;
        card.style.setProperty('--card-accent', accent);
        card.style.setProperty('--accent-glow', hexToRgba(accent, 0.15));
        card.style.animationDelay = `${i * 0.05}s`;

        const stars = renderStars(paper.rating || 0);
        const tagsHtml = (paper.tags || []).slice(0, 3).map(t =>
            `<span class="tag" data-tag="${t}">${t}</span>`
        ).join('');

        const nlmBadge = paper.notebooklm_url
            ? `<a class="nlm-badge" href="${paper.notebooklm_url}" target="_blank" rel="noopener" title="Open in NotebookLM">📓 Deep Notes</a>`
            : '';

        card.innerHTML = `
      <div class="card-header">
        <span class="journal-badge journal-${slug}">${paper.journal}</span>
        <span class="card-year">${paper.year}</span>
      </div>
      <h2 class="card-title">${paper.title}</h2>
      <p class="card-authors">${formatAuthors(paper.authors)}</p>
      <p class="card-abstract">${paper.abstract || ''}</p>
      <div class="card-footer">
        <div class="card-tags">${tagsHtml}</div>
        <div class="card-footer-right">
          ${nlmBadge}
          <div class="star-rating">${stars}</div>
        </div>
      </div>`;

        // Tag click filters
        card.querySelectorAll('.tag').forEach(tagEl => {
            tagEl.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                activeTag = activeTag === tagEl.dataset.tag ? null : tagEl.dataset.tag;
                renderCards();
            });
        });

        // NLM badge — open notebook without navigating the card
        const badge = card.querySelector('.nlm-badge');
        if (badge) {
            badge.addEventListener('click', (e) => e.stopPropagation());
        }

        grid.appendChild(card);
    });
}

// ── Helpers ───────────────────────────────────────────────────
function formatAuthors(authors) {
    if (!authors || !authors.length) return '';
    if (authors.length <= 3) return authors.join(', ');
    return `${authors.slice(0, 3).join(', ')} et al.`;
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
