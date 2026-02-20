# Product Manual Assistant

An AI-powered tool for navigating and extracting knowledge from product manuals. Upload any PDF manual and get instant AI-powered categorization, intelligent Q&A, and visual annotation tools.

## What It Does

- **Smart Extraction** — Automatically pulls out safety warnings, specs, warranty info, procedures, error codes, and links
- **AI Chat** — Ask questions about your manual in plain English
- **Knowledge Cards** — Browse extracted info in organized, searchable cards
- **Annotation Tools** — Mark up diagrams with shapes, arrows, and labels
- **Multi-Manual Library** — Store and search across multiple manuals
- **Metrics Dashboard** — Track usage and measure support ticket reduction

## Quick Start

1. Open `index.html` in any modern browser
2. Click the gear icon and add your API keys:
   - [ScaleDown](https://scaledown.ai) — for text compression
   - [Gemini](https://aistudio.google.com) — for AI features
3. Select a model (gemini-2.0-flash works well)
4. Upload a PDF and start exploring

No build step, no dependencies to install. Just open and go.

## How It Works

```
PDF Upload → PDF.js extracts text → ScaleDown compresses it → Gemini categorizes into buckets → You search and chat
```

The app runs entirely in your browser. Your manuals and API keys stay on your machine.

## Knowledge Categories

| Category | What Gets Extracted |
|----------|---------------------|
| Safety | Warnings, cautions, hazards |
| Parts & Specs | Components, dimensions, model numbers |
| Warranty | Coverage terms, claim procedures |
| Procedures | Setup guides, maintenance steps |
| Errors | Error codes, troubleshooting info |
| Links & Tutorials | URLs, QR codes, video tutorials |

## Project Structure

```
Product Manual Assistant/
├── index.html      # UI structure
├── style.css       # Styling (supports light/dark themes)
├── script.js       # All the logic
├── favicon.svg     # App icon
└── docs/
    ├── README.md       # User guide
    ├── ARCHITECTURE.md # Technical deep-dive
    ├── API.md          # API reference
    └── CONTRIBUTING.md # How to contribute
```

## Tech Stack

- **PDF.js** — PDF parsing
- **Marked.js** — Markdown rendering
- **Font Awesome** — Icons
- **ScaleDown API** — Text compression
- **Google Gemini API** — AI capabilities

## Browser Support

Works in Chrome, Firefox, Edge, and Safari (recent versions).

## Configuration

### API Keys

You'll need two API keys:

1. **ScaleDown** — Sign up at [scaledown.ai](https://scaledown.ai)
2. **Gemini** — Get one from [Google AI Studio](https://aistudio.google.com)

Keys are stored in your browser's localStorage. They never leave your machine except when calling the respective APIs.

### Model Selection

The app fetches available Gemini models automatically. Recommended:
- `gemini-2.0-flash` — Fast, good for most use cases
- `gemini-1.5-pro` — More capable, slower

## Documentation

See the `docs/` folder for detailed documentation:

- [User Guide](docs/README.md) — How to use the app
- [Architecture](docs/ARCHITECTURE.md) — How it's built
- [API Reference](docs/API.md) — Function and API docs
- [Contributing](docs/CONTRIBUTING.md) — How to contribute

## Contributing

Contributions welcome. Fork it, make your changes, submit a PR.

Please:
- Add comments for non-obvious code
- Test in multiple browsers
- Follow the existing code style

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for details.

## Known Limitations

- localStorage has a ~5-10MB limit, so very large manuals may not fit
- OCR fallback requires a Gemini API key
- Some complex PDF layouts may not extract perfectly

## License

MIT

## Author

SUDHARSAN G S