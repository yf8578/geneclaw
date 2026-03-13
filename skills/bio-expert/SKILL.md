# bio-expert

The master orchestrator for ClawOmics. It acts as the domain-specific workflow layer between OpenClaw conversation logic and bioinformatics execution, producing structured planning artifacts, explicit agent state, and confirmation-gated run bootstraps.

## Metadata
- **Version**: 1.1.0
- **Category**: Bioinformatics Orchestration
- **Keywords**: bioinformatics, workflows, orchestration, NGS, single-cell, multi-omics, conda, mamba, results-interpretation
- **Compatible Skills**: anndata, biopython, scanpy, deeptools, scvi-tools, bgpt-paper-search, cobrapy

## Quick Start

```bash
# Natural-language entrypoint for OpenClaw-style turns
node scripts/orchestrator.mjs agent "帮我分析 ./data" --write

# Resume from confirmation
node scripts/orchestrator.mjs agent "确认执行" --session ./data/agent_session.json

# Build the full analysis bundle
node scripts/orchestrator.mjs analyze ./data --write

# Build a structured dataset profile
node scripts/orchestrator.mjs profile ./data --write

# Generate an automatic first-pass analysis plan
node scripts/orchestrator.mjs plan ./data --goal "Produce a QC-first analysis plan" --write

# Split a mixed directory into analysis units
node scripts/orchestrator.mjs partition ./data --write

# After explicit user confirmation, create the run workspace
node scripts/orchestrator.mjs run ./data --approve

# Check if a specific skill is available
node scripts/orchestrator.mjs check scanpy

# Get a workflow template
node scripts/orchestrator.mjs template single-cell

# Generate demo data for testing
node ../../scripts/generate_demo_data.mjs
```

## Available Tools

### `profile_dataset`
Analyze a directory or file set, detect core bioinformatics formats, group samples when possible, and emit a machine-readable dataset profile.
- `path` (string, required): The path to the file or directory to analyze.
- `depth` (integer, optional): How deep to recurse into subdirectories (default: 4).
- `maxFiles` (integer, optional): Maximum number of files to inspect (default: 500).

### `build_analysis_plan`
Generate a structured first-pass workflow plan from a dataset profile.
- `path` (string, required): Input path to profile before planning.
- `goal` (string, optional): User intent used to refine the workflow objective.
- `analysisType` (string, optional): Force a specific workflow family when auto-detection is too ambiguous.
- `write` (boolean, optional): Persist `analysis_plan.json` to disk.

### `analyze_dataset`
Produce the combined OpenClaw-facing planning bundle: dataset profile, partitions, and analysis plan.
- `path` (string, required): Input path to analyze.
- `write` (boolean, optional): Persist the bundle and its component artifacts to disk.

This tool is the default OpenClaw entrypoint for a natural-language request such as "there is data in `/path`, help me analyze it."

It should also persist `agent_session.json` so the next turn can resume from durable state.

### `handle_agent_message`
Use a user message as the primary backend API for OpenClaw conversations.
- `message` (string, required): Natural-language user turn.
- `session` (string, optional): Existing `agent_session.json` path for confirmation or resume turns.
- `write` (boolean, optional): Persist planning artifacts when the turn routes into `analyze`.

This tool should be preferred when OpenClaw wants a single natural-language bridge instead of manually dispatching `analyze` and `run`.

### `build_dataset_partitions`
For mixed directories, split detected files into analysis units and attach any assay-routing hints needed before detailed execution.
- `path` (string, required): Input path to analyze.
- `write` (boolean, optional): Persist `dataset_partitions.json` to disk.

### `run_analysis`
After explicit user confirmation, create a run workspace, persist a `run_manifest.json`, and generate step command templates for executable steps.
- `path` (string, required): Input path to run.
- `approve` (boolean, required for execution): Acts as the confirmation gate.
- `outputDir` (string, optional): Override the default run workspace path.

If available, prefer resuming from `agent_session.json` rather than reconstructing state from memory alone.

### `interpret_results`
Provide expert AI-driven interpretation and summarization of bioinformatics outputs (e.g., PCA plots, differential expression tables, mapping logs).
- `results_path` (string, required): Path to the result file or directory.
- `context` (string, optional): Additional biological context (e.g., "Human heart single-cell data").
- `format` (string, optional): Desired output format (e.g., "executive-summary", "technical-report").

## Instructions

### 0. Knowledge Acquisition
Before planning any workflow, the orchestrator should check the project-local inventory at `docs/RESOURCES.md` if it exists. Use it to understand which specialized skills are available on the current host.

### 1. Data-First Orchestration
Always start by profiling the input path before proposing a workflow. The orchestrator must recognize at minimum:
- **Raw sequencing**: `.fastq`, `.fq`, paired-end naming patterns
- **Single-cell**: `.h5ad`, `.mtx`, 10x-style matrix directories
- **Aligned reads**: `.bam`, `.cram`, `.sam`
- **Variant files**: `.vcf`, `.bcf`

When the dataset class is `raw-sequencing`, attempt assay routing into at least `bulk-rnaseq` and `dna-seq`. If confidence is low, keep the routing candidates and ask follow-up questions instead of overcommitting.

### 2. Workflow Continuity
When drafting a plan, ensure each step has a concrete purpose, expected outputs, and explicit dependencies. Plans should be reviewable before execution.

If the input is mixed, partition it into per-modality analysis units before proposing detailed execution.

Never execute a run until the user has explicitly confirmed. Before confirmation, stay in `analyze` mode only.

The preferred OpenClaw flow is:
1. Natural-language intake
2. `handle_agent_message`
3. User review and confirmation
4. `handle_agent_message` or `run_analysis`

### 3. Biological Contextualization
When interpreting results, do not stop at numerical summaries. Relate outputs to plausible biological significance and experimental follow-up.

### 4. Synergy with Specialized Skills
The `bio-expert` does not replace specialized skills like `scanpy`. It acts as the "brain" that knows *when* and *how* to use them together.

### 5. Inventory-Aware Planning
Before proposing a strategy, the `bio-expert` should compare required skills against the local `skills/` directory. If a preferred skill is unavailable, keep the step in the plan but flag the gap.

### 6. Agent Contract
Every OpenClaw-facing response should expose explicit state and conversation scaffolding:
- `agentState`
- `lifecyclePhase`
- `conversation.assistantMessage`
- `conversation.confirmationPrompt`
- `conversation.requiresConfirmation`

## Pre-built Workflow Templates

The orchestrator includes optimized first-pass templates for common analysis types:

### Single-Cell
```json
{
  "analysisType": "single-cell"
}
```

### Variant Analysis
```json
{
  "analysisType": "variant-analysis"
}
```

### Alignment QC
```json
{
  "analysisType": "alignment-qc"
}
```

### Raw Sequencing
```json
{
  "analysisType": "raw-sequencing"
}
```

### Bulk RNA-seq
```json
{
  "analysisType": "bulk-rnaseq"
}
```

### DNA-seq
```json
{
  "analysisType": "dna-seq"
}
```

### Mixed Dataset Triage
```json
{
  "analysisType": "mixed"
}
```
