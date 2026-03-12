# bio-expert

The Master Orchestrator for BioClaw, designed to coordinate complex bioinformatics workflows, manage environments, and provide AI-driven interpretation of results across diverse biological data types.

## Metadata
- **Version**: 1.0.0
- **Category**: Bioinformatics Orchestration
- **Keywords**: bioinformatics, workflows, orchestration, NGS, single-cell, multi-omics, conda, mamba, results-interpretation
- **Compatible Skills**: anndata, biopython, scanpy, deeptools, scvi-tools, bgpt-paper-search, cobrapy

## Available Tools

### `identify_bio_data`
Analyze a directory or specific files to identify bioinformatics data types and suggest the most appropriate specialized local skills and tools.
- `path` (string, required): The path to the file or directory to analyze.
- `depth` (integer, optional): How deep to recurse into subdirectories (default: 1).

### `orchestrate_workflow`
Plan and execute a multi-step bioinformatics pipeline (e.g., QC -> Mapping -> Quantification -> Downstream Analysis) by delegating tasks to specialized skills.
- `steps` (array of strings, required): The sequence of workflow steps to perform.
- `input_data` (string, required): Path to the starting data (e.g., FASTQ files).
- `output_dir` (string, required): Directory to store results at each stage.
- `parallel` (boolean, optional): Whether to execute independent steps in parallel where possible.

### `interpret_results`
Provide expert AI-driven interpretation and summarization of bioinformatics outputs (e.g., PCA plots, differential expression tables, mapping logs).
- `results_path` (string, required): Path to the result file or directory.
- `context` (string, optional): Additional biological context (e.g., "Human heart single-cell data").
- `format` (string, optional): Desired output format (e.g., "executive-summary", "technical-report").

### `manage_bio_environment`
Automatically detect, create, and activate the necessary conda or mamba environments for a specific workflow or tool requirement.
- `requirements` (array of strings, optional): List of packages or a path to a `requirements.txt` / `environment.yml`.
- `action` (string, required): Action to perform ("create", "update", "check", "cleanup").
- `env_name` (string, optional): Name of the environment to manage.

## Instructions

### 0. Knowledge Acquisition
Before planning any workflow, the orchestrator MUST refer to the system-generated inventory at `~/bioclaw/docs/RESOURCES.md` to understand the full range of specialized bioinformatics skills available on the host. This ensures the most efficient tool selection for specific data types.

### 1. Data-First Orchestration
Always start by using `identify_bio_data` when encountering unknown files. The orchestrator must recognize:
- **Genomics**: `.fastq`, `.fq`, `.bam`, `.sam`, `.vcf` -> Recommend `biopython`, `deeptools`.
- **Transcriptomics/Single-Cell**: `.h5ad`, `.h5`, `.mtx` -> Recommend `scanpy`, `anndata`, `scvi-tools`.
- **Metabolic Modeling**: `.xml` (SBML), `.json` -> Recommend `cobrapy`.
- **Literature/Research**: Use `bgpt-paper-search` to validate findings against the literature.

### 2. Workflow Continuity
When running `orchestrate_workflow`, ensure each step validates the output of the previous step before proceeding. Maintain a clear audit trail in the `output_dir`.

### 3. Biological Contextualization
When interpreting results via `interpret_results`, don't just state the statistics. Relate them to biological significance (e.g., "The upregulation of gene X suggests an activated inflammatory pathway in these T-cells").

### 4. Environment Integrity
Bioinformatics tools are notoriously version-sensitive. Use `manage_bio_environment` to isolate workflows. Prefer `mamba` for faster dependency resolution if available.

### 5. Synergy with Specialized Skills
The `bio-expert` does not replace specialized skills like `scanpy`. It acts as the "brain" that knows *when* and *how* to use them together.
### 6. Inventory-Aware Execution
Before proposing a strategy or delegating a task, the `bio-expert` MUST check the internal inventory (referencing `~/bioclaw/docs/RESOURCES.md` or a cached version) to identify which specialized skills (e.g., `scanpy`, `deeptools`, `rdkit`) are currently available on the system. If a required skill is missing, suggest alternatives or a manual installation step.
