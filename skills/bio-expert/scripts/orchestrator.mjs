#!/usr/bin/env node
/**
 * Bio-Expert Orchestrator Core
 * The execution engine for ClawOmics workflow management
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

const SKILLS_DIR = path.join(os.homedir(), 'clawomics', 'skills');
const RESOURCES_FILE = path.join(os.homedir(), 'clawomics', 'docs', 'RESOURCES.md');

// Tool: identify_bio_data
export function identifyBioData(filePath, depth = 1) {
    console.log(`🔍 Analyzing: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
        return { error: `Path not found: ${filePath}` };
    }

    const stats = fs.statSync(filePath);
    const results = {
        path: filePath,
        type: stats.isDirectory() ? 'directory' : 'file',
        detectedFormats: [],
        recommendedSkills: [],
        suggestions: []
    };

    // File extension mapping
    const formatMap = {
        '.fastq': { type: 'NGS Raw Reads', skills: ['biopython', 'fastp', 'multiqc'] },
        '.fq': { type: 'NGS Raw Reads', skills: ['biopython', 'fastp', 'multiqc'] },
        '.bam': { type: 'Aligned Reads', skills: ['pysam', 'deeptools', 'samtools'] },
        '.sam': { type: 'Aligned Reads', skills: ['pysam', 'samtools'] },
        '.vcf': { type: 'Variant Calls', skills: ['pysam', 'bcftools', 'query-clinvar'] },
        '.h5ad': { type: 'Single-Cell Data', skills: ['scanpy', 'anndata', 'scvi-tools'] },
        '.h5': { type: 'Hierarchical Data', skills: ['scanpy', 'anndata'] },
        '.mtx': { type: 'Matrix Data', skills: ['scanpy', 'anndata'] },
        '.gtf': { type: 'Gene Annotation', skills: ['biopython', 'gffutils'] },
        '.gff': { type: 'Gene Annotation', skills: ['biopython', 'gffutils'] },
        '.bed': { type: 'Genomic Intervals', skills: ['bedtools', 'deeptools'] },
        '.xml': { type: 'SBML/Metadata', skills: ['cobrapy', 'biopython'] },
        '.csv': { type: 'Tabular Data', skills: ['pandas', 'polars'] },
        '.tsv': { type: 'Tabular Data', skills: ['pandas', 'polars'] }
    };

    if (stats.isDirectory()) {
        // Scan directory
        const entries = fs.readdirSync(filePath, { withFileTypes: true });
        const files = entries.filter(e => e.isFile()).slice(0, 50); // Limit scan
        
        for (const file of files) {
            const ext = path.extname(file.name).toLowerCase();
            if (formatMap[ext] && !results.detectedFormats.find(f => f.format === formatMap[ext].type)) {
                results.detectedFormats.push({
                    format: formatMap[ext].type,
                    extension: ext,
                    example: file.name
                });
                formatMap[ext].skills.forEach(skill => {
                    if (!results.recommendedSkills.includes(skill)) {
                        results.recommendedSkills.push(skill);
                    }
                });
            }
        }

        if (results.detectedFormats.length === 0) {
            results.suggestions.push("No standard bioinformatics formats detected. Ensure files have proper extensions.");
        }
    } else {
        // Single file analysis
        const ext = path.extname(filePath).toLowerCase();
        if (formatMap[ext]) {
            results.detectedFormats.push({
                format: formatMap[ext].type,
                extension: ext
            });
            results.recommendedSkills = formatMap[ext].skills;
        }
    }

    // Add workflow suggestions
    if (results.detectedFormats.some(f => f.format === 'NGS Raw Reads')) {
        results.suggestions.push("Suggested workflow: QC (fastp) → Alignment → Quantification → Downstream Analysis");
    }
    if (results.detectedFormats.some(f => f.format === 'Single-Cell Data')) {
        results.suggestions.push("Suggested workflow: QC → Normalization → Batch Correction → Clustering → Annotation");
    }

    return results;
}

// Tool: checkSkillAvailability
export function checkSkillAvailability(skillName) {
    const skillPath = path.join(SKILLS_DIR, skillName);
    const exists = fs.existsSync(skillPath);
    
    return {
        skill: skillName,
        available: exists,
        path: exists ? skillPath : null,
        canInstall: !exists // Could add logic to check if installable
    };
}

// Tool: getWorkflowTemplate
export function getWorkflowTemplate(dataType) {
    const templates = {
        'single-cell': {
            name: 'Single-Cell RNA-seq Pipeline',
            steps: [
                { tool: 'scanpy', action: 'qc_filter', description: 'Quality control and cell filtering' },
                { tool: 'scanpy', action: 'normalize', description: 'Normalization and log transformation' },
                { tool: 'scvi-tools', action: 'batch_correction', description: 'Batch effect removal (optional)' },
                { tool: 'scanpy', action: 'clustering', description: 'Dimensionality reduction and clustering' },
                { tool: 'cellxgene-census', action: 'annotate', description: 'Cell type annotation' },
                { tool: 'scanpy', action: 'find_markers', description: 'Differential expression analysis' }
            ]
        },
        'ngs-dna': {
            name: 'DNA-seq Variant Calling Pipeline',
            steps: [
                { tool: 'fastp', action: 'qc', description: 'Read quality control' },
                { tool: 'bwa', action: 'align', description: 'Read alignment to reference' },
                { tool: 'samtools', action: 'sort_index', description: 'BAM sorting and indexing' },
                { tool: 'bcftools', action: 'variant_call', description: 'Variant calling' },
                { tool: 'query-clinvar', action: 'annotate', description: 'Clinical significance annotation' }
            ]
        },
        'ngs-rna': {
            name: 'RNA-seq Expression Analysis',
            steps: [
                { tool: 'fastp', action: 'qc', description: 'Read quality control' },
                { tool: 'star', action: 'align', description: 'Spliced alignment' },
                { tool: 'featurecounts', action: 'quantify', description: 'Gene-level quantification' },
                { tool: 'deseq2', action: 'de_analysis', description: 'Differential expression' },
                { tool: 'bgpt-paper-search', action: 'validate', description: 'Literature validation of DEGs' }
            ]
        }
    };

    return templates[dataType] || { error: `No template found for type: ${dataType}` };
}

// Tool: interpretResults (placeholder for AI interpretation)
export function interpretResults(resultsPath, context = '', format = 'technical-report') {
    if (!fs.existsSync(resultsPath)) {
        return { error: `Results path not found: ${resultsPath}` };
    }

    // This would integrate with LLM for actual interpretation
    // For now, provide structure
    return {
        resultsPath,
        context,
        format,
        interpretationReady: true,
        sections: [
            'Data Quality Summary',
            'Key Findings',
            'Biological Interpretation',
            'Recommended Next Steps'
        ],
        note: 'Full AI interpretation requires LLM integration via OpenClaw'
    };
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const command = process.argv[2];
    
    switch (command) {
        case 'identify':
            const pathToAnalyze = process.argv[3] || '.';
            console.log(JSON.stringify(identifyBioData(pathToAnalyze), null, 2));
            break;
        case 'check':
            const skillToCheck = process.argv[3];
            if (!skillToCheck) {
                console.error('Usage: node orchestrator.mjs check <skill-name>');
                process.exit(1);
            }
            console.log(JSON.stringify(checkSkillAvailability(skillToCheck), null, 2));
            break;
        case 'template':
            const dataType = process.argv[3];
            if (!dataType) {
                console.error('Usage: node orchestrator.mjs template <data-type>');
                console.error('Available types: single-cell, ngs-dna, ngs-rna');
                process.exit(1);
            }
            console.log(JSON.stringify(getWorkflowTemplate(dataType), null, 2));
            break;
        default:
            console.log('ClawOmics Bio-Expert Orchestrator');
            console.log('Usage:');
            console.log('  node orchestrator.mjs identify [path]     - Identify bio data formats');
            console.log('  node orchestrator.mjs check <skill>       - Check if skill is available');
            console.log('  node orchestrator.mjs template <type>     - Get workflow template');
    }
}