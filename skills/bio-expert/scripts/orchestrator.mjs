#!/usr/bin/env node
/**
 * Bio-Expert Orchestrator Core
 * Produces structured dataset profiles and analysis plans for OpenClaw.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = process.env.CLAWOMICS_HOME || path.resolve(__dirname, '..', '..', '..');
const SKILLS_DIR = path.join(PROJECT_ROOT, 'skills');
const RESOURCES_FILE = path.join(PROJECT_ROOT, 'docs', 'RESOURCES.md');

const DEFAULT_DEPTH = 4;
const DEFAULT_MAX_FILES = 500;
const PROFILE_SCHEMA_VERSION = '1.0.0';
const PLAN_SCHEMA_VERSION = '1.0.0';
const AGENT_PROTOCOL_VERSION = '1.0.0';

const FORMAT_DEFINITIONS = [
    {
        key: 'fastq',
        label: 'NGS raw reads',
        extensions: ['.fastq', '.fastq.gz', '.fq', '.fq.gz'],
        skills: ['biopython', 'deeptools'],
        externalTools: ['fastp', 'multiqc'],
    },
    {
        key: 'h5ad',
        label: 'Single-cell AnnData',
        extensions: ['.h5ad'],
        skills: ['scanpy', 'anndata', 'scvi-tools'],
        externalTools: [],
    },
    {
        key: 'mtx',
        label: 'Matrix market',
        extensions: ['.mtx', '.mtx.gz'],
        skills: ['scanpy', 'anndata'],
        externalTools: [],
    },
    {
        key: 'h5',
        label: 'Hierarchical HDF5',
        extensions: ['.h5'],
        skills: ['scanpy', 'anndata'],
        externalTools: [],
    },
    {
        key: 'vcf',
        label: 'Variant calls',
        extensions: ['.vcf', '.vcf.gz', '.bcf'],
        skills: ['pysam', 'clinvar-database', 'ensembl-database'],
        externalTools: ['bcftools'],
    },
    {
        key: 'bam',
        label: 'Aligned reads',
        extensions: ['.bam', '.cram', '.sam'],
        skills: ['pysam', 'deeptools'],
        externalTools: ['samtools', 'multiqc'],
    },
    {
        key: 'bed',
        label: 'Genomic intervals',
        extensions: ['.bed', '.bed.gz'],
        skills: ['gtars', 'deeptools'],
        externalTools: ['bedtools'],
    },
    {
        key: 'gtf',
        label: 'Reference annotation',
        extensions: ['.gtf', '.gff', '.gff3'],
        skills: ['biopython'],
        externalTools: [],
    },
    {
        key: 'tabular',
        label: 'Tabular results',
        extensions: ['.csv', '.tsv'],
        skills: ['polars'],
        externalTools: [],
    },
];

const WORKFLOW_BLUEPRINTS = {
    'single-cell': {
        title: 'Single-cell expression analysis',
        objective: 'Run a standard single-cell workflow from matrix or AnnData input through QC, clustering, annotation, and marker discovery.',
        assumptions: [
            'Input represents a cell-by-feature expression matrix or processed AnnData object.',
            'Cell-level metadata may need to be inferred or merged from companion files.',
        ],
        preflightChecks: [
            'Confirm species, tissue, and experimental design.',
            'Check whether batches or donors need explicit correction.',
            'Validate that count matrices and feature/barcode files are consistent.',
        ],
        steps: [
            {
                id: 'qc',
                name: 'Quality control and filtering',
                purpose: 'Filter low-quality cells and genes before downstream analysis.',
                skills: ['scanpy', 'anndata'],
                outputs: ['qc_metrics.tsv', 'filtered_data.h5ad'],
            },
            {
                id: 'normalize',
                name: 'Normalization and feature selection',
                purpose: 'Normalize counts, log-transform, and identify informative genes.',
                skills: ['scanpy'],
                outputs: ['normalized_data.h5ad'],
            },
            {
                id: 'integrate',
                name: 'Batch correction',
                purpose: 'Correct batch effects when multiple samples or donors are present.',
                skills: ['scvi-tools'],
                optional: true,
                outputs: ['integrated_latent_space.h5ad'],
            },
            {
                id: 'cluster',
                name: 'Dimensionality reduction and clustering',
                purpose: 'Build neighborhood graph, compute embeddings, and define clusters.',
                skills: ['scanpy'],
                outputs: ['umap.png', 'clustered_data.h5ad'],
            },
            {
                id: 'annotate',
                name: 'Cell type annotation',
                purpose: 'Assign biological identities to clusters using markers or references.',
                skills: ['cellxgene-census', 'scanpy'],
                outputs: ['cell_type_annotations.tsv'],
            },
            {
                id: 'markers',
                name: 'Marker discovery and interpretation',
                purpose: 'Identify cluster markers and summarize biological programs.',
                skills: ['scanpy'],
                outputs: ['marker_genes.tsv', 'analysis_summary.md'],
            },
        ],
        deliverables: ['filtered_data.h5ad', 'umap.png', 'cell_type_annotations.tsv', 'analysis_summary.md'],
        warnings: [],
    },
    'variant-analysis': {
        title: 'Variant review and annotation',
        objective: 'Validate variant files, annotate clinically relevant variants, and prepare interpretation-ready outputs.',
        assumptions: [
            'Input contains called variants rather than raw reads.',
        ],
        preflightChecks: [
            'Confirm reference genome build and variant caller provenance.',
            'Check whether cohort-level metadata or phenotype labels are available.',
        ],
        steps: [
            {
                id: 'validate',
                name: 'VCF validation and normalization',
                purpose: 'Confirm variant file integrity and normalize multi-allelic records.',
                skills: ['pysam'],
                externalTools: ['bcftools'],
                outputs: ['validated.vcf.gz'],
            },
            {
                id: 'summarize',
                name: 'Variant summary statistics',
                purpose: 'Generate counts by consequence, chromosome, and quality filters.',
                skills: ['pysam'],
                outputs: ['variant_summary.tsv'],
            },
            {
                id: 'annotate',
                name: 'Clinical and gene annotation',
                purpose: 'Attach gene context, known significance, and disease associations.',
                skills: ['clinvar-database', 'ensembl-database'],
                outputs: ['annotated_variants.tsv'],
            },
            {
                id: 'interpret',
                name: 'Prioritization and interpretation',
                purpose: 'Rank variants for follow-up and summarize likely biological impact.',
                skills: ['clinical-decision-support', 'scientific-writing'],
                optional: true,
                outputs: ['variant_interpretation.md'],
            },
        ],
        deliverables: ['validated.vcf.gz', 'annotated_variants.tsv', 'variant_interpretation.md'],
        warnings: [],
    },
    'alignment-qc': {
        title: 'Alignment quality review',
        objective: 'Assess aligned read files, validate indexes, and generate QC summaries before downstream analysis.',
        assumptions: [
            'Input contains aligned reads rather than raw sequencing data.',
        ],
        preflightChecks: [
            'Confirm whether BAM/CRAM files are RNA-seq, DNA-seq, or other assay types.',
            'Check for matching index files and sample metadata.',
        ],
        steps: [
            {
                id: 'validate',
                name: 'Alignment validation',
                purpose: 'Verify file integrity and indexing status.',
                skills: ['pysam'],
                externalTools: ['samtools'],
                outputs: ['alignment_validation.tsv'],
            },
            {
                id: 'qc',
                name: 'Coverage and signal QC',
                purpose: 'Compute coverage summaries and mapping-quality metrics.',
                skills: ['deeptools'],
                externalTools: ['multiqc'],
                outputs: ['coverage_report.tsv', 'multiqc_report.html'],
            },
            {
                id: 'branch',
                name: 'Downstream branch selection',
                purpose: 'Decide whether to continue with expression, peak, or variant workflows.',
                skills: ['bio-expert'],
                outputs: ['branch_decision.md'],
            },
        ],
        deliverables: ['alignment_validation.tsv', 'coverage_report.tsv', 'branch_decision.md'],
        warnings: ['Downstream workflow selection remains assay-dependent.'],
    },
    'raw-sequencing': {
        title: 'Raw sequencing triage and planning',
        objective: 'Profile raw read data, run initial QC, and choose the correct downstream assay-specific workflow.',
        assumptions: [
            'Only raw sequencing files are available, so assay type may remain ambiguous.',
        ],
        preflightChecks: [
            'Confirm library type, organism, strandedness, and whether reads are DNA-seq, bulk RNA-seq, or another assay.',
            'Check sample sheet availability and paired-end consistency.',
        ],
        steps: [
            {
                id: 'inventory',
                name: 'Sample and lane inventory',
                purpose: 'Group files into samples and detect paired-end structure.',
                skills: ['bio-expert'],
                outputs: ['sample_inventory.tsv'],
            },
            {
                id: 'qc',
                name: 'Raw read quality control',
                purpose: 'Assess per-base quality, adapter content, and duplication patterns.',
                skills: ['deeptools'],
                externalTools: ['fastp', 'multiqc'],
                outputs: ['fastp_reports/', 'multiqc_report.html'],
            },
            {
                id: 'route',
                name: 'Assay-specific workflow selection',
                purpose: 'Choose the correct downstream pipeline once experimental context is confirmed.',
                skills: ['bio-expert'],
                outputs: ['assay_routing.md'],
            },
        ],
        deliverables: ['sample_inventory.tsv', 'multiqc_report.html', 'assay_routing.md'],
        warnings: ['Raw reads alone are insufficient to distinguish all assay types with high confidence.'],
    },
    'bulk-rnaseq': {
        title: 'Bulk RNA-seq expression workflow',
        objective: 'Process bulk RNA-seq reads through QC, alignment or pseudoalignment, quantification, and differential expression.',
        assumptions: [
            'Input contains bulk transcriptome sequencing reads rather than single-cell or targeted DNA panels.',
            'Experimental groups and replicates are available or can be supplied from metadata.',
        ],
        preflightChecks: [
            'Confirm organism, reference transcriptome, and library strandedness.',
            'Verify whether paired-end files are complete for all samples.',
            'Check that group labels and replicate structure are available for DE testing.',
        ],
        steps: [
            {
                id: 'inventory',
                name: 'Sample inventory and metadata join',
                purpose: 'Map FASTQ files to samples, replicates, and biological conditions.',
                skills: ['bio-expert'],
                outputs: ['sample_sheet.tsv'],
            },
            {
                id: 'qc',
                name: 'Raw read QC and trimming',
                purpose: 'Inspect quality, trim adapters if needed, and summarize issues across samples.',
                skills: ['deeptools'],
                externalTools: ['fastp', 'multiqc'],
                outputs: ['fastp_reports/', 'multiqc_report.html'],
            },
            {
                id: 'quantify',
                name: 'Alignment or transcript quantification',
                purpose: 'Generate gene or transcript abundance matrices for each sample.',
                skills: ['bio-expert'],
                externalTools: ['star', 'salmon', 'featurecounts'],
                outputs: ['gene_counts.tsv', 'alignment_metrics.tsv'],
            },
            {
                id: 'de',
                name: 'Differential expression analysis',
                purpose: 'Model group differences and rank significantly changing genes.',
                skills: ['pydeseq2', 'polars'],
                outputs: ['differential_expression.tsv', 'volcano_plot.png'],
            },
            {
                id: 'interpret',
                name: 'Biological interpretation',
                purpose: 'Summarize key pathways, marker genes, and biological implications.',
                skills: ['scientific-writing'],
                optional: true,
                outputs: ['analysis_summary.md'],
            },
        ],
        deliverables: ['sample_sheet.tsv', 'multiqc_report.html', 'gene_counts.tsv', 'differential_expression.tsv', 'analysis_summary.md'],
        warnings: [],
    },
    'dna-seq': {
        title: 'DNA-seq mapping and variant workflow',
        objective: 'Process DNA sequencing reads through QC, mapping, post-processing, and variant calling preparation.',
        assumptions: [
            'Input contains genomic DNA sequencing reads suitable for alignment and variant analysis.',
        ],
        preflightChecks: [
            'Confirm reference genome build and whether reads are WGS, WES, or targeted panel data.',
            'Check sample metadata for matched normal/tumor status if this is a somatic study.',
            'Verify paired-end completeness and lane merging requirements.',
        ],
        steps: [
            {
                id: 'inventory',
                name: 'Sample inventory and read pairing',
                purpose: 'Group FASTQ files into samples and confirm lane structure.',
                skills: ['bio-expert'],
                outputs: ['sample_sheet.tsv'],
            },
            {
                id: 'qc',
                name: 'Raw read QC',
                purpose: 'Assess quality, adapters, GC bias, and duplication before alignment.',
                skills: ['deeptools'],
                externalTools: ['fastp', 'multiqc'],
                outputs: ['fastp_reports/', 'multiqc_report.html'],
            },
            {
                id: 'align',
                name: 'Genome alignment and BAM preparation',
                purpose: 'Align reads to the genome, sort/index BAMs, and collect mapping metrics.',
                skills: ['pysam'],
                externalTools: ['bwa', 'samtools'],
                outputs: ['aligned_bams/', 'alignment_metrics.tsv'],
            },
            {
                id: 'call',
                name: 'Variant calling readiness',
                purpose: 'Prepare calibrated or filtered BAMs and define the variant calling branch.',
                skills: ['bio-expert'],
                externalTools: ['bcftools'],
                outputs: ['variant_calling_plan.md'],
            },
            {
                id: 'annotate',
                name: 'Variant annotation branch',
                purpose: 'Route downstream VCF outputs into gene and clinical annotation.',
                skills: ['clinvar-database', 'ensembl-database'],
                optional: true,
                outputs: ['annotated_variants.tsv'],
            },
        ],
        deliverables: ['sample_sheet.tsv', 'multiqc_report.html', 'aligned_bams/', 'variant_calling_plan.md'],
        warnings: [],
    },
    'mixed': {
        title: 'Mixed bioinformatics dataset triage',
        objective: 'Separate heterogeneous inputs into coherent analysis units and plan workflows per unit.',
        assumptions: [
            'The input directory contains more than one major data modality.',
        ],
        preflightChecks: [
            'Confirm which files belong to the same project and which are intermediate artifacts.',
            'Check whether raw and processed outputs are mixed in the same directory.',
        ],
        steps: [
            {
                id: 'partition',
                name: 'Dataset partitioning',
                purpose: 'Split files by modality and stage of analysis.',
                skills: ['bio-expert'],
                outputs: ['dataset_partitions.json'],
            },
            {
                id: 'subplans',
                name: 'Per-modality planning',
                purpose: 'Generate a focused plan for each partition.',
                skills: ['bio-expert'],
                outputs: ['subplans/'],
            },
        ],
        deliverables: ['dataset_partitions.json', 'subplans/'],
        warnings: ['Mixed directories often indicate that raw, intermediate, and final outputs are stored together.'],
    },
    'unknown': {
        title: 'Dataset reconnaissance',
        objective: 'Collect enough metadata to identify the appropriate workflow.',
        assumptions: [
            'The current file evidence is not sufficient for confident workflow selection.',
        ],
        preflightChecks: [
            'Gather sample sheet, experiment notes, and any upstream pipeline outputs.',
        ],
        steps: [
            {
                id: 'inspect',
                name: 'Manual dataset inspection',
                purpose: 'Review representative files and companion metadata.',
                skills: ['bio-expert'],
                outputs: ['inspection_notes.md'],
            },
        ],
        deliverables: ['inspection_notes.md'],
        warnings: ['Automatic planning confidence is low until additional metadata is provided.'],
    },
};

const FORMAT_TO_ANALYSIS_UNIT = {
    fastq: 'raw-sequencing',
    h5ad: 'single-cell',
    mtx: 'single-cell',
    h5: 'single-cell',
    vcf: 'variant-analysis',
    bam: 'alignment-qc',
};

const ASSAY_HINT_RULES = [
    {
        assayType: 'bulk-rnaseq',
        patterns: [/rna/i, /transcript/i, /expression/i, /featurecounts/i, /star/i, /salmon/i, /kallisto/i],
        rationale: 'File names or companion outputs contain transcriptome-oriented hints.',
    },
    {
        assayType: 'dna-seq',
        patterns: [/dna/i, /wgs/i, /wes/i, /exome/i, /variant/i, /germline/i, /somatic/i, /bwa/i],
        rationale: 'File names or companion outputs contain genome or variant-oriented hints.',
    },
    {
        assayType: 'atac-seq',
        patterns: [/atac/i, /tn5/i, /chromatin/i, /open.?chrom/i, /peaks?/i],
        rationale: 'File names or companion outputs suggest chromatin accessibility data.',
    },
    {
        assayType: 'chip-seq',
        patterns: [/chip/i, /histone/i, /tfbs/i, /narrowpeak/i, /broadpeak/i],
        rationale: 'File names or companion outputs suggest immunoprecipitation or peak-calling workflows.',
    },
];

const AGENT_STATES = {
    IDLE: 'idle',
    PROFILING: 'profiling',
    PLANNING: 'planning',
    AWAITING_CONFIRMATION: 'awaiting_confirmation',
    RUNNING: 'running',
    PREPARED: 'prepared',
    COMPLETED: 'completed',
    FAILED: 'failed',
};

const IGNORED_DIRECTORY_NAMES = new Set([
    '.git',
    'node_modules',
    'clawomics_runs',
]);

const IGNORED_FILE_NAMES = new Set([
    'analysis_bundle.json',
    'dataset_profile.json',
    'dataset_partitions.json',
    'analysis_plan.json',
    'agent_session.json',
    'run_manifest.json',
    'subplans.md',
]);

function loadInventoryStatus() {
    return {
        resourcesFile: RESOURCES_FILE,
        available: fs.existsSync(RESOURCES_FILE),
    };
}

function resolveFormatDefinition(fileName) {
    const lower = fileName.toLowerCase();
    return FORMAT_DEFINITIONS.find((definition) => definition.extensions.some((ext) => lower.endsWith(ext))) || null;
}

function sanitizeSampleId(rawValue) {
    return rawValue.replace(/[_\-.]+$/g, '') || 'unknown_sample';
}

function inferFastqSample(fileName) {
    const withoutExtension = fileName.replace(/\.(fastq|fq)(\.gz)?$/i, '');
    const pairedPatterns = [
        /^(.*?)(?:[_\-.]R)([12])(?:[_\-.]?001)?$/i,
        /^(.*?)(?:[_\-.])([12])(?:[_\-.]?001)?$/i,
    ];

    for (const pattern of pairedPatterns) {
        const match = withoutExtension.match(pattern);
        if (match) {
            return {
                sampleId: sanitizeSampleId(match[1]),
                readMate: match[2],
            };
        }
    }

    return {
        sampleId: sanitizeSampleId(withoutExtension),
        readMate: null,
    };
}

function collectFiles(targetPath, depth = DEFAULT_DEPTH, maxFiles = DEFAULT_MAX_FILES) {
    const rootPath = path.resolve(targetPath);
    const files = [];
    let directoriesVisited = 0;
    let truncated = false;

    function walk(currentPath, currentDepth) {
        if (truncated) {
            return;
        }

        const stats = fs.statSync(currentPath);
        if (stats.isFile()) {
            files.push(currentPath);
            if (files.length >= maxFiles) {
                truncated = true;
            }
            return;
        }

        if (!stats.isDirectory()) {
            return;
        }

        if (IGNORED_DIRECTORY_NAMES.has(path.basename(currentPath))) {
            return;
        }

        directoriesVisited += 1;
        if (currentDepth > depth) {
            return;
        }

        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        for (const entry of entries) {
            if (truncated) {
                break;
            }
            if (entry.isDirectory() && IGNORED_DIRECTORY_NAMES.has(entry.name)) {
                continue;
            }
            if (entry.isFile() && IGNORED_FILE_NAMES.has(entry.name)) {
                continue;
            }
            walk(path.join(currentPath, entry.name), currentDepth + 1);
        }
    }

    walk(rootPath, 0);

    return {
        rootPath,
        files,
        directoriesVisited,
        truncated,
    };
}

function displayPath(rootPath, filePath) {
    const relativePath = path.relative(rootPath, filePath);
    return relativePath && !relativePath.startsWith('..') ? relativePath : filePath;
}

function summarizeFormats(rootPath, filePaths) {
    const formats = new Map();
    const samples = new Map();
    const referenceFiles = [];
    const metadataHints = [];

    for (const filePath of filePaths) {
        const fileName = path.basename(filePath);
        const formatDefinition = resolveFormatDefinition(fileName);

        if (!formatDefinition) {
            if (/sample|metadata|design/i.test(fileName)) {
                metadataHints.push(filePath);
            }
            continue;
        }

        const record = formats.get(formatDefinition.key) || {
            key: formatDefinition.key,
            label: formatDefinition.label,
            count: 0,
            examples: [],
            files: [],
            skills: new Set(),
            externalTools: new Set(),
        };

        record.count += 1;
        if (record.examples.length < 5) {
            record.examples.push(displayPath(rootPath, filePath));
        }
        record.files.push(displayPath(rootPath, filePath));
        formatDefinition.skills.forEach((skill) => record.skills.add(skill));
        formatDefinition.externalTools.forEach((tool) => record.externalTools.add(tool));
        formats.set(formatDefinition.key, record);

        if (formatDefinition.key === 'fastq') {
            const sampleInfo = inferFastqSample(fileName);
            const sampleRecord = samples.get(sampleInfo.sampleId) || {
                sampleId: sampleInfo.sampleId,
                files: [],
                readMates: new Set(),
            };
            sampleRecord.files.push(displayPath(rootPath, filePath));
            if (sampleInfo.readMate) {
                sampleRecord.readMates.add(sampleInfo.readMate);
            }
            samples.set(sampleInfo.sampleId, sampleRecord);
        }

        if (formatDefinition.key === 'gtf' || formatDefinition.key === 'bed') {
            referenceFiles.push(displayPath(rootPath, filePath));
        }
    }

    return {
        formats: Array.from(formats.values()).map((record) => ({
            key: record.key,
            label: record.label,
            count: record.count,
            examples: record.examples,
            files: record.files.sort(),
            skills: Array.from(record.skills).sort(),
            externalTools: Array.from(record.externalTools).sort(),
        })),
        samples: Array.from(samples.values())
            .map((sample) => ({
                sampleId: sample.sampleId,
                fileCount: sample.files.length,
                pairedEnd: sample.readMates.has('1') && sample.readMates.has('2'),
                readMates: Array.from(sample.readMates).sort(),
                files: sample.files.sort(),
            }))
            .sort((left, right) => left.sampleId.localeCompare(right.sampleId)),
        referenceFiles: referenceFiles.sort(),
        metadataHints: metadataHints.sort(),
    };
}

function inferDatasetClass(summary) {
    const formatKeys = new Set(summary.formats.map((item) => item.key));
    const supportFormatKeys = new Set(['tabular', 'gtf', 'bed']);
    const modalityFlags = {
        singleCell: formatKeys.has('h5ad') || formatKeys.has('mtx'),
        variant: formatKeys.has('vcf'),
        alignment: formatKeys.has('bam'),
        rawSeq: formatKeys.has('fastq'),
    };
    const majorModalityCount = Object.values(modalityFlags).filter(Boolean).length;
    const nonSupportFormatCount = Array.from(formatKeys).filter((key) => !supportFormatKeys.has(key)).length;

    if (formatKeys.size === 0) {
        return {
            datasetClass: 'unknown',
            confidence: 'low',
            rationale: ['No recognized bioinformatics file formats were detected.'],
        };
    }

    if (majorModalityCount > 1) {
        return {
            datasetClass: 'mixed',
            confidence: 'medium',
            rationale: ['Detected files from more than one major bioinformatics modality in the same input path.'],
        };
    }

    if (modalityFlags.singleCell) {
        return {
            datasetClass: 'single-cell',
            confidence: 'high',
            rationale: ['Detected single-cell matrix formats (.h5ad or .mtx).'],
        };
    }

    if (modalityFlags.variant) {
        return {
            datasetClass: 'variant-analysis',
            confidence: nonSupportFormatCount === 1 ? 'high' : 'medium',
            rationale: ['Detected VCF or BCF files suitable for variant annotation workflows.'],
        };
    }

    if (modalityFlags.alignment) {
        return {
            datasetClass: nonSupportFormatCount === 1 ? 'alignment-qc' : 'mixed',
            confidence: nonSupportFormatCount === 1 ? 'medium' : 'medium',
            rationale: ['Detected aligned read files that require QC before downstream branching.'],
        };
    }

    if (modalityFlags.rawSeq) {
        return {
            datasetClass: nonSupportFormatCount === 1 ? 'raw-sequencing' : 'mixed',
            confidence: nonSupportFormatCount === 1 ? 'medium' : 'medium',
            rationale: ['Detected raw sequencing files, but assay type cannot be inferred from filenames alone.'],
        };
    }

    return {
        datasetClass: nonSupportFormatCount > 1 ? 'mixed' : 'unknown',
        confidence: 'low',
        rationale: ['Detected files are bioinformatics-adjacent but not sufficient for precise workflow selection.'],
    };
}

function summarizeSkillCoverage(summary) {
    const skillSet = new Set();
    const externalToolSet = new Set();

    for (const format of summary.formats) {
        format.skills.forEach((skill) => skillSet.add(skill));
        format.externalTools.forEach((tool) => externalToolSet.add(tool));
    }

    return {
        candidateSkills: Array.from(skillSet).sort(),
        externalTools: Array.from(externalToolSet).sort(),
        availableSkills: Array.from(skillSet).filter((skill) => fs.existsSync(path.join(SKILLS_DIR, skill))).sort(),
        missingSkills: Array.from(skillSet).filter((skill) => !fs.existsSync(path.join(SKILLS_DIR, skill))).sort(),
    };
}

function buildAnalysisUnits(summary) {
    const units = new Map();
    const supportFiles = [];

    for (const format of summary.formats) {
        const analysisType = FORMAT_TO_ANALYSIS_UNIT[format.key];
        if (!analysisType) {
            supportFiles.push(...format.files);
            continue;
        }

        const unit = units.get(analysisType) || {
            id: analysisType,
            analysisType,
            title: WORKFLOW_BLUEPRINTS[analysisType]?.title || analysisType,
            formats: [],
            fileCount: 0,
            representativeFiles: [],
            files: [],
        };

        unit.formats.push(format.key);
        unit.fileCount += format.count;
        unit.files.push(...format.files);
        for (const example of format.examples) {
            if (unit.representativeFiles.length < 5 && !unit.representativeFiles.includes(example)) {
                unit.representativeFiles.push(example);
            }
        }

        units.set(analysisType, unit);
    }

    return {
        units: Array.from(units.values()).map((unit, index) => ({
            id: `${unit.analysisType}-${index + 1}`,
            analysisType: unit.analysisType,
            title: unit.title,
            formats: unit.formats.sort(),
            fileCount: unit.fileCount,
            representativeFiles: unit.representativeFiles,
            files: unit.files.sort(),
        })),
        supportFiles: Array.from(new Set(supportFiles)).sort(),
    };
}

function buildAssayRouting(summary, datasetDecision) {
    if (!['raw-sequencing', 'alignment-qc', 'mixed'].includes(datasetDecision.datasetClass)) {
        return {
            status: 'not-applicable',
            candidates: [],
            questions: [],
        };
    }

    const searchableText = [
        ...summary.formats.flatMap((format) => format.files),
        ...summary.referenceFiles,
        ...summary.metadataHints,
    ].join(' ');

    const candidates = ASSAY_HINT_RULES
        .map((rule) => {
            const matches = rule.patterns.filter((pattern) => pattern.test(searchableText));
            return {
                assayType: rule.assayType,
                score: matches.length,
                confidence: matches.length >= 2 ? 'medium' : matches.length === 1 ? 'low' : 'low',
                rationale: matches.length > 0 ? [rule.rationale] : [],
            };
        })
        .filter((candidate) => candidate.score > 0)
        .sort((left, right) => right.score - left.score || left.assayType.localeCompare(right.assayType));

    if (candidates.length === 0) {
        const fallbackCandidates = summary.formats.some((format) => format.key === 'fastq')
            ? ['bulk-rnaseq', 'dna-seq', 'atac-seq']
            : ['bulk-rnaseq', 'dna-seq'];

        return {
            status: 'needs-confirmation',
            candidates: fallbackCandidates.map((assayType) => ({
                assayType,
                score: 0,
                confidence: 'low',
                rationale: ['No assay-specific hints were found in file names or companion files.'],
            })),
            questions: [
                'What protocol generated these sequencing files?',
                'Which reference genome and library design should the downstream workflow assume?',
            ],
        };
    }

    return {
        status: candidates[0].score >= 2 ? 'candidate-identified' : 'needs-confirmation',
        candidates,
        questions: [
            'Can you confirm that the top assay candidate matches the experimental protocol?',
            'Do you have sample metadata that records library type, strandedness, or target panel information?',
        ],
    };
}

function getRoutedAnalysisType(profile, requestedAnalysisType) {
    if (requestedAnalysisType) {
        return requestedAnalysisType;
    }

    if (profile.dataset.datasetClass !== 'raw-sequencing') {
        return profile.dataset.datasetClass || 'unknown';
    }

    const topCandidate = profile.routing?.candidates?.[0];
    if (profile.routing?.status === 'candidate-identified' && topCandidate?.assayType && WORKFLOW_BLUEPRINTS[topCandidate.assayType]) {
        return topCandidate.assayType;
    }

    return profile.dataset.datasetClass || 'unknown';
}

function summarizeFormatsForPeople(profile) {
    return profile.evidence.formats.map((format) => `${format.count} ${format.key}`).join(', ') || 'no recognized formats';
}

function buildAnalyzeNarrative(profile, plan, partitions) {
    const lines = [];
    const sampleCount = profile.evidence.samples.length;
    const datasetClass = profile.dataset.datasetClass;
    const plannedType = plan.analysisType;

    lines.push(`Detected ${datasetClass} input with ${summarizeFormatsForPeople(profile)}.`);

    if (sampleCount > 0) {
        lines.push(`Grouped the data into ${sampleCount} sample unit(s).`);
    }

    if (datasetClass === 'mixed' && partitions.units.length > 0) {
        const unitSummary = partitions.units.map((unit) => `${unit.analysisType} (${unit.fileCount} file${unit.fileCount === 1 ? '' : 's'})`).join(', ');
        lines.push(`Partitioned the directory into ${unitSummary}.`);
    }

    if (datasetClass === 'raw-sequencing' && profile.routing?.candidates?.length > 0) {
        const topCandidate = profile.routing.candidates[0];
        lines.push(`Top assay candidate is ${topCandidate.assayType} with ${topCandidate.confidence} confidence.`);
    }

    lines.push(`Prepared a ${plannedType} workflow plan with ${plan.steps.length} step(s).`);
    return lines.join(' ');
}

function buildConfirmationPrompt(plan, profile) {
    const firstStepNames = plan.steps.slice(0, 3).map((step) => step.name).join(' -> ');
    const questions = profile.recommendations?.nextQuestions?.slice(0, 2) || [];
    const parts = [
        `I can proceed with the ${plan.analysisType} workflow.`,
        firstStepNames ? `Initial steps: ${firstStepNames}.` : null,
        questions.length > 0 ? `Before running, please confirm: ${questions.join(' ')}` : 'Reply with confirmation when you want me to start execution.',
    ].filter(Boolean);
    return parts.join(' ');
}

function buildRunNarrative(manifest) {
    const completedCount = manifest.steps.filter((step) => step.status === 'completed').length;
    const readyCount = manifest.steps.filter((step) => step.status === 'ready').length;
    const parts = [
        `Created run workspace ${manifest.runId} for ${manifest.analysisType}.`,
        completedCount > 0 ? `${completedCount} step(s) were completed automatically.` : null,
        readyCount > 0 ? `${readyCount} step(s) were prepared as command templates for review/execution.` : null,
    ].filter(Boolean);
    return parts.join(' ');
}

function readyCountFromSteps(steps) {
    return steps.filter((step) => step.status === 'ready').length;
}

function normalizeMessagePath(rawPath, cwd = process.cwd()) {
    if (!rawPath) {
        return null;
    }

    let normalized = rawPath.trim().replace(/^["'`]|["'`]$/g, '');
    if (normalized.startsWith('~/')) {
        normalized = path.join(os.homedir(), normalized.slice(2));
    } else if (!path.isAbsolute(normalized)) {
        normalized = path.resolve(cwd, normalized);
    }

    return normalized;
}

function extractPathsFromMessage(message, cwd = process.cwd()) {
    const patterns = [
        /`([^`]+)`/g,
        /"([^"]+)"/g,
        /'([^']+)'/g,
        /((?:~\/|\/|\.\.?\/)[^\s,;:，。；：]+)/g,
    ];
    const paths = [];
    const addPathIfExists = (rawPath) => {
        const candidate = normalizeMessagePath(rawPath, cwd);
        if (candidate && fs.existsSync(candidate) && !paths.includes(candidate)) {
            paths.push(candidate);
        }
    };

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(message)) !== null) {
            addPathIfExists(match[1] || match[0]);
        }
    }

    const fallbackTokens = message
        .split(/[\s,;:，。；：!?！？()（）]+/)
        .map((token) => token.trim().replace(/^["'`]+|["'`]+$/g, '').replace(/[，。；：!?！？]+$/g, ''))
        .filter(Boolean);

    for (const token of fallbackTokens) {
        if (token === '.' || token === '..') {
            continue;
        }

        const looksPathLike = token.startsWith('~/')
            || token.startsWith('./')
            || token.startsWith('../')
            || token.startsWith('/')
            || token.includes('/')
            || token.includes('.')
            || token.includes('_')
            || token.includes('-');

        if (!looksPathLike) {
            const candidate = path.resolve(cwd, token);
            if (!fs.existsSync(candidate)) {
                continue;
            }
        }

        addPathIfExists(token);
    }

    return paths;
}

function detectConfirmationIntent(message) {
    const normalized = message.trim().toLowerCase();
    const confirmationPatterns = [
        /(^|\b)(confirm|confirmed|proceed|run it|start|go ahead|execute)(\b|$)/i,
        /(确认执行|确认|开始跑|开始执行|继续执行|运行吧|开始吧)/,
    ];
    return confirmationPatterns.some((pattern) => pattern.test(normalized));
}

function inferGoalFromMessage(message, detectedPaths) {
    let goal = message;
    for (const detectedPath of detectedPaths) {
        goal = goal.replaceAll(detectedPath, ' ');
        goal = goal.replaceAll(path.basename(detectedPath), ' ');
    }

    goal = goal
        .replace(/帮我|请|一下|分析一下|看一下|看看|有数据|数据在|这个目录|这批数据|这里有|目录里|文件夹里|there is data|help me|please|analyze it|analyze|analysis/gi, ' ')
        .replace(/[，。、“”"'`！？!?；;：:]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!goal || goal.length < 2) {
        return undefined;
    }

    return goal;
}

function buildActionHintsForAnalyze(sessionPath, inputPath) {
    return {
        primary: {
            action: 'await_user_confirmation',
            command: 'run',
            args: [inputPath, '--session', sessionPath, '--approve'],
            requiresConfirmation: true,
        },
        secondary: [
            {
                action: 'inspect_plan',
                command: 'analyze',
                args: [inputPath, '--session', sessionPath],
                requiresConfirmation: false,
            },
        ],
    };
}

function buildActionHintsForRun(sessionPath, inputPath, runDirectory, readyCount) {
    return {
        primary: readyCount > 0
            ? {
                action: 'review_generated_commands',
                path: path.join(runDirectory, 'commands'),
                requiresConfirmation: false,
            }
            : {
                action: 'inspect_run_manifest',
                path: path.join(runDirectory, 'run_manifest.json'),
                requiresConfirmation: false,
            },
        secondary: [
            {
                action: 'reload_session',
                command: 'run',
                args: [inputPath, '--session', sessionPath],
                requiresConfirmation: false,
            },
        ],
    };
}

function buildWarnings(summary, datasetDecision) {
    const warnings = [];

    if (summary.formats.some((format) => format.key === 'fastq') && summary.samples.length > 0) {
        const unpairedSamples = summary.samples.filter((sample) => !sample.pairedEnd);
        if (unpairedSamples.length > 0) {
            warnings.push(`Detected ${unpairedSamples.length} FASTQ sample group(s) without both read mates.`);
        }
    }

    if (datasetDecision.datasetClass === 'raw-sequencing') {
        warnings.push('Assay type is ambiguous. Confirm whether the reads are DNA-seq, bulk RNA-seq, ATAC-seq, or another protocol before alignment.');
    }

    if (datasetDecision.datasetClass === 'unknown') {
        warnings.push('No high-confidence workflow could be inferred from the available files.');
    }

    return warnings;
}

export function profileDataset(targetPath, options = {}) {
    const depth = Number.isInteger(options.depth) ? options.depth : DEFAULT_DEPTH;
    const maxFiles = Number.isInteger(options.maxFiles) ? options.maxFiles : DEFAULT_MAX_FILES;

    if (!fs.existsSync(targetPath)) {
        return { error: `Path not found: ${targetPath}` };
    }

    const stats = fs.statSync(targetPath);
    const fileCollection = collectFiles(targetPath, depth, maxFiles);
    const summary = summarizeFormats(fileCollection.rootPath, fileCollection.files);
    const datasetDecision = inferDatasetClass(summary);
    const coverage = summarizeSkillCoverage(summary);
    const analysisUnits = buildAnalysisUnits(summary);
    const assayRouting = buildAssayRouting(summary, datasetDecision);
    const warnings = buildWarnings(summary, datasetDecision);

    return {
        schemaVersion: PROFILE_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        projectRoot: PROJECT_ROOT,
        inventory: loadInventoryStatus(),
        input: {
            path: path.resolve(targetPath),
            kind: stats.isDirectory() ? 'directory' : 'file',
            depth,
            maxFiles,
        },
        scanSummary: {
            filesScanned: fileCollection.files.length,
            directoriesVisited: fileCollection.directoriesVisited,
            truncated: fileCollection.truncated,
        },
        dataset: {
            datasetClass: datasetDecision.datasetClass,
            confidence: datasetDecision.confidence,
            rationale: datasetDecision.rationale,
        },
        evidence: {
            formats: summary.formats,
            samples: summary.samples,
            referenceFiles: summary.referenceFiles,
            metadataHints: summary.metadataHints,
        },
        analysisUnits,
        routing: assayRouting,
        capabilities: coverage,
        recommendations: {
            candidateWorkflows: datasetDecision.datasetClass === 'mixed'
                ? ['single-cell', 'variant-analysis', 'alignment-qc', 'raw-sequencing']
                : datasetDecision.datasetClass === 'raw-sequencing'
                    ? Array.from(new Set([
                        datasetDecision.datasetClass,
                        ...(assayRouting.candidates || []).map((candidate) => candidate.assayType).filter((assayType) => WORKFLOW_BLUEPRINTS[assayType]),
                    ]))
                    : [datasetDecision.datasetClass],
            warnings,
            nextQuestions: buildNextQuestions(summary, datasetDecision),
        },
    };
}

function buildNextQuestions(summary, datasetDecision) {
    const questions = [];

    if (datasetDecision.datasetClass === 'raw-sequencing' || datasetDecision.datasetClass === 'alignment-qc') {
        questions.push('What assay produced these sequencing files: DNA-seq, bulk RNA-seq, ATAC-seq, or another protocol?');
        questions.push('Do you have a sample sheet with conditions, replicates, and reference genome information?');
    }

    if (datasetDecision.datasetClass === 'single-cell') {
        questions.push('Are there known donor or batch labels that should be corrected during integration?');
        questions.push('Do you want exploratory clustering only, or full cell-type annotation and marker analysis?');
    }

    if (summary.metadataHints.length === 0) {
        questions.push('Is there any metadata file describing sample groups or experimental design?');
    }

    return questions;
}

function createPlanStep(step, index) {
    const stepSkills = (step.skills || []).map((skill) => ({
        name: skill,
        available: fs.existsSync(path.join(SKILLS_DIR, skill)),
    }));

    return {
        order: index + 1,
        id: step.id,
        name: step.name,
        purpose: step.purpose,
        optional: Boolean(step.optional),
        skills: stepSkills,
        externalTools: step.externalTools || [],
        outputs: step.outputs || [],
    };
}

function buildSubplans(profile) {
    if (!profile.analysisUnits?.units?.length) {
        return [];
    }

    return profile.analysisUnits.units.map((unit) => {
        const blueprint = WORKFLOW_BLUEPRINTS[unit.analysisType] || WORKFLOW_BLUEPRINTS.unknown;
        return {
            id: unit.id,
            analysisType: unit.analysisType,
            title: blueprint.title,
            objective: blueprint.objective,
            fileCount: unit.fileCount,
            representativeFiles: unit.representativeFiles,
            firstSteps: blueprint.steps.slice(0, 3).map((step) => ({
                id: step.id,
                name: step.name,
                outputs: step.outputs || [],
            })),
        };
    });
}

export function buildAnalysisPlan(profile, options = {}) {
    if (!profile || profile.error) {
        return profile;
    }

    const datasetClass = getRoutedAnalysisType(profile, options.analysisType);
    const blueprint = WORKFLOW_BLUEPRINTS[datasetClass] || WORKFLOW_BLUEPRINTS.unknown;
    const planWarnings = [...(blueprint.warnings || []), ...(profile.recommendations?.warnings || [])];
    const goal = options.goal || blueprint.objective;

    return {
        schemaVersion: PLAN_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        inputPath: profile.input.path,
        analysisType: datasetClass,
        title: blueprint.title,
        objective: goal,
        confidence: profile.dataset.confidence,
        assumptions: blueprint.assumptions,
        profileSummary: {
            datasetClass: profile.dataset.datasetClass,
            rationale: profile.dataset.rationale,
            plannedAnalysisType: datasetClass,
            formats: profile.evidence.formats.map((format) => ({
                key: format.key,
                count: format.count,
                examples: format.examples,
            })),
            sampleCount: profile.evidence.samples.length,
        },
        preflightChecks: blueprint.preflightChecks,
        steps: blueprint.steps.map((step, index) => createPlanStep(step, index)),
        deliverables: blueprint.deliverables,
        warnings: Array.from(new Set(planWarnings)),
        nextQuestions: profile.recommendations?.nextQuestions || [],
        subplans: datasetClass === 'mixed' ? buildSubplans(profile) : [],
        routing: ['raw-sequencing', 'alignment-qc', 'mixed', 'bulk-rnaseq', 'dna-seq'].includes(datasetClass) ? profile.routing : undefined,
    };
}

// Backward-compatible helper for older identify flows.
export function identifyBioData(targetPath, depth = DEFAULT_DEPTH) {
    const profile = profileDataset(targetPath, { depth });
    if (profile.error) {
        return profile;
    }

    return {
        path: profile.input.path,
        type: profile.input.kind,
        datasetClass: profile.dataset.datasetClass,
        confidence: profile.dataset.confidence,
        detectedFormats: profile.evidence.formats.map((format) => ({
            format: format.label,
            key: format.key,
            count: format.count,
            examples: format.examples,
        })),
        recommendedSkills: profile.capabilities.candidateSkills,
        availableSkills: profile.capabilities.availableSkills,
        suggestions: profile.recommendations.candidateWorkflows,
        warnings: profile.recommendations.warnings,
    };
}

export function checkSkillAvailability(skillName) {
    const skillPath = path.join(SKILLS_DIR, skillName);
    const exists = fs.existsSync(skillPath);

    return {
        skill: skillName,
        available: exists,
        path: exists ? skillPath : null,
        canInstall: !exists,
    };
}

export function buildDatasetPartitions(profile) {
    if (!profile || profile.error) {
        return profile;
    }

    return {
        inputPath: profile.input.path,
        datasetClass: profile.dataset.datasetClass,
        units: profile.analysisUnits?.units || [],
        supportFiles: profile.analysisUnits?.supportFiles || [],
        routing: profile.routing,
    };
}

export function analyzeDataset(targetPath, options = {}) {
    const profile = profileDataset(targetPath, options);
    if (profile.error) {
        return profile;
    }

    const partitions = buildDatasetPartitions(profile);
    const plan = buildAnalysisPlan(profile, options);
    const sessionId = options.sessionId || makeSessionId();
    const sessionPath = path.resolve(options.session || getDefaultSessionPath(targetPath, options.outputDir));
    const assistantMessage = buildAnalyzeNarrative(profile, plan, partitions);
    const confirmationPrompt = buildConfirmationPrompt(plan, profile);
    const session = {
        schemaVersion: AGENT_PROTOCOL_VERSION,
        sessionId,
        updatedAt: new Date().toISOString(),
        agentState: AGENT_STATES.AWAITING_CONFIRMATION,
        lifecyclePhase: AGENT_STATES.PLANNING,
        inputPath: profile.input.path,
        datasetClass: profile.dataset.datasetClass,
        plannedAnalysisType: plan.analysisType,
        lastCommand: 'analyze',
        pendingConfirmation: true,
        sessionPath,
    };

    return {
        schemaVersion: AGENT_PROTOCOL_VERSION,
        generatedAt: new Date().toISOString(),
        agentState: AGENT_STATES.AWAITING_CONFIRMATION,
        lifecyclePhase: AGENT_STATES.PLANNING,
        inputPath: profile.input.path,
        datasetClass: profile.dataset.datasetClass,
        plannedAnalysisType: plan.analysisType,
        confidence: profile.dataset.confidence,
        summary: {
            rationale: profile.dataset.rationale,
            candidateWorkflows: profile.recommendations.candidateWorkflows,
            warnings: profile.recommendations.warnings,
            nextQuestions: profile.recommendations.nextQuestions,
        },
        conversation: {
            assistantMessage,
            confirmationPrompt,
            canRun: true,
            requiresConfirmation: true,
            suggestedUserReplies: ['确认执行', '先解释一下计划', '修改分析目标'],
        },
        session,
        actionHints: buildActionHintsForAnalyze(sessionPath, profile.input.path),
        profile,
        partitions,
        plan,
        nextAction: 'Review the plan with the user and run only after explicit confirmation.',
    };
}

function createSampleRows(profile) {
    if (profile.evidence.samples.length > 0) {
        return profile.evidence.samples.map((sample) => ({
            sample_id: sample.sampleId,
            file_count: String(sample.fileCount),
            paired_end: sample.pairedEnd ? 'yes' : 'no',
            read_mates: sample.readMates.join(','),
            files: sample.files.join(','),
        }));
    }

    return profile.evidence.formats.flatMap((format) => format.files.map((file) => ({
        sample_id: path.basename(file),
        file_count: '1',
        paired_end: 'unknown',
        read_mates: '',
        files: file,
    })));
}

function buildRoutingMarkdown(routing) {
    const lines = ['# Assay Routing', ''];
    lines.push(`Status: ${routing.status}`);
    lines.push('');
    if (routing.candidates?.length) {
        lines.push('## Candidates');
        lines.push('');
        for (const candidate of routing.candidates) {
            lines.push(`- ${candidate.assayType} (confidence: ${candidate.confidence}, score: ${candidate.score})`);
            for (const rationale of candidate.rationale || []) {
                lines.push(`  - ${rationale}`);
            }
        }
        lines.push('');
    }
    if (routing.questions?.length) {
        lines.push('## Questions');
        lines.push('');
        for (const question of routing.questions) {
            lines.push(`- ${question}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}

function buildSubplansMarkdown(subplans) {
    const lines = ['# Subplans', ''];
    for (const subplan of subplans) {
        lines.push(`## ${subplan.title} (${subplan.analysisType})`);
        lines.push('');
        lines.push(`Representative files: ${subplan.representativeFiles.join(', ') || 'n/a'}`);
        lines.push('');
        for (const step of subplan.firstSteps) {
            lines.push(`- ${step.name}: ${step.outputs.join(', ') || 'no declared outputs'}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}

function buildCommandTemplate(plan, profile, step, scriptPath) {
    const sampleFiles = profile.evidence.samples.map((sample) => sample.files);
    const flatSampleFiles = sampleFiles.flat();
    const vcfFiles = profile.evidence.formats.filter((format) => format.key === 'vcf').flatMap((format) => format.files);
    const bamFiles = profile.evidence.formats.filter((format) => format.key === 'bam').flatMap((format) => format.files);
    const lines = ['#!/usr/bin/env bash', 'set -euo pipefail', '', `cd "${path.dirname(profile.input.path)}"`, ''];

    if (plan.analysisType === 'bulk-rnaseq' && step.id === 'qc') {
        lines.push('OUT_DIR="${OUT_DIR:-./qc}"', 'mkdir -p "$OUT_DIR"', '');
        for (const sample of profile.evidence.samples) {
            const read1 = sample.files.find((file) => /(?:^|[_\-.])R?1(?:[_\-.]|$)/i.test(path.basename(file)));
            const read2 = sample.files.find((file) => /(?:^|[_\-.])R?2(?:[_\-.]|$)/i.test(path.basename(file)));
            if (read1 && read2) {
                lines.push(`fastp -i "${read1}" -I "${read2}" -o "$OUT_DIR/${sample.sampleId}_R1.trimmed.fastq.gz" -O "$OUT_DIR/${sample.sampleId}_R2.trimmed.fastq.gz" -h "$OUT_DIR/${sample.sampleId}.html" -j "$OUT_DIR/${sample.sampleId}.json"`);
            } else if (read1) {
                lines.push(`fastp -i "${read1}" -o "$OUT_DIR/${sample.sampleId}.trimmed.fastq.gz" -h "$OUT_DIR/${sample.sampleId}.html" -j "$OUT_DIR/${sample.sampleId}.json"`);
            }
        }
        lines.push('multiqc "$OUT_DIR" -o "$OUT_DIR/multiqc"');
        return lines.join('\n');
    }

    if (plan.analysisType === 'bulk-rnaseq' && step.id === 'quantify') {
        lines.push('REF_INDEX="${REF_INDEX:-/path/to/salmon_or_star_index}"', 'OUT_DIR="${OUT_DIR:-./quant}"', 'mkdir -p "$OUT_DIR"', '');
        for (const sample of profile.evidence.samples) {
            const read1 = sample.files.find((file) => /(?:^|[_\-.])R?1(?:[_\-.]|$)/i.test(path.basename(file)));
            const read2 = sample.files.find((file) => /(?:^|[_\-.])R?2(?:[_\-.]|$)/i.test(path.basename(file)));
            if (read1 && read2) {
                lines.push(`salmon quant -i "$REF_INDEX" -l A -1 "${read1}" -2 "${read2}" -o "$OUT_DIR/${sample.sampleId}"`);
            }
        }
        return lines.join('\n');
    }

    if (plan.analysisType === 'dna-seq' && step.id === 'qc') {
        lines.push('OUT_DIR="${OUT_DIR:-./qc}"', 'mkdir -p "$OUT_DIR"', '');
        for (const sample of profile.evidence.samples) {
            const read1 = sample.files.find((file) => /(?:^|[_\-.])R?1(?:[_\-.]|$)/i.test(path.basename(file)));
            const read2 = sample.files.find((file) => /(?:^|[_\-.])R?2(?:[_\-.]|$)/i.test(path.basename(file)));
            if (read1 && read2) {
                lines.push(`fastp -i "${read1}" -I "${read2}" -o "$OUT_DIR/${sample.sampleId}_R1.trimmed.fastq.gz" -O "$OUT_DIR/${sample.sampleId}_R2.trimmed.fastq.gz" -h "$OUT_DIR/${sample.sampleId}.html" -j "$OUT_DIR/${sample.sampleId}.json"`);
            }
        }
        lines.push('multiqc "$OUT_DIR" -o "$OUT_DIR/multiqc"');
        return lines.join('\n');
    }

    if (plan.analysisType === 'dna-seq' && step.id === 'align') {
        lines.push('REFERENCE_FA="${REFERENCE_FA:-/path/to/reference.fa}"', 'OUT_DIR="${OUT_DIR:-./aligned_bams}"', 'mkdir -p "$OUT_DIR"', '');
        for (const sample of profile.evidence.samples) {
            const read1 = sample.files.find((file) => /(?:^|[_\-.])R?1(?:[_\-.]|$)/i.test(path.basename(file)));
            const read2 = sample.files.find((file) => /(?:^|[_\-.])R?2(?:[_\-.]|$)/i.test(path.basename(file)));
            if (read1 && read2) {
                lines.push(`bwa mem "$REFERENCE_FA" "${read1}" "${read2}" | samtools sort -o "$OUT_DIR/${sample.sampleId}.bam"`);
                lines.push(`samtools index "$OUT_DIR/${sample.sampleId}.bam"`);
            }
        }
        return lines.join('\n');
    }

    if (plan.analysisType === 'variant-analysis' && step.id === 'validate') {
        lines.push('OUT_DIR="${OUT_DIR:-./validated_variants}"', 'mkdir -p "$OUT_DIR"', '');
        for (const vcfFile of vcfFiles) {
            const base = path.basename(vcfFile).replace(/\.vcf(\.gz)?$/i, '');
            lines.push(`bcftools norm -m -both "${vcfFile}" -Oz -o "$OUT_DIR/${base}.normalized.vcf.gz"`);
            lines.push(`bcftools index "$OUT_DIR/${base}.normalized.vcf.gz"`);
        }
        return lines.join('\n');
    }

    if (plan.analysisType === 'alignment-qc' && step.id === 'validate') {
        lines.push('OUT_DIR="${OUT_DIR:-./alignment_validation}"', 'mkdir -p "$OUT_DIR"', '');
        for (const bamFile of bamFiles) {
            lines.push(`samtools quickcheck -v "${bamFile}" > "$OUT_DIR/${path.basename(bamFile)}.quickcheck.txt" || true`);
        }
        return lines.join('\n');
    }

    if (plan.analysisType === 'alignment-qc' && step.id === 'qc') {
        lines.push('OUT_DIR="${OUT_DIR:-./alignment_qc}"', 'mkdir -p "$OUT_DIR"', '');
        if (bamFiles.length > 0) {
            lines.push(`multiBamSummary bins --bamfiles ${bamFiles.map((file) => `"${file}"`).join(' ')} -o "$OUT_DIR/multibam_summary.npz"`);
            lines.push('multiqc "$OUT_DIR" -o "$OUT_DIR/multiqc"');
        }
        return lines.join('\n');
    }

    if (plan.analysisType === 'raw-sequencing' && step.id === 'qc') {
        lines.push('OUT_DIR="${OUT_DIR:-./qc}"', 'mkdir -p "$OUT_DIR"', '');
        for (const sample of profile.evidence.samples) {
            const read1 = sample.files.find((file) => /(?:^|[_\-.])R?1(?:[_\-.]|$)/i.test(path.basename(file)));
            const read2 = sample.files.find((file) => /(?:^|[_\-.])R?2(?:[_\-.]|$)/i.test(path.basename(file)));
            if (read1 && read2) {
                lines.push(`fastp -i "${read1}" -I "${read2}" -o "$OUT_DIR/${sample.sampleId}_R1.trimmed.fastq.gz" -O "$OUT_DIR/${sample.sampleId}_R2.trimmed.fastq.gz" -h "$OUT_DIR/${sample.sampleId}.html" -j "$OUT_DIR/${sample.sampleId}.json"`);
            } else if (read1) {
                lines.push(`fastp -i "${read1}" -o "$OUT_DIR/${sample.sampleId}.trimmed.fastq.gz" -h "$OUT_DIR/${sample.sampleId}.html" -j "$OUT_DIR/${sample.sampleId}.json"`);
            }
        }
        lines.push('multiqc "$OUT_DIR" -o "$OUT_DIR/multiqc"');
        return lines.join('\n');
    }

    lines.push(`# No concrete command template is implemented yet for ${plan.analysisType}/${step.id}.`);
    lines.push(`# Implement this step manually or extend bio-expert.`);
    return lines.join('\n');
}

function executePlanStep(step, context) {
    const { profile, partitions, plan, runDirectory } = context;
    const result = {
        order: step.order,
        id: step.id,
        name: step.name,
        status: 'ready',
        outputs: [],
        notes: [],
    };

    const outputFiles = [];
    const primaryOutput = step.outputs?.[0] ? path.join(runDirectory, step.outputs[0]) : null;

    if (step.id === 'inventory') {
        const destination = primaryOutput || path.join(runDirectory, 'sample_inventory.tsv');
        writeTsv(destination, ['sample_id', 'file_count', 'paired_end', 'read_mates', 'files'], createSampleRows(profile));
        outputFiles.push(destination);
        result.status = 'completed';
        result.notes.push('Generated sample inventory from profiled inputs.');
    } else if (step.id === 'partition') {
        const destination = primaryOutput || path.join(runDirectory, 'dataset_partitions.json');
        writeJsonArtifact('partition', profile.input.path, partitions, destination);
        outputFiles.push(destination);
        result.status = 'completed';
        result.notes.push('Wrote dataset partitions for mixed input triage.');
    } else if (step.id === 'subplans') {
        const destination = path.join(runDirectory, 'subplans.md');
        writeTextFile(destination, buildSubplansMarkdown(plan.subplans || []));
        outputFiles.push(destination);
        result.status = 'completed';
        result.notes.push('Wrote human-readable subplans for each analysis unit.');
    } else if (step.id === 'route' || step.id === 'branch') {
        const destination = primaryOutput || path.join(runDirectory, `${step.id}.md`);
        writeTextFile(destination, buildRoutingMarkdown(profile.routing || { status: 'not-applicable', candidates: [], questions: [] }));
        outputFiles.push(destination);
        result.status = 'completed';
        result.notes.push('Wrote routing decision notes.');
    } else if (step.id === 'call') {
        const destination = primaryOutput || path.join(runDirectory, 'variant_calling_plan.md');
        const content = [
            '# Variant Calling Branch',
            '',
            `Planned analysis type: ${plan.analysisType}`,
            '',
            'Expected next branch:',
            '- align reads',
            '- prepare sorted/indexed BAMs',
            '- select germline or somatic variant caller based on study design',
        ].join('\n');
        writeTextFile(destination, content);
        outputFiles.push(destination);
        result.status = 'completed';
        result.notes.push('Created a branch note for downstream variant calling.');
    } else {
        const scriptName = `${String(step.order).padStart(2, '0')}_${step.id}.sh`;
        const scriptPath = path.join(runDirectory, 'commands', scriptName);
        writeTextFile(scriptPath, buildCommandTemplate(plan, profile, step, scriptPath), true);
        outputFiles.push(scriptPath);
        result.status = 'ready';
        result.notes.push('Generated a command template for this step. Review paths and references before execution.');
    }

    result.outputs = outputFiles.map((file) => path.relative(runDirectory, file) || path.basename(file));
    return result;
}

export function runAnalysis(targetPath, options = {}) {
    const sessionRecord = options.session ? loadSession(options.session) : null;
    if (sessionRecord?.error) {
        return sessionRecord;
    }

    const effectiveTargetPath = sessionRecord?.inputPath || targetPath;
    const analyzeOptions = {
        ...options,
        sessionId: sessionRecord?.sessionId,
        outputDir: options.outputDir || (sessionRecord?.sessionPath ? path.dirname(sessionRecord.sessionPath) : options.outputDir),
    };
    const analysis = analyzeDataset(effectiveTargetPath, analyzeOptions);
    if (analysis.error) {
        return analysis;
    }

    const runId = makeRunId();
    const runDirectory = path.resolve(options.outputDir || getDefaultRunDirectory(effectiveTargetPath, runId));
    const sessionPath = path.resolve(options.session || getDefaultSessionPath(effectiveTargetPath, analyzeOptions.outputDir));

    if (!options.approve) {
        const blockedResponse = {
            schemaVersion: AGENT_PROTOCOL_VERSION,
            runId,
            createdAt: new Date().toISOString(),
            agentState: AGENT_STATES.AWAITING_CONFIRMATION,
            lifecyclePhase: AGENT_STATES.AWAITING_CONFIRMATION,
            status: AGENT_STATES.AWAITING_CONFIRMATION,
            message: 'Run blocked until the user explicitly confirms execution. Re-run with --approve after confirmation.',
            inputPath: analysis.inputPath,
            plannedAnalysisType: analysis.plan.analysisType,
            suggestedRunDirectory: runDirectory,
            requiredConfirmation: true,
            session: {
                ...(analysis.session || {}),
                sessionPath,
                pendingConfirmation: true,
                lastCommand: 'run',
            },
            conversation: {
                assistantMessage: `The ${analysis.plan.analysisType} plan is ready but execution is blocked until the user confirms.`,
                confirmationPrompt: 'Reply with a clear confirmation, then call run with --approve.',
                canRun: true,
                requiresConfirmation: true,
                suggestedUserReplies: ['确认执行', '先查看运行目录', '修改计划后再运行'],
            },
            actionHints: buildActionHintsForAnalyze(sessionPath, analysis.inputPath),
        };
        if (options.write || options.session) {
            writeSessionArtifact(effectiveTargetPath, blockedResponse.session, sessionPath, analyzeOptions.outputDir);
        }
        return blockedResponse;
    }

    fs.mkdirSync(runDirectory, { recursive: true });

    const profilePath = writeJsonArtifact('profile', effectiveTargetPath, analysis.profile, path.join(runDirectory, 'dataset_profile.json'));
    const partitionPath = writeJsonArtifact('partition', effectiveTargetPath, analysis.partitions, path.join(runDirectory, 'dataset_partitions.json'));
    const planPath = writeJsonArtifact('plan', effectiveTargetPath, analysis.plan, path.join(runDirectory, 'analysis_plan.json'));

    const stepResults = analysis.plan.steps.map((step) => executePlanStep(step, {
        profile: analysis.profile,
        partitions: analysis.partitions,
        plan: analysis.plan,
        runDirectory,
    }));

    const overallStatus = stepResults.some((step) => step.status === 'ready') ? 'prepared' : 'completed';
    const session = {
        ...(analysis.session || {}),
        sessionPath,
        updatedAt: new Date().toISOString(),
        agentState: overallStatus === AGENT_STATES.COMPLETED ? AGENT_STATES.COMPLETED : AGENT_STATES.PREPARED,
        lifecyclePhase: AGENT_STATES.RUNNING,
        pendingConfirmation: false,
        lastCommand: 'run',
        currentRunId: runId,
        currentRunDirectory: runDirectory,
    };
    const manifest = {
        schemaVersion: AGENT_PROTOCOL_VERSION,
        runId,
        createdAt: new Date().toISOString(),
        agentState: overallStatus === AGENT_STATES.COMPLETED ? AGENT_STATES.COMPLETED : AGENT_STATES.PREPARED,
        lifecyclePhase: AGENT_STATES.RUNNING,
        status: overallStatus,
        inputPath: analysis.inputPath,
        analysisType: analysis.plan.analysisType,
        runDirectory,
        artifacts: {
            profile: profilePath,
            partitions: partitionPath,
            plan: planPath,
        },
        steps: stepResults,
        notes: [
            'Internal planning artifacts were generated successfully.',
            'Steps marked "ready" still require review and execution of the generated command templates.',
        ],
    };

    const manifestPath = path.join(runDirectory, 'run_manifest.json');
    writeTextFile(manifestPath, JSON.stringify(manifest, null, 2));
    writeSessionArtifact(effectiveTargetPath, session, sessionPath, analyzeOptions.outputDir);

    return {
        ...manifest,
        session,
        conversation: {
            assistantMessage: buildRunNarrative(manifest),
            confirmationPrompt: readyCountFromSteps(stepResults) > 0
                ? 'Review the generated command templates before executing them.'
                : 'The bootstrap run completed without pending command templates.',
            canRun: false,
            requiresConfirmation: false,
            suggestedUserReplies: readyCountFromSteps(stepResults) > 0
                ? ['查看生成的命令脚本', '继续执行这些步骤', '解释当前运行状态']
                : ['查看运行摘要', '解释当前产物'],
        },
        actionHints: buildActionHintsForRun(sessionPath, effectiveTargetPath, runDirectory, readyCountFromSteps(stepResults)),
        artifacts: {
            ...manifest.artifacts,
            manifest: manifestPath,
        },
    };
}

function getArtifactBaseDirectory(inputPath) {
    const absoluteInput = path.resolve(inputPath);
    const stats = fs.existsSync(absoluteInput) ? fs.statSync(absoluteInput) : null;
    if (stats?.isDirectory()) {
        return absoluteInput;
    }
    return path.dirname(absoluteInput);
}

function resolveArtifactDirectory(inputPath, outputDir) {
    return path.resolve(outputDir || getArtifactBaseDirectory(inputPath));
}

function getDefaultArtifactPath(command, inputPath, outputDir) {
    const fileNames = {
        analyze: 'analysis_bundle.json',
        profile: 'dataset_profile.json',
        partition: 'dataset_partitions.json',
        plan: 'analysis_plan.json',
        session: 'agent_session.json',
    };

    return path.join(resolveArtifactDirectory(inputPath, outputDir), fileNames[command] || `${command}.json`);
}

function writeJsonArtifact(command, inputPath, value, outputPath, outputDir) {
    const destination = path.resolve(outputPath || getDefaultArtifactPath(command, inputPath, outputDir));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`);
    return destination;
}

function writeTextFile(destination, content, executable = false) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content.endsWith('\n') ? content : `${content}\n`);
    if (executable) {
        fs.chmodSync(destination, 0o755);
    }
}

function writeTsv(destination, headers, rows) {
    const lines = [headers.join('\t'), ...rows.map((row) => headers.map((header) => row[header] ?? '').join('\t'))];
    writeTextFile(destination, lines.join('\n'));
}

function makeRunId() {
    return `run-${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', 'T')}`;
}

function getDefaultRunDirectory(inputPath, runId) {
    return path.join(getArtifactBaseDirectory(inputPath), 'clawomics_runs', runId);
}

function makeSessionId() {
    return `session-${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', 'T')}`;
}

function getDefaultSessionPath(inputPath, outputDir) {
    return getDefaultArtifactPath('session', inputPath, outputDir);
}

function writeSessionArtifact(inputPath, session, outputPath, outputDir) {
    return writeJsonArtifact('session', inputPath, session, outputPath, outputDir);
}

function loadSession(sessionPath) {
    const absolutePath = path.resolve(sessionPath);
    if (!fs.existsSync(absolutePath)) {
        return { error: `Session file not found: ${sessionPath}` };
    }

    const raw = fs.readFileSync(absolutePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
        ...parsed,
        sessionPath: absolutePath,
    };
}

export function getAgentSession(sessionPath) {
    return loadSession(sessionPath);
}

export function handleAgentMessage(message, options = {}) {
    const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
    const detectedPaths = extractPathsFromMessage(message, cwd);
    const sessionPath = options.session || (detectedPaths[0] ? path.join(detectedPaths[0], 'agent_session.json') : null);
    const isConfirmation = detectConfirmationIntent(message);

    if (isConfirmation) {
        if (sessionPath && fs.existsSync(path.resolve(sessionPath))) {
            const targetPath = detectedPaths[0] || undefined;
            const runResult = runAnalysis(targetPath || '.', {
                ...options,
                session: sessionPath,
                approve: true,
            });
            return {
                schemaVersion: AGENT_PROTOCOL_VERSION,
                command: 'agent',
                mode: 'run',
                userMessage: message,
                detectedPaths,
                response: runResult,
            };
        }

        return {
            schemaVersion: AGENT_PROTOCOL_VERSION,
            command: 'agent',
            mode: 'needs_session',
            userMessage: message,
            detectedPaths,
            response: {
                agentState: AGENT_STATES.AWAITING_CONFIRMATION,
                lifecyclePhase: AGENT_STATES.AWAITING_CONFIRMATION,
                conversation: {
                    assistantMessage: 'I received a confirmation request, but there is no persisted ClawOmics session to resume.',
                    confirmationPrompt: 'Please provide the data path again or point me to an existing agent_session.json file.',
                    canRun: false,
                    requiresConfirmation: false,
                    suggestedUserReplies: ['数据在 /path/to/data', '先重新分析数据'],
                },
            },
        };
    }

    if (detectedPaths.length > 0) {
        const targetPath = detectedPaths[0];
        const goal = options.goal || inferGoalFromMessage(message, detectedPaths);
        const analyzeResult = analyzeDataset(targetPath, {
            ...options,
            goal,
            cwd,
            session: sessionPath,
        });
        return {
            schemaVersion: AGENT_PROTOCOL_VERSION,
            command: 'agent',
            mode: 'analyze',
            userMessage: message,
            detectedPaths,
            response: analyzeResult,
        };
    }

    return {
        schemaVersion: AGENT_PROTOCOL_VERSION,
        command: 'agent',
        mode: 'needs_path',
        userMessage: message,
        detectedPaths: [],
        response: {
            agentState: AGENT_STATES.IDLE,
            lifecyclePhase: AGENT_STATES.IDLE,
            conversation: {
                assistantMessage: 'I need a concrete data path before I can profile or plan the analysis.',
                confirmationPrompt: 'Please tell me where the dataset is located, for example `/data/project1`.',
                canRun: false,
                requiresConfirmation: false,
                suggestedUserReplies: ['数据在 /path/to/data', '帮我分析 /path/to/data'],
            },
        },
    };
}

export function getWorkflowTemplate(dataType) {
    const blueprint = WORKFLOW_BLUEPRINTS[dataType];
    if (!blueprint) {
        return { error: `No template found for type: ${dataType}` };
    }

    return {
        analysisType: dataType,
        title: blueprint.title,
        objective: blueprint.objective,
        steps: blueprint.steps,
        deliverables: blueprint.deliverables,
        warnings: blueprint.warnings,
    };
}

export function interpretResults(resultsPath, context = '', format = 'technical-report') {
    if (!fs.existsSync(resultsPath)) {
        return { error: `Results path not found: ${resultsPath}` };
    }

    return {
        resultsPath: path.resolve(resultsPath),
        context,
        format,
        interpretationReady: true,
        sections: [
            'Data Quality Summary',
            'Key Findings',
            'Biological Interpretation',
            'Recommended Next Steps',
        ],
        note: 'Full AI interpretation still depends on the OpenClaw model layer.',
    };
}

function parseCliArguments(args) {
    const options = {};
    const positional = [];

    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (token === '--depth') {
            options.depth = Number.parseInt(args[index + 1], 10);
            index += 1;
        } else if (token === '--max-files') {
            options.maxFiles = Number.parseInt(args[index + 1], 10);
            index += 1;
        } else if (token === '--goal') {
            options.goal = args[index + 1];
            index += 1;
        } else if (token === '--analysis-type') {
            options.analysisType = args[index + 1];
            index += 1;
        } else if (token === '--write') {
            options.write = true;
        } else if (token === '--output') {
            options.output = args[index + 1];
            index += 1;
        } else if (token === '--output-dir') {
            options.outputDir = args[index + 1];
            index += 1;
        } else if (token === '--session') {
            options.session = args[index + 1];
            index += 1;
        } else if (token === '--approve') {
            options.approve = true;
        } else {
            positional.push(token);
        }
    }

    return { positional, options };
}

function printJson(value) {
    console.log(JSON.stringify(value, null, 2));
}

function emitCommandResult(command, inputPath, value, options) {
    printJson(value);

    if (!options.write && !options.output) {
        return;
    }

    const destination = writeJsonArtifact(command, inputPath, value, options.output, options.outputDir);
    console.error(`Wrote ${command} artifact to ${destination}`);
}

function emitAnalyzeResult(inputPath, value, options) {
    printJson(value);

    if (!options.write && !options.output) {
        return;
    }

    const outputDir = resolveArtifactDirectory(inputPath, options.outputDir);
    const bundlePath = writeJsonArtifact('analyze', inputPath, value, options.output, outputDir);
    const profilePath = writeJsonArtifact('profile', inputPath, value.profile, null, outputDir);
    const partitionPath = writeJsonArtifact('partition', inputPath, value.partitions, null, outputDir);
    const planPath = writeJsonArtifact('plan', inputPath, value.plan, null, outputDir);
    const sessionPath = writeSessionArtifact(inputPath, value.session, options.session, outputDir);
    console.error(`Wrote analyze bundle to ${bundlePath}`);
    console.error(`Wrote profile artifact to ${profilePath}`);
    console.error(`Wrote partition artifact to ${partitionPath}`);
    console.error(`Wrote plan artifact to ${planPath}`);
    console.error(`Wrote session artifact to ${sessionPath}`);
}

function emitAgentResult(message, value, options) {
    printJson(value);

    if (value.mode !== 'analyze' || !options.write) {
        return;
    }

    const response = value.response;
    const outputDir = resolveArtifactDirectory(response.inputPath, options.outputDir);
    const bundlePath = writeJsonArtifact('analyze', response.inputPath, response, options.output, outputDir);
    const profilePath = writeJsonArtifact('profile', response.inputPath, response.profile, null, outputDir);
    const partitionPath = writeJsonArtifact('partition', response.inputPath, response.partitions, null, outputDir);
    const planPath = writeJsonArtifact('plan', response.inputPath, response.plan, null, outputDir);
    const sessionPath = writeSessionArtifact(response.inputPath, response.session, options.session, outputDir);
    console.error(`Wrote agent analyze bundle to ${bundlePath}`);
    console.error(`Wrote profile artifact to ${profilePath}`);
    console.error(`Wrote partition artifact to ${partitionPath}`);
    console.error(`Wrote plan artifact to ${planPath}`);
    console.error(`Wrote session artifact to ${sessionPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const command = process.argv[2];
    const { positional, options } = parseCliArguments(process.argv.slice(3));

    switch (command) {
        case 'identify': {
            const targetPath = positional[0] || '.';
            printJson(identifyBioData(targetPath, options.depth));
            break;
        }
        case 'profile': {
            const targetPath = positional[0] || '.';
            emitCommandResult('profile', targetPath, profileDataset(targetPath, options), options);
            break;
        }
        case 'analyze': {
            const targetPath = positional[0] || '.';
            emitAnalyzeResult(targetPath, analyzeDataset(targetPath, options), options);
            break;
        }
        case 'agent': {
            const message = positional.join(' ').trim();
            if (!message) {
                console.error('Usage: node orchestrator.mjs agent "<user-message>" [--session file] [--write]');
                process.exit(1);
            }
            emitAgentResult(message, handleAgentMessage(message, options), options);
            break;
        }
        case 'plan': {
            const targetPath = positional[0] || '.';
            const profile = profileDataset(targetPath, options);
            emitCommandResult('plan', targetPath, buildAnalysisPlan(profile, options), options);
            break;
        }
        case 'partition': {
            const targetPath = positional[0] || '.';
            const profile = profileDataset(targetPath, options);
            emitCommandResult('partition', targetPath, buildDatasetPartitions(profile), options);
            break;
        }
        case 'run': {
            const targetPath = positional[0] || '.';
            printJson(runAnalysis(targetPath, options));
            break;
        }
        case 'session': {
            const sessionPath = positional[0] || options.session;
            if (!sessionPath) {
                console.error('Usage: node orchestrator.mjs session <session-file>');
                process.exit(1);
            }
            printJson(getAgentSession(sessionPath));
            break;
        }
        case 'check': {
            const skillToCheck = positional[0];
            if (!skillToCheck) {
                console.error('Usage: node orchestrator.mjs check <skill-name>');
                process.exit(1);
            }
            printJson(checkSkillAvailability(skillToCheck));
            break;
        }
        case 'template': {
            const dataType = positional[0];
            if (!dataType) {
                console.error('Usage: node orchestrator.mjs template <analysis-type>');
                console.error('Available types: single-cell, variant-analysis, alignment-qc, raw-sequencing, bulk-rnaseq, dna-seq, mixed, unknown');
                process.exit(1);
            }
            printJson(getWorkflowTemplate(dataType));
            break;
        }
        default:
            console.log('ClawOmics Bio-Expert Orchestrator');
            console.log('Usage:');
            console.log('  node orchestrator.mjs agent "<user-message>" [--session file] [--write] [--output-dir dir]');
            console.log('  node orchestrator.mjs analyze [path] [--goal "..."] [--write] [--output-dir dir] [--session file]');
            console.log('  node orchestrator.mjs profile [path] [--depth N] [--max-files N] [--write] [--output file] [--output-dir dir]');
            console.log('  node orchestrator.mjs plan [path] [--goal "..."] [--analysis-type TYPE] [--write] [--output file] [--output-dir dir]');
            console.log('  node orchestrator.mjs partition [path] [--write] [--output file] [--output-dir dir]');
            console.log('  node orchestrator.mjs run [path] [--session file] [--output-dir dir] [--approve]');
            console.log('  node orchestrator.mjs session <session-file>');
            console.log('  node orchestrator.mjs identify [path]');
            console.log('  node orchestrator.mjs check <skill>');
            console.log('  node orchestrator.mjs template <analysis-type>');
    }
}
