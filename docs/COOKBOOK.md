# 📖 ClawOmics Cookbook: Best Practices & Prompts

Welcome to the ClawOmics Cookbook. Use these prompts to get the most out of your AI-driven bioinformatics research assistant.

---

## 🧬 Single-Cell RNA-seq

### Scene: Full Analysis Pipeline
**Prompt:**
> "Analyze the 10X single-cell data in `./data/sample_h5ad/`. Perform standard QC, normalization, clustering, and annotate cell types using marker genes. Provide a UMAP visualization."

**Tools Orchestrated:**
- `identify_bio_data` -> `scanpy` -> `scvi-tools` -> `scientific-visualization`

---

## 🩺 Clinical Genomics

### Scene: Variant Prioritization
**Prompt:**
> "I have a patient VCF file `patient_01.vcf`. Identify potentially pathogenic mutations, query ClinVar for their significance, and draft a clinical interpretation report."

**Tools Orchestrated:**
- `pysam` -> `query-clinvar` -> `query-ensembl` -> `clinical-decision-support`

---

## 🧪 Drug Discovery

### Scene: Target Exploration & Docking
**Prompt:**
> "Explore the protein structure of EGFR via AlphaFold. Find top 5 known inhibitors from ChEMBL and suggest 3 novel analogs with potentially better binding affinity using RDKit."

**Tools Orchestrated:**
- `query-alphafold` -> `chembl-database` -> `rdkit` -> `datamol`

---

## 📊 General Data Science

### Scene: Multi-Omics Integration Plot
**Prompt:**
> "Integrate the RNA-seq DEG table and Proteomics results from `./results`. Create a correlation scatter plot using Seaborn and highlight genes that are upregulated in both."

**Tools Orchestrated:**
- `pandas` -> `seaborn` -> `scientific-visualization`

---

## ⚙️ Advanced Orchestration

### Scene: Workflow Design
**Prompt:**
> "Design a Snakemake workflow for a standard DNA-seq mapping pipeline. Assume I have raw FASTQ files and want to reach a filtered BAM file."

**Tools Orchestrated:**
- `bio-expert` -> `bioinformatics-workflow`
