# Geneclaw: Professional Bioinformatics Orchestration for OpenClaw

**Geneclaw** is a high-performance, AI-driven bioinformatics orchestration agent designed for the [OpenClaw](https://github.com/openclaw/openclaw) ecosystem. It bridges the gap between raw biological data and expert-level insights by automating complex workflows, managing tool environments, and providing context-aware interpretation of multi-omics results.

---

## 🚀 Core Features

- **Intelligent Multi-Omics Orchestration**: Seamlessly coordinate pipelines across genomics, transcriptomics, single-cell analysis, and metabolic modeling.
- **Automatic Environment Management**: Built-in support for `Conda` and `Mamba` to handle version-sensitive bioinformatics dependencies automatically.
- **AI-Driven Biological Interpretation**: Go beyond statistics. Geneclaw translates technical outputs (PCA, DEG tables, mapping logs) into actionable biological narratives.
- **Data-First Discovery**: Automatically identifies raw data types and recommends the optimal tools and skills for the task.
- **Integrated Skill Suite**: Includes over 180+ specialized skills for scientific research, from database querying to advanced sequence analysis.

---

## 🛠️ Installation & Setup

Geneclaw is designed to be used as a set of specialized skills within an OpenClaw environment.

### Prerequisites
- [OpenClaw](https://github.com/openclaw/openclaw) installed and configured.
- `Conda` or `Mamba` package manager (recommended for environment management).

### Setup
1. Clone this repository into your OpenClaw skills directory:
   ```bash
   git clone https://github.com/yf8578/geneclaw.git
   ```
2. OpenClaw will automatically detect the `skills/bio-expert` orchestrator and its associated tools.

---

## 📂 Project Structure

- `skills/bio-expert`: The Master Orchestrator skill.
- `skills/*`: A comprehensive collection of integrated scientific skills.
- `docs/RESOURCES.md`: A dynamically generated inventory of all available skills.
- `scripts/inventory_skills.mjs`: Utility script to scan and categorize skills.

---

## 🙏 Credits & Attributions

Geneclaw integrates and builds upon the excellent work of the following projects:

- **[Claude Scientific Skills](https://github.com/K-Dense-AI/claude-scientific-skills)** by K-Dense-AI: Provided the foundation for 170+ scientific research skills.
- **[BioClaw](https://github.com/Runchuan-BU/BioClaw)** by Runchuan-BU: Provided specialized bioinformatics tools and inspirations for the initial orchestration logic.

We are deeply grateful to the maintainers and contributors of these repositories for their contributions to the open-source AI and science community.

---

## 📄 License

Geneclaw is distributed under the **MIT License**. 

Individual skills integrated from external sources may carry their own licenses (mostly MIT). Please refer to the `SKILL.md` files within each skill directory for specific license information where applicable.

---
*Created by [yf8578](https://github.com/yf8578)* 🧬🦞
