# SecureNotes 🔐

Aplicación de notas seguras, rápida y multiplataforma inspirada en Standard Notes.
Creada por **PierceMyCode**.

![Version](https://img.shields.io/badge/version-2.0.0-7c3aed)
![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Características

- ✅ **Editor 3 columnas** al estilo Standard Notes (navegación → lista → editor)
- ✅ **6 temas predefinidos**: Dark, Light, Midnight, Sepia, Solarized, Gruvbox
- ✅ **Tema personalizado** con selector de colores en tiempo real
- ✅ **Sincronización cloud** vía Firebase Firestore (opcional, sin registro)
- ✅ **Offline-first**: localStorage como respaldo, PWA con Service Worker
- ✅ **Generador de contraseñas** seguras con `crypto.getRandomValues()`
- ✅ **Archivar y papelera** con vaciado
- ✅ **Exportación** completa de datos a JSON
- ✅ **Búsqueda** en tiempo real con debounce
- ✅ **Ordenamiento**: Recientes, Más antiguas, Alfabético
- ✅ **Atajos de teclado**: Ctrl+N (nueva), Ctrl+S (guardar)
- ✅ **Multiplataforma**: Web PWA, Windows, Mac, Linux, Android, iOS

## 📁 Estructura del proyecto
SecureNotes/ ├── web/ # Aplicación web principal (PWA) │ ├── index.html # Interfaz de notas (3 columnas) │ ├── style.css # Sistema de temas SN + layout │ ├── app.js # Lógica completa (Firebase + localStorage) │ ├── manifest.json # PWA manifest │ ├── sw.js # Service Worker offline │ └── icon-*.png # Iconos PWA ├── desktop/ # Aplicaciones nativas de escritorio │ ├── main.js # Proceso principal de Electron │ ├── preload.js # Context bridge para IPC │ ├── package.json # electron-builder config │ └── icons/ # Iconos para instaladores ├── mobile/ # Aplicaciones nativas móviles │ ├── package.json # Capacitor dependencies │ └── capacitor.config.ts ├── landing/ # Landing page (GitHub Pages) │ ├── index.html # Página promocional con descargas │ └── landing.css # Estilos de la landing ├── README.md # Este archivo └── LICENSE.txt # Licencia MIT