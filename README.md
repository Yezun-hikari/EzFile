<div align="center">
  <h1>EzFile</h1>
  <p>A modern, fast, and secure file hosting and management platform.</p>

  <p>
    <a href="#features">Features</a> •
    <a href="#installation">Installation</a> •
    <a href="#usage">Usage</a>
  </p>
</div>

---

## <a id="features"></a>🌟 Features

- **Modern Glassmorphism UI:** Built with Next.js, Tailwind CSS, and Radix UI for a seamless experience.
- **Secure File Storage:** Safely upload, organize, and manage your files.
- **Background Workers:** Automated tasks and maintenance handled efficiently.
- **Zero Configuration:** Fully containerized with Docker and Docker Compose for easy deployment.

---

## <a id="installation"></a>🚀 Installation

The recommended way to run EzFile is via **Docker**.

### Using Docker Compose (Recommended)

1. Clone this repository:
   ```bash
   git clone https://github.com/Yezun-hikari/EzFile.git
   cd EzFile
   ```

2. Start the container:
   ```bash
   docker-compose up -d
   ```

   *Note on image tags:* 
   - Releases are tagged as `:latest` for stable versions.
   - For bleeding-edge features from the active development branch, use the `:alpha` tag.

3. Open your browser and navigate to `http://localhost:3000`.

### Running Locally without Docker

If you prefer to run it locally (e.g., for development):

```powershell
# Install dependencies
npm install

# Setup Prisma Database
npx prisma generate
npx prisma db push

# Start the application
npm run dev
```

---

## <a id="usage"></a>💻 Usage

Once running, simply open your browser and access the web interface. You can manage your files, view storage metrics, and organize your workspace directly from the beautiful dashboard. 

Storage and the local SQLite database (`dev.db`) will be automatically synced to the `./storage` directory and `./dev.db` file to ensure persistent data.

---

<div align="center">
  <p>Built with ❤️</p>
</div>
