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
let deepNotesOnly = false;
let unreadOnly = false;
let activeSort = 'newest'; // 'newest' | 'oldest' | 'rating'
let displayLimit = 50;   // 25 | 50 | 100 | 0 (= all)

// ── Read Status (localStorage) ────────────────────────────────
const LS_KEY = 'paper-notebook-read';
let readPapers = new Set();

function loadReadStatus() {
    try {
        const stored = localStorage.getItem(LS_KEY);
        readPapers = new Set(stored ? JSON.parse(stored) : []);
    } catch { readPapers = new Set(); }
}

function saveReadStatus() {
    localStorage.setItem(LS_KEY, JSON.stringify([...readPapers]));
}

function toggleRead(id) {
    if (readPapers.has(id)) { readPapers.delete(id); } else { readPapers.add(id); }
    saveReadStatus();
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    loadReadStatus();
    const base = getBasePath();
    allPapers = await loadPapers(base);
    renderStats();
    renderJournalFilters();
    renderCards();
    setupSearch();
    setupDeepNotesToggle();
    setupUnreadToggle();
    setupSortSelect();
    setupDisplayLimit();
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

// ── Deep Notes Toggle ─────────────────────────────────────────
function setupDeepNotesToggle() {
    const btn = document.getElementById('deep-notes-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
        deepNotesOnly = !deepNotesOnly;
        btn.setAttribute('aria-pressed', deepNotesOnly);
        btn.classList.toggle('active', deepNotesOnly);
        renderCards();
    });
}

// ── Unread Only Toggle ────────────────────────────────────────
function setupUnreadToggle() {
    const btn = document.getElementById('unread-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
        unreadOnly = !unreadOnly;
        btn.setAttribute('aria-pressed', unreadOnly);
        btn.classList.toggle('active', unreadOnly);
        renderCards();
    });
}

// ── Sort Select ───────────────────────────────────────────────
function setupSortSelect() {
    const sel = document.getElementById('sort-select');
    if (!sel) return;
    sel.addEventListener('change', (e) => {
        activeSort = e.target.value;
        renderCards();
    });
}

// ── Sort logic ────────────────────────────────────────────────
// Effective date = max(updatedDate, addedDate) so that papers updated
// (e.g. via NotebookLM linking) bubble to the top on "newest" sort.
function effectiveDate(paper) {
    const added = paper.addedDate
        ? new Date(paper.addedDate).getTime()
        : new Date(`${paper.year}-01-01`).getTime();
    const updated = paper.updatedDate
        ? new Date(paper.updatedDate).getTime()
        : 0;
    return Math.max(added, updated);
}

function sortPapers(papers) {
    // Preserve original array index as insertion-order tiebreaker
    const indexed = papers.map((p, i) => ({ p, i }));
    indexed.sort((a, b) => {
        // Unread papers always float above read ones
        const readA = readPapers.has(a.p.id) ? 1 : 0;
        const readB = readPapers.has(b.p.id) ? 1 : 0;
        if (readA !== readB) return readA - readB;

        if (activeSort === 'rating') {
            return (b.p.rating || 0) - (a.p.rating || 0);
        }
        const dateA = effectiveDate(a.p);
        const dateB = effectiveDate(b.p);
        if (dateA !== dateB) {
            return activeSort === 'oldest' ? dateA - dateB : dateB - dateA;
        }
        // Same effective date: later array position = more recently added
        return activeSort === 'oldest' ? a.i - b.i : b.i - a.i;
    });
    return indexed.map(({ p }) => p);
}


// ── Filter logic ──────────────────────────────────────────────
function filterPapers() {
    return allPapers.filter(p => {
        const journalMatch = activeJournal === 'all' || p.journal === activeJournal;
        const tagMatch = !activeTag || (p.tags && p.tags.includes(activeTag));
        const deepMatch = !deepNotesOnly || !!p.notebooklm_url;
        const unreadMatch = !unreadOnly || !readPapers.has(p.id);
        const q = searchQuery;

        // Handle authors as string or array
        const authorsString = Array.isArray(p.authors) ? p.authors.join(' ') : (p.authors || '');

        const searchMatch = !q ||
            p.title.toLowerCase().includes(q) ||
            authorsString.toLowerCase().includes(q) ||
            (p.tags && p.tags.join(' ').toLowerCase().includes(q)) ||
            (p.abstract && p.abstract.toLowerCase().includes(q));
        return journalMatch && tagMatch && deepMatch && unreadMatch && searchMatch;
    });
}

// ── Build a single card DOM element ──────────────────────────
function buildCard(paper, animIndex) {
    const slug = JOURNAL_SLUGS[paper.journal] || 'default';
    const accent = JOURNAL_ACCENTS[slug] || JOURNAL_ACCENTS.default;
    const detailUrl = `paper.html?id=${paper.id}`;
    const isRead = readPapers.has(paper.id);

    const card = document.createElement('a');
    card.className = 'paper-card' + (isRead ? ' paper-card--read' : '');
    card.href = detailUrl;
    card.style.setProperty('--card-accent', accent);
    card.style.setProperty('--accent-glow', hexToRgba(accent, 0.15));
    card.style.animationDelay = `${animIndex * 0.05}s`;

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
    <button class="read-checkbox ${isRead ? 'read-checkbox--read' : ''}" title="${isRead ? 'Mark as unread' : 'Mark as read'}" aria-label="${isRead ? 'Mark as unread' : 'Mark as read'}" aria-pressed="${isRead}">
      ${isRead ? '✓ Read' : '○ Unread'}
    </button>
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

    card.querySelectorAll('.tag').forEach(tagEl => {
        tagEl.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            activeTag = activeTag === tagEl.dataset.tag ? null : tagEl.dataset.tag;
            renderCards();
        });
    });

    const badge = card.querySelector('.nlm-badge');
    if (badge) badge.addEventListener('click', (e) => e.stopPropagation());

    // Read checkbox — toggle without navigating to paper
    const readBtn = card.querySelector('.read-checkbox');
    if (readBtn) {
        readBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleRead(paper.id);
            const nowRead = readPapers.has(paper.id);
            readBtn.classList.toggle('read-checkbox--read', nowRead);
            readBtn.textContent = nowRead ? '✓ Read' : '○ Unread';
            readBtn.title = nowRead ? 'Mark as unread' : 'Mark as read';
            readBtn.setAttribute('aria-pressed', nowRead);
            card.classList.toggle('paper-card--read', nowRead);
            // If unread-only filter is active, re-render to hide newly read card
            if (unreadOnly) renderCards();
        });
    }

    return card;
}

// ── Display Limit Select ──────────────────────────────────────
function setupDisplayLimit() {
    const sel = document.getElementById('limit-select');
    if (!sel) return;
    sel.value = String(displayLimit);
    sel.addEventListener('change', (e) => {
        displayLimit = Number(e.target.value); // 0 means "all"
        renderCards();
    });
}

// ── Render Cards ──────────────────────────────────────────────
function renderCards() {
    const grid = document.getElementById('papers-grid');
    if (!grid) return;

    const papers = sortPapers(filterPapers());
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

    const visible = displayLimit > 0 ? papers.slice(0, displayLimit) : papers;
    visible.forEach((paper, i) => grid.appendChild(buildCard(paper, i)));
}

// ── Helpers ───────────────────────────────────────────────────
function formatAuthors(authors) {
    if (!authors || !authors.length) return '';
    if (typeof authors === 'string') return authors;
    if (Array.isArray(authors)) {
        if (authors.length <= 3) return authors.join(', ');
        return `${authors.slice(0, 3).join(', ')} et al.`;
    }
    return '';
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
