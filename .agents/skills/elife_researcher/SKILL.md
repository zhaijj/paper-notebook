---
name: eLife Researcher
description: A research assistant that uses Firecrawl to monitor the latest publications in eLife and summarize the most relevant papers based on your background in plant genomics, DNA language models, and AI.
---

# eLife Researcher

## Purpose
This skill configures the agent to automatically scrape the recent publications from eLife (elifesciences.org) and filter them based on your specific research expertise in plant genetics, DNA language models, and machine learning.

## Prerequisites
- The **Firecrawl MCP Server** must be running locally (`docker compose up -d`) and configured in the `mcp_config.json`.

## Target Journal
- eLife (https://elifesciences.org)
- eLife publishes both fully "Version of Record" **Research Articles** (`/articles/[ID]`) and **Reviewed Preprints** (`/reviewed-preprints/[ID]`) — under eLife's publishing model, a Reviewed Preprint with public peer reviews and an eLife assessment is a legitimate, citable published output, not a draft. Treat both URL patterns as valid papers.

## Instructions for the Agent

When the user invokes this skill, follow these exact steps:

1. **Scrape Journal Pages:**
   eLife organizes articles by subject rather than a single "latest issue" page. Use `firecrawl_scrape` to fetch the subject pages most relevant to the user's research:

   ```
   firecrawl_scrape(url="https://elifesciences.org/subjects/genetics-genomics", formats=["markdown"])
   firecrawl_scrape(url="https://elifesciences.org/subjects/plant-biology", formats=["markdown"])
   firecrawl_scrape(url="https://elifesciences.org/subjects/evolutionary-biology", formats=["markdown"])
   firecrawl_scrape(url="https://elifesciences.org/subjects/computational-systems-biology", formats=["markdown"])
   ```

   Combine the article lists from all four pages before filtering (expect overlap — deduplicate by article ID). If a page is blocked or returns insufficient content, fall back to `firecrawl_search` with a query like `"site:elifesciences.org 2026 genomics OR pangenome OR language model OR evolution"`.

2. **Filter & Select:**
   Read the scraped content and identify all relevant papers based on the user's core research background. The core research interests to prioritize are:
   - **DNA/Biological Language Models (Foundation Models):** applications to genomics, cross-species analysis, evolution, and population genetics/genomics.
   - **Plant Genomics and Evolution:** crop genomics, regulatory elements, whole-genome duplication, pangenomes, transposable elements, domestication.
   - **AI/Deep Learning Methods in Biology:** novel architectures applied to bioinformatics, RNA-seq, and sequence modeling.
   - **Genome Assembly and Annotation:** T2T assemblies, long-read sequencing, structural variants.
   - **RECENCY CONSTRAINT:** You MUST ONLY select papers from the most recent listings (both new Reviewed Preprints and newly-versioned Research Articles). Do not retrieve or select older papers from past years. If using `firecrawl_search`, specifically query for the current month/year to avoid retrieving older highly-cited papers.

3. **Fetch Abstracts:**
   For each relevant paper, use the `firecrawl_scrape` tool to fetch its dedicated page on elifesciences.org (`/articles/[ID]` or `/reviewed-preprints/[ID]`) to get the full abstract text and DOI. Note in your notes if it is a Reviewed Preprint (not yet a Version of Record) versus a full Research Article.

3b. **Deduplicate Against Existing Papers:**
   Before presenting results, check the existing database at `docs/js/papers.json` in the repository. Read the file and extract all existing paper DOIs and titles. Cross-reference your candidate papers against this list — if a paper's DOI or title (case-insensitive) already exists in `papers.json`, **skip it and do not include it in the final results**. Only present papers that are genuinely new and not already tracked.

4. **Format Output:**
   Present the final output using clear markdown headings and bullet points. For each paper, you MUST include:
   - The Journal Name, Title, and Authors
   - A concise 2-3 sentence summary of the abstract, highlighting the core biological/AI contribution
   - Why it is relevant to the user's specific research
   - Direct markdown links to the article page.

## Example Output Format
```markdown
### 1. [Paper Title](https://elifesciences.org/articles/XXXX) - *eLife*
*   **Authors:** Author 1, Author 2, etc.
*   **Status:** Research Article (Version of Record) / Reviewed Preprint
*   **Abstract Summary:** [2-3 sentences summarising the abstract and main findings]
*   **Relevance:** [1 sentence explaining why it aligns with plant genomics or biological AI]
*   **Link:** [Article Page](https://elifesciences.org/articles/XXXX)
```

## Step 5 — Offer to Add to Notebook
After presenting the results, always ask:

> "Would you like to add any of these to your paper notebook website? Reply with the numbers (e.g. **1, 3**), **all**, or **none**."

Then follow the **Add to Notebook** skill (`.agents/skills/add_to_notebook/SKILL.md`) to handle selection, schema building, and automatic commit + push to GitHub.
