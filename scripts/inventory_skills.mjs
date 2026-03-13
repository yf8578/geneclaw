import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = process.env.CLAWOMICS_HOME || path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(PROJECT_ROOT, 'skills');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'docs', 'RESOURCES.md');

const CATEGORIES = {
    'NGS & Genomics': [/fastq/i, /bam/i, /sam/i, /vcf/i, /bwa/i, /bowtie/i, /deeptools/i, /variant/i, /genome/i, /dna/i, /rna/i, /bed/i, /interval/i, /gtars/i, /pysam/i, /ena/i, /ensembl/i],
    'Single-Cell & Spatial': [/anndata/i, /scanpy/i, /scvi/i, /h5ad/i, /cellxgene/i, /single-cell/i, /mtx/i, /seurat/i, /spatial/i, /neuropixels/i],
    'Biological Databases & Knowledge': [/uniprot/i, /kegg/i, /chembl/i, /reactome/i, /pubmed/i, /biorxiv/i, /gwas/i, /clinvar/i, /drugbank/i, /opentargets/i, /openalex/i, /string/i, /pubchem/i, /pdb/i, /alphafold/i, /bioservices/i, /gget/i, /clinical/i, /fda/i, /bio-database/i],
    'Cheminformatics & Molecular Modeling': [/rdkit/i, /datamol/i, /deepchem/i, /torchdrug/i, /molfeat/i, /zinc/i, /diffdock/i, /medchem/i, /hmdb/i, /metabolomics/i, /brenda/i, /cobrapy/i, /rowan/i, /molecular/i, /chemistry/i, /docking/i],
    'General Scientific Computing & Stats': [/statistics/i, /statsmodels/i, /scikit-learn/i, /scipy/i, /numpy/i, /pandas/i, /polars/i, /dask/i, /vaex/i, /matplotlib/i, /seaborn/i, /plotly/i, /scientific/i, /visualization/i, /literature/i, /citation/i, /research/i, /experimental/i, /protocol/i, /lab/i, /labarchive/i, /benchling/i, /opentrons/i, /pylabrobot/i, /neurokit/i, /fluidsim/i, /sympy/i, /astropy/i, /timesfm/i, /transformer/i, /pytorch/i, /lightning/i]
};

function getCategory(name, description) {
    const text = (name + ' ' + description).toLowerCase();
    for (const [cat, patterns] of Object.entries(CATEGORIES)) {
        if (patterns.some(p => p.test(text))) {
            return cat;
        }
    }
    return 'Other Tools';
}

function scanSkills() {
    const skills = [];
    if (!fs.existsSync(SKILLS_DIR)) return skills;
    const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isDirectory()) {
            const skillPath = path.join(SKILLS_DIR, entry.name);
            const mdPath = path.join(skillPath, 'SKILL.md');
            
            if (fs.existsSync(mdPath)) {
                const content = fs.readFileSync(mdPath, 'utf8');
                
                // Try to get name from # Heading or first line
                let name = entry.name;
                const h1Match = content.match(/^#\s+(.+)$/m);
                if (h1Match) name = h1Match[1].trim();

                // Get description (the first paragraph after name/metadata)
                let description = '';
                // Remove H1 and metadata blocks to find description
                let cleanContent = content.replace(/^#\s+.+$/m, '')
                                         .replace(/^---\s*[\s\S]*?---\s*$/m, '')
                                         .trim();
                const descMatch = cleanContent.match(/^([\s\S]+?)(?:\n\s*\n|##|$)/);
                if (descMatch) {
                    description = descMatch[1].replace(/[\n\r]+/g, ' ').trim();
                }

                skills.push({
                    id: entry.name,
                    name,
                    description,
                    category: getCategory(name, description)
                });
            }
        }
    }
    return skills;
}

function generateMarkdown(skills) {
    const grouped = skills.reduce((acc, skill) => {
        if (!acc[skill.category]) acc[skill.category] = [];
        acc[skill.category].push(skill);
        return acc;
    }, {});

    let md = '# 🧬 ClawOmics Skill Resources\n\n';
    md += 'This inventory lists all compatible OpenClaw skills available on the host system, categorized by their relevance to bioinformatics workflows.\n\n';

    // Add Summary Table
    md += '## 📊 Resource Summary\n\n';
    md += '| Category | Skill Count | Description |\n';
    md += '| :--- | :---: | :--- |\n';
    md += `| **NGS & Genomics** | ${grouped['NGS & Genomics']?.length || 0} | Sequence analysis, mapping, and variant calling |\n`;
    md += `| **Single-Cell & Spatial** | ${grouped['Single-Cell & Spatial']?.length || 0} | scRNA-seq, spatial transcriptomics, and clustering |\n`;
    md += `| **Biological Databases** | ${grouped['Biological Databases & Knowledge']?.length || 0} | PubMed, UniProt, Ensembl, and structure lookups |\n`;
    md += `| **Cheminformatics** | ${grouped['Cheminformatics & Molecular Modeling']?.length || 0} | RDKit, docking, and molecular simulations |\n`;
    md += `| **General Science & Stats** | ${grouped['General Scientific Computing & Stats']?.length || 0} | Visualization, statistics, and ML frameworks |\n`;
    md += `| **Other Tools** | ${grouped['Other Tools']?.length || 0} | Utilities and general helper skills |\n\n`;

    for (const cat of Object.keys(CATEGORIES).concat(['Other Tools'])) {
        if (grouped[cat] && grouped[cat].length > 0) {
            md += `## ${cat}\n\n`;
            for (const skill of grouped[cat]) {
                md += `### ${skill.name} (\`${skill.id}\`)\n`;
                md += `${skill.description}\n\n`;
            }
        }
    }

    md += '---\n*Generated by scripts/inventory_skills.mjs*\n';
    return md;
}

const skills = scanSkills();
const mdContent = generateMarkdown(skills);
fs.writeFileSync(OUTPUT_FILE, mdContent);
console.log(`Inventory generated successfully at ${OUTPUT_FILE}`);
console.log(`Scanned ${skills.length} skills.`);
