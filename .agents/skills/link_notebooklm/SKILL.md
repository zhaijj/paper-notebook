---
name: Link NotebookLM
description: Links a NotebookLM notebook to a paper on the website. If the paper already exists in papers.json, adds notebooklm_url and notebooklm_notes. If it doesn't exist yet, automatically creates a full paper entry (fetching abstract + metadata) and then links the notebook — all in one flow. Commits and pushes on completion.
---

# Link NotebookLM Notes to a Paper

## Purpose
For "deep-read" papers where you've created a NotebookLM notebook with personal analysis, this skill connects that notebook back to the paper on the website. The paper card will show a 📓 Deep Notes badge and the detail page will display your NotebookLM notes.

Works whether or not the paper already exists in `papers.json`.

## When to Invoke
Invoke when the user says something like:
- "link my NotebookLM notes to zhou2024maize"
- "attach my notebook to this paper"
- "connect NotebookLM to [paper id or title]"
- "add my NotebookLM notes for [paper title]"
- "link the notebook 'single-cell foundation model' to the website"
- "update the notebook: [notebook name] to website"

---

## Instructions for the Agent

### Step 1 — Find the NotebookLM notebook

If the user named a notebook (e.g. "single-cell foundation model"):
- Call `notebook_list` to list their notebooks
- Find the best match by name and confirm with the user: *"Found notebook 'Single-Cell Foundation Models — Reading Notes'. Use this one?"*
- Use that notebook's `notebook_id` and construct URL as `https://notebooklm.google.com/notebook/{notebook_id}`

If the user provided a notebook URL directly:
- Extract the `notebook_id` from the path and use the URL as-is

---

### Step 2 — Check if the paper exists in papers.json

Read `docs/js/papers.json` and search for any paper whose `title` closely matches the notebook name, or whose `id` the user specified.

**Branch A — Paper already exists** → skip to Step 4

**Branch B — Paper does NOT exist** → continue to Step 3

---

### Step 3 (Branch B only) — Create the paper entry

Since the paper is not in `papers.json` yet, create it automatically:

#### 3a. Get paper details from the notebook
Call `notebook_query` on the notebook with:
```
"What is the full title of the paper in this notebook, who are the authors, 
what journal was it published in, what year, and what is the DOI? 
Please give exact values."
```

Use those values to fill in metadata. If the DOI is found, also use `firecrawl_scrape` on `https://doi.org/{doi}` to get the full abstract.

#### 3b. Generate the paper ID
Format: `{firstauthorlastname}{year}{firstkeyword}` — e.g. `hao2024singlecell`

#### 3c. Build the full paper object
Fill all fields per the standard schema:

| Field | Value |
|---|---|
| `id` | generated slug |
| `title` | from notebook query |
| `authors` | from notebook query (must be an array of strings, e.g. `["John Doe", "Jane Smith"]`) |
| `journal` | from notebook query (must match known journal list) |
| `year` | integer |
| `doi` | string only, no URL prefix; `""` if not found |
| `tags` | 3–6 keywords |
| `rating` | `3` (default) |
| `abstract` | fetched from DOI page, or from notebook query |
| `notes` | AI-generated structured notes using the standard template |
| `addedDate` | today's date as `YYYY-MM-DD` |
| `source` | same as `journal` |

**Known journals** (use closest match; badge will be gray if unknown):
`Nature Plants`, `Nature Genetics`, `Nature Methods`, `Nature Biotechnology`, `Nature`, `Cell`, `Cell Genomics`, `Genome Biology`, `PNAS`, `bioRxiv`, `MBE`, `arXiv`

**Notes template:**
```markdown
## Key Findings
- [bullet 1]
- [bullet 2]

## Relevance to Our Work
[1-2 sentences]

## Methods Worth Noting
- [method 1]

## Questions / Follow-ups
- [ ] [question 1]
```

#### 3d. Write and append the new paper
Write the new entry as a JSON array to `/tmp/new_papers.json`, then run:
```bash
python3 .agents/skills/add_to_notebook/scripts/append_papers.py \
  --papers-json docs/js/papers.json \
  --new-entries /tmp/new_papers.json
```

---

### Step 4 — Query the notebook for deep notes

Call `notebook_query` with:
```
"Please give me a comprehensive personal study summary including:
1. Key findings and main contributions
2. Important methodological details  
3. My personal insights and analysis notes from this notebook
4. Open questions or follow-ups
5. Relevance to plant genomics / DNA language models / AI

Format as markdown with clear section headers."
```

Write the response to `/tmp/nlm_notes.md`.

---

### Step 5 — Request User Review (Critical Step)

**STOP.** Before proceeding any further, you must use the `notify_user` tool. Provide the absolute path `/tmp/nlm_notes.md` to the user and instruct them to:
1. Open the file in their editor.
2. Review and edit the markdown notes to their liking.
3. Save the file and confirm in the chat that they are ready to proceed.

Do not move to the next step until the user explicitly confirms the notes are ready.

---

### Step 6 — Link the notebook to the paper

Run:
```bash
python3 .agents/skills/link_notebooklm/scripts/update_notebooklm.py \
  --papers-json docs/js/papers.json \
  --paper-id {paper_id} \
  --notebooklm-url "{notebooklm_url}" \
  --notebooklm-notes /tmp/nlm_notes.md
```

---

### Step 7 — Commit and push

```bash
cd /Users/zhaijj/Documents/00PostDoc/Buckler_lab/GitHub/paper-notebook
git add docs/js/papers.json
git commit -m "feat: link NotebookLM notes to {paper_id}"
git push origin main
```

---

### Step 8 — Confirm to user

Report back:
- Whether a new paper was created or an existing one was updated
- Paper title + id
- Preview of first few lines of extracted notes
- Live site URL: `https://zhaijj.github.io/jingjing-paper-notebook/` (updates in ~1 min)

---

## Important Notes
- **Never overwrite** `papers.json` entirely — go through the scripts.
- If a paper already has `notebooklm_notes`, ask the user before overwriting.
- The `notebooklm_notes` field must be clean markdown — no raw JSON or HTML.
- If `notebook_query` errors, retry once before asking the user to provide notes manually.
- If the notebook name is ambiguous (multiple matches), show the list and ask.
