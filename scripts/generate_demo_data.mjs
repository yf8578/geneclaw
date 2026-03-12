#!/usr/bin/env node
/**
 * ClawOmics Demo Data Generator
 * Creates sample datasets for testing the bio-expert orchestrator
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(process.cwd(), 'demo_data');

function generateSingleCellMetadata() {
    const cellTypes = ['T-cell', 'B-cell', 'Monocyte', 'NK-cell', 'Dendritic'];
    const samples = [];
    
    for (let i = 0; i < 100; i++) {
        samples.push({
            cell_id: `cell_${String(i).padStart(3, '0')}`,
            cell_type: cellTypes[Math.floor(Math.random() * cellTypes.length)],
            n_genes: Math.floor(Math.random() * 2000) + 500,
            n_counts: Math.floor(Math.random() * 10000) + 1000,
            percent_mito: (Math.random() * 10).toFixed(2),
            sample_id: `sample_${String(Math.floor(i / 20)).padStart(2, '0')}`
        });
    }
    
    return samples;
}

function generateDEGTable() {
    const genes = ['IL2', 'CD3E', 'CD19', 'MS4A1', 'CD14', 'LYZ', 'GNLY', 'NKG7', 'FCER1A', 'CST3'];
    const results = [];
    
    for (const gene of genes) {
        results.push({
            gene,
            log2FoldChange: (Math.random() * 4 - 2).toFixed(3),
            pvalue: (Math.random() * 0.05).toExponential(2),
            padj: (Math.random() * 0.01).toExponential(2),
            baseMean: (Math.random() * 1000).toFixed(1)
        });
    }
    
    return results;
}

function generateVCFHeader() {
    return `##fileformat=VCFv4.2
##source=ClawOmicsDemo
##reference=hg38
#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO`;
}

function generateVCFEntries() {
    const chroms = ['chr1', 'chr2', 'chr3', 'chrX'];
    const variants = [];
    
    for (let i = 0; i < 20; i++) {
        const chrom = chroms[Math.floor(Math.random() * chroms.length)];
        const pos = Math.floor(Math.random() * 10000000) + 1000000;
        const ref = ['A', 'T', 'G', 'C'][Math.floor(Math.random() * 4)];
        const alt = ['A', 'T', 'G', 'C'].filter(b => b !== ref)[Math.floor(Math.random() * 3)];
        
        variants.push(`${chrom}\t${pos}\t.\t${ref}\t${alt}\t99\tPASS\tDP=30;AF=0.5`);
    }
    
    return variants.join('\n');
}

function generateFastqEntry(readName, sequence) {
    const quality = 'I'.repeat(sequence.length);
    return `@${readName}\n${sequence}\n+\n${quality}`;
}

export function generateDemoData() {
    console.log('🧬 ClawOmics Demo Data Generator\n');
    
    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`✅ Created: ${OUTPUT_DIR}`);
    }
    
    // 1. Single-cell metadata (CSV)
    const scData = generateSingleCellMetadata();
    const scPath = path.join(OUTPUT_DIR, 'single_cell_metadata.csv');
    const scHeaders = Object.keys(scData[0]).join(',');
    const scRows = scData.map(row => Object.values(row).join(','));
    fs.writeFileSync(scPath, [scHeaders, ...scRows].join('\n'));
    console.log(`✅ Generated: ${scPath} (${scData.length} cells)`);
    
    // 2. Differential expression results (TSV)
    const degData = generateDEGTable();
    const degPath = path.join(OUTPUT_DIR, 'differential_expression.tsv');
    const degHeaders = Object.keys(degData[0]).join('\t');
    const degRows = degData.map(row => Object.values(row).join('\t'));
    fs.writeFileSync(degPath, [degHeaders, ...degRows].join('\n'));
    console.log(`✅ Generated: ${degPath} (${degData.length} DEGs)`);
    
    // 3. Sample VCF
    const vcfPath = path.join(OUTPUT_DIR, 'variants.vcf');
    const vcfContent = generateVCFHeader() + '\n' + generateVCFEntries();
    fs.writeFileSync(vcfPath, vcfContent);
    console.log(`✅ Generated: ${vcfPath}`);
    
    // 4. FASTQ directory structure
    const fastqDir = path.join(OUTPUT_DIR, 'fastq_samples');
    fs.mkdirSync(fastqDir, { recursive: true });
    
    for (let i = 1; i <= 2; i++) {
        const sampleReads = [
            generateFastqEntry(`read_${i}_1`, 'ATCGATCGATCGATCGATCGATCG'),
            generateFastqEntry(`read_${i}_2`, 'GCTAGCTAGCTAGCTAGCTAGCTA')
        ].join('\n');
        
        const fastqPath = path.join(fastqDir, `sample_${i}_R1.fastq`);
        fs.writeFileSync(fastqPath, sampleReads);
        console.log(`✅ Generated: ${fastqPath}`);
    }
    
    console.log('\n🎉 Demo data generation complete!');
    console.log('\nNext steps:');
    console.log('1. Test identification: node skills/bio-expert/scripts/orchestrator.mjs identify demo_data');
    console.log('2. Ask ClawOmics: "Analyze the demo_data folder and suggest a workflow"');
    
    return {
        outputDir: OUTPUT_DIR,
        files: ['single_cell_metadata.csv', 'differential_expression.tsv', 'variants.vcf', 'fastq_samples/']
    };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
    generateDemoData();
}