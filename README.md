# PDF Highlight App

A React application that allows users to view PDF documents and highlight specific content by clicking on reference numbers [1], [2], and [3]. Built with React, Vite, and PDF.js.

## Features

- **PDF Viewer**: Display PDF documents in the browser
- **Interactive Highlighting**: Click reference numbers to highlight relevant content
- **Page-Specific Targeting**: Each reference highlights content on specific PDF pages
- **Smart Search**: Flexible pattern matching to find variations of target phrases
- **Visual Feedback**: Yellow highlighting with smooth transitions

## Quick Start

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager

### Installation

1. **Create the project**
   ```bash
   npm create vite@latest pdf-highlight -- --template react
   cd pdf-highlight
   ```

2. **Install dependencies**
   ```bash
   npm install pdfjs-dist
   npm install tesseract.js
   ```

3. **Replace default files**
   - Copy the provided `App.jsx` and `App.css` files to the `src/` directory
   - Add your PDF file to the `public/` directory (name it `maersk-report.pdf` or update the path in `App.jsx`)

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   Navigate to `http://localhost:5173` to view the application

## Project Structure

```
pdf-highlight/
├── eslint.config.js      # ESLint configuration
├── index.html            # Main HTML template
├── package.json          # Project dependencies and scripts
├── README.md             # This file
├── vite.config.js        # Vite configuration
├── public/
│   └── maersk-report.pdf # Your PDF file
└── src/
    ├── App.css           # Styling for PDF viewer and highlights
    ├── App.jsx           # Main React component
    ├── index.css         # Global styles
    └── main.jsx          # React app entry point
```

## Usage

1. **Load PDF**: The PDF will automatically load when the component mounts
2. **Navigate**: Use mouse wheel or scroll to navigate through pages
3. **Highlight Content**: Click on reference buttons [1], [2], or [3] to highlight specific content
4. **Clear Highlights**: Click the same reference again to remove highlighting

## Dependencies

- **React**: UI framework
- **Vite**: Build tool and development server
- **PDF.js**: PDF rendering and text extraction
- **Tesseract.js**: OCR capabilities (for future enhancements)

## Configuration

### Adding Your Own PDF

1. Place your PDF file in the `public/` directory
2. Update the PDF path in `App.jsx`:
   ```javascript
   const pdfUrl = '/your-pdf-filename.pdf';
   ```

### Customizing Highlights

Modify the search variations and page filters in `App.jsx`:

```javascript
const handleReference1Click = () => {
  findPhrase([
    'Your search phrase here',
    'Alternative phrase variation'
  ]);
};
```

### Styling

Customize highlight appearance in `App.css`:

```css
.highlight {
  background-color: yellow;
  opacity: 0.5;
  /* Add your custom styles */
}
```

## Troubleshooting

### Common Issues

1. **PDF not loading**: Ensure the PDF file is in the `public/` directory and the path is correct
2. **Highlighting not working**: Check browser console for errors and verify PDF text extraction
3. **Performance issues**: Large PDFs may take time to load; consider optimizing file size

### Browser Compatibility

- Modern browsers with ES6+ support
- Chrome, Firefox, Safari, Edge (latest versions)

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory, ready for deployment.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.
