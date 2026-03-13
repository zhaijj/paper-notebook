---
name: Nature Methods Researcher
description: A research assistant that uses Firecrawl to monitor the latest publications in Nature Methods and summarize the most relevant papers based on your background in plant genomics, DNA language models, and AI.
---

# Nature Methods Researcher

## Purpose
This skill configures the agent to automatically scrape the recent publications from Nature Methods (nature.com/nmeth) and filter them based on your specific research expertise in plant genetics, DNA language models, and machine learning.

## Prerequisites
- The **Firecrawl MCP Server** must be running locally and configured in `.mcp.json`.

## Target Journal
- Nature Methods (https://www.nature.com/nmeth/articles?type=article)

## Instructions for the Agent

When the user invokes this skill, follow these exact steps:

1. **Scrape Journal Pages:**
   Try scraping the latest articles:
   ```
   firecrawl_scrape(url="https://www.nature.com/nmeth/articles?type=article", formats=["markdown"])
   ```
   If blocked or insufficient, fall back to `firecrawl_search` with:
   ```
   site:nature.com/nmeth 2026 genomics OR sequencing OR language model OR deep learning
   ```

2. **Filter & Select:**
   Read the scraped content and identify all relevant papers based on the user's core research background. The core research interests to prioritize are:
   - **Computational/AI Methods for Genomics:** new tools for sequence analysis, variant calling, genome annotation, or multi-omics.
   - **DNA/Biological Language Models:** new model architectures or training approaches for biological sequences.
   - **Sequencing and Assembly Technologies:** long-read, single-cell, spatial, or other next-generation sequencing methods applicable to plant or population genomics.
   - **Deep Learning in Biology:** novel neural network approaches for biological data analysis.
   - **RECENCY CONSTRAINT:** You MUST ONLY select papers from the most recent publication issue. Do not retrieve or select older papers from past years or previous issues.

3. **Fetch Abstracts:**
   For each relevant paper, use the `firecrawl_scrape` tool to fetch its dedicated abstract page on nature.com to get the full abstract text and DOI.

3b. **Deduplicate Against Existing Papers:**
   Before presenting results, check the existing database at `docs/js/papers.json` in the repository. Read the file and extract all existing paper DOIs and titles. Cross-reference your candidate papers against this list — if a paper's DOI or title (case-insensitive) already exists in `papers.json`, **skip it and do not include it in the final results**. Only present papers that are genuinely new and not already tracked.

4. **Format Output:**
   Present the final output using clear markdown headings and bullet points. For each paper, you MUST include:
   - The Journal Name, Title, and Authors
   - A concise 2-3 sentence summary of the abstract, highlighting the core methodological contribution
   - Why it is relevant to the user's specific research
   - Direct markdown links to the abstract page.

## Example Output Format
```markdown
### 1. [Paper Title](https://www.nature.com/articles/XXXX) - *Nature Methods*
*   **Authors:** Author 1, Author 2, et al.
*   **Abstract Summary:** [2-3 sentences summarising the abstract and main findings]
*   **Relevance:** [1 sentence explaining why it aligns with plant genomics or biological AI]
*   **Link:** [Abstract Page](https://www.nature.com/articles/XXXX)
```

## Step 5 — Offer to Add to Notebook
After presenting the results, always ask:

> "Would you like to add any of these to your paper notebook website? Reply with the numbers (e.g. **1, 3**), **all**, or **none**."

Then follow the **Add to Notebook** skill (`.agents/skills/add_to_notebook/SKILL.md`) to handle selection, schema building, and automatic commit + push to GitHub.
