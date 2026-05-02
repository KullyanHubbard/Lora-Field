# Frontend

Struktur frontend React/Vite untuk pengembangan LoraField.

```text
frontend/
|-- index.html
|-- public/
|   `-- static/
|       |-- index.html
|       |-- monitoring.html
|       |-- irrigation.html
|       |-- weather.html
|       |-- logs.html
|       |-- css/
|       `-- js/
|-- src/
|   |-- assets/
|   |-- components/
|   |-- layout/
|   |-- pages/
|   |-- features/
|   |-- hooks/
|   |-- context/
|   |-- redux/
|   |-- services/
|   |-- utils/
|   |-- App.jsx
|   |-- index.css
|   `-- main.jsx
|-- .eslintrc.json
|-- .gitignore
|-- package.json
|-- README.md
`-- vite.config.js
```

## Cara menjalankan

```bash
npm install
npm run dev
```

Folder `node_modules/` akan muncul otomatis setelah `npm install`.

Halaman HTML statis lama sudah dipindahkan ke `public/static/`. Saat Vite berjalan,
halaman lama bisa dibuka dari `/static/index.html`.
